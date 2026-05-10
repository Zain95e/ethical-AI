"""
Universal Model Loader - Abstraction for loading ML models from various frameworks.

Supports:
- scikit-learn (.pkl, .joblib)
- TensorFlow/Keras (.h5, SavedModel)
- PyTorch (.pt, .pth)
- ONNX (.onnx)
- XGBoost (.json, .ubj)
- LightGBM (.txt)

Each model is wrapped in a common interface providing:
- predict(X) -> class predictions
- predict_proba(X) -> probability estimates
"""

import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Optional, Union, Tuple
import logging
import sys
import pickle

import numpy as np
import pandas as pd
import joblib
from sklearn.base import BaseEstimator, TransformerMixin

logger = logging.getLogger(__name__)


class DataCleaner(BaseEstimator, TransformerMixin):
    """
    Custom sklearn transformer that strips whitespace from string columns
    and coerces all values to numeric (NaN-filling unknown categories).

    This class **must** live here (app.services.model_loader) so that
    joblib/pickle can resolve it when deserializing Pipeline objects that
    were trained with DataCleaner as a step.  Any training script that
    builds such pipelines should import it from this module.
    """

    def fit(self, X, y=None):
        """Nothing to learn — DataCleaner is stateless."""
        return self

    def transform(self, X):
        """
        Strip leading/trailing whitespace from string columns, then
        encode every column as a numeric value (unknown strings become -1
        via pandas factorize, NaNs become 0).

        IMPORTANT: Always returns a pandas DataFrame (never a numpy array)
        so that downstream Pipeline steps like ColumnTransformer can still
        select columns by name.  If the input was a numpy array, generic
        column names (0, 1, 2, ...) are assigned.
        """
        was_array = isinstance(X, np.ndarray)
        if was_array:
            X = pd.DataFrame(X)

        X = X.copy()

        for col in X.columns:
            if X[col].dtype == object:
                # Strip whitespace first (critical for CSVs like Adult Income)
                X[col] = X[col].astype(str).str.strip()
                X[col] = pd.factorize(X[col])[0].astype(float)
            else:
                X[col] = pd.to_numeric(X[col], errors="coerce")

        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        # Return DataFrame so column names are preserved for ColumnTransformer steps
        return X


# Compatibility shim for old sklearn pickle files
class SklearnUnpickler(pickle.Unpickler):
    """Custom unpickler to handle sklearn module path changes."""
    
    def find_class(self, module, name):
        """Override to redirect old sklearn paths and custom transformer paths."""
        # ---------------------------------------------------------------------------
        # Redirect DataCleaner from *any* training-script module to this canonical
        # location so that older pickled pipelines can still be deserialised.
        # ---------------------------------------------------------------------------
        if name == "DataCleaner":
            return DataCleaner

        # Map old sklearn internal modules to new paths
        renamed_modules = {
            'sklearn.linear_model.logistic': 'sklearn.linear_model._logistic',
            'sklearn.linear_model.base': 'sklearn.linear_model._base',
            'sklearn.tree.tree': 'sklearn.tree._tree',
            'sklearn.ensemble.forest': 'sklearn.ensemble._forest',
            'sklearn.ensemble.gradient_boosting': 'sklearn.ensemble._gb',
            'sklearn.svm.classes': 'sklearn.svm._classes',
            'sklearn.neighbors.classification': 'sklearn.neighbors._classification',
            'sklearn.naive_bayes': 'sklearn.naive_bayes',
        }
        
        # Handle numpy version incompatibilities (numpy 2.0 -> 1.x)
        if module.startswith('numpy._core'):
            # numpy 2.0 moved things to _core, map back to old locations
            module = module.replace('numpy._core', 'numpy.core')
        elif module.startswith('numpy.core') and not hasattr(np.core, name.split('.')[0] if '.' in name else name):
            # numpy 1.x -> 2.0, try _core
            try:
                module = module.replace('numpy.core', 'numpy._core')
            except:
                pass
        
        if module in renamed_modules:
            module = renamed_modules[module]
        
        try:
            return super().find_class(module, name)
        except (ImportError, AttributeError) as e:
            logger.warning(f"Could not import {module}.{name}, trying alternative paths: {e}")
            # Try to import from parent module
            if '.' in module:
                parent_module = '.'.join(module.split('.')[:-1])
                try:
                    return super().find_class(parent_module, name)
                except:
                    pass
            raise


class ModelWrapper(ABC):
    """
    Abstract base class for model wrappers.
    Provides a unified interface regardless of the underlying framework.
    """
    
    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Generate class predictions.
        
        Args:
            X: Feature matrix of shape (n_samples, n_features)
            
        Returns:
            Array of predicted class labels (0 or 1 for binary classification)
        """
        pass
    
    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Generate probability estimates.
        
        Args:
            X: Feature matrix of shape (n_samples, n_features)
            
        Returns:
            Array of shape (n_samples, n_classes) with probability estimates
        """
        pass
    
    @property
    @abstractmethod
    def model_type(self) -> str:
        """Return the model framework type."""
        pass
    
    @property
    def feature_names(self) -> Optional[list]:
        """Return feature names if available."""
        return None
    
    @property
    def classes(self) -> Optional[np.ndarray]:
        """Return class labels if available."""
        return None


class SklearnModelWrapper(ModelWrapper):
    """
    Robust wrapper for scikit-learn compatible models.

    Handles all common shapes:
    - Raw estimators (RandomForestClassifier, LogisticRegression, etc.)
    - Pipelines (Pipeline with preprocessing + estimator)
    - Pipelines with ColumnTransformers (need DataFrame with named columns)
    - Dict-wrapped models ({"model": clf, "scaler": scaler, ...})

    Key robustness features:
    - Auto-detects if the model needs a DataFrame vs numpy array
    - Auto-aligns feature count and order to match training schema
    - Catches all prediction errors and re-raises with clear guidance
    """

    def __init__(self, model: Any):
        self._model = model
        self._fix_sklearn_compatibility()
        self._validate_model()
        # Cache feature schema at init so every predict() call is fast
        self._expected_feature_names, self._expected_n_features = \
            self._detect_feature_schema()
        self._needs_dataframe = self._check_needs_dataframe()

    # ------------------------------------------------------------------
    # Introspection helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _walk_pipeline_steps(model_obj):
        """Yield every transformer/estimator inside a Pipeline (recursively)."""
        if hasattr(model_obj, 'steps'):
            for _, step in model_obj.steps:
                yield step
                yield from SklearnModelWrapper._walk_pipeline_steps(step)

    def _detect_feature_schema(self) -> tuple:
        """
        Walk the model tree to find the expected input feature schema.
        Returns (feature_names_list | None, n_features_int | None).
        """
        obj = self._model

        # 1. Check the top-level object
        if hasattr(obj, 'feature_names_in_'):
            names = [str(f) for f in obj.feature_names_in_]
            return names, len(names)

        # 2. Walk inside Pipeline steps
        for step in self._walk_pipeline_steps(obj):
            if hasattr(step, 'feature_names_in_'):
                names = [str(f) for f in step.feature_names_in_]
                logger.info(
                    f"Feature schema found on inner step "
                    f"{type(step).__name__}: {len(names)} features"
                )
                return names, len(names)
            if hasattr(step, 'n_features_in_'):
                n = int(step.n_features_in_)
                logger.info(
                    f"Feature count found on inner step "
                    f"{type(step).__name__}: {n} features"
                )
                return None, n

        # 3. Top-level n_features_in_ (no names)
        if hasattr(obj, 'n_features_in_'):
            return None, int(obj.n_features_in_)

        return None, None

    def _check_needs_dataframe(self) -> bool:
        """
        Return True if any step inside the model uses string-based column
        selection (ColumnTransformer with named columns).  When True, we
        must feed DataFrames — not raw numpy arrays — to predict().
        """
        try:
            from sklearn.compose import ColumnTransformer
        except ImportError:
            return False

        obj = self._model

        # Check the model itself
        if isinstance(obj, ColumnTransformer):
            return True

        # Check Pipeline steps
        for step in self._walk_pipeline_steps(obj):
            if isinstance(step, ColumnTransformer):
                # Check if it uses string column references
                if hasattr(step, 'transformers'):
                    for _, _, columns in step.transformers:
                        if isinstance(columns, list) and columns and isinstance(columns[0], str):
                            return True
                        if isinstance(columns, str):
                            return True
                # Safe default: if ColumnTransformer exists, assume it needs DataFrame
                return True

        return False

    # ------------------------------------------------------------------
    # Compatibility helpers
    # ------------------------------------------------------------------
    def _fix_sklearn_compatibility(self) -> None:
        """Fix compatibility issues with models from different sklearn versions."""
        from sklearn.linear_model import LogisticRegression

        # Unwrap the inner estimator if Pipeline
        target = self._model
        if hasattr(target, 'steps'):
            target = target.steps[-1][1]

        # Fix LogisticRegression models missing multi_class attribute (old sklearn versions)
        if isinstance(target, LogisticRegression):
            if not hasattr(target, 'multi_class'):
                target.multi_class = 'auto'
                logger.info("Added missing 'multi_class' attribute to LogisticRegression model")
            if not hasattr(target, 'solver'):
                target.solver = 'lbfgs'
            if not hasattr(target, 'max_iter'):
                target.max_iter = 100

    def _validate_model(self) -> None:
        """Validate that the model has required methods."""
        # Unwrap dict-wrapped models (common pattern: {"model": clf, "scaler": scaler, ...})
        if isinstance(self._model, dict):
            for key in ("model", "classifier", "estimator", "pipeline", "clf"):
                if key in self._model and hasattr(self._model[key], "predict"):
                    logger.info(f"Unwrapped dict-packaged model from key '{key}'")
                    self._model = self._model[key]
                    return
            raise ValueError(
                f"Loaded a dict with keys {list(self._model.keys())} but none had a 'predict' method. "
                "Please save the fitted model object directly (e.g. joblib.dump(model, 'model.pkl')), "
                "not wrapped inside a dictionary."
            )

        if not hasattr(self._model, 'predict'):
            raise ValueError(
                f"Loaded a '{type(self._model).__name__}' object which does not have a 'predict' method. "
                "Make sure you saved the full fitted model (e.g. LogisticRegression, RandomForestClassifier, Pipeline), "
                "not a preprocessor (ColumnTransformer, StandardScaler, LabelEncoder, etc.)."
            )

    # ------------------------------------------------------------------
    # Input preparation (the core robustness logic)
    # ------------------------------------------------------------------
    def _prepare_input(self, X) -> Any:
        """
        Prepare X so it matches exactly what the inner model expects.

        1. Convert to DataFrame if the model needs named columns.
        2. Align feature names / count to training schema.
        3. Preserve DataFrame when needed, convert to array otherwise.
        """
        is_df = isinstance(X, pd.DataFrame)

        # --- Step 1: Ensure DataFrame if the model needs one ---------------
        if self._needs_dataframe and not is_df:
            if self._expected_feature_names:
                # We know the column names → build a proper DataFrame
                n_cols = X.shape[1] if hasattr(X, 'shape') and len(X.shape) > 1 else len(X[0]) if len(X) > 0 else 0
                if n_cols == len(self._expected_feature_names):
                    X = pd.DataFrame(X, columns=self._expected_feature_names)
                else:
                    # Mismatch — build with generic names, alignment will fix it below
                    X = pd.DataFrame(X, columns=[f"f{i}" for i in range(n_cols)])
            else:
                # No names known; build generic DataFrame
                n_cols = X.shape[1] if hasattr(X, 'shape') and len(X.shape) > 1 else len(X[0]) if len(X) > 0 else 0
                X = pd.DataFrame(X, columns=[f"f{i}" for i in range(n_cols)])
            is_df = True

        # --- Step 2: Align features by name --------------------------------
        if is_df and self._expected_feature_names:
            expected = self._expected_feature_names
            # Drop extras
            extra = [c for c in X.columns if c not in expected]
            if extra:
                logger.info(f"predict: dropping {len(extra)} extra column(s) not in model schema: {extra[:10]}")
                X = X.drop(columns=extra)
            # Fill missing with 0
            missing = [c for c in expected if c not in X.columns]
            if missing:
                logger.warning(f"predict: filling {len(missing)} missing column(s) with 0: {missing[:10]}")
                for col in missing:
                    X[col] = 0.0
            # Reorder
            X = X[expected]
            return X

        # --- Step 3: Align features by count (no names) --------------------
        if self._expected_n_features is not None:
            n_cols = X.shape[1] if hasattr(X, 'shape') and len(X.shape) > 1 else 0
            if n_cols > self._expected_n_features:
                logger.warning(
                    f"predict: trimming {n_cols} → {self._expected_n_features} columns (positional)"
                )
                if is_df:
                    X = X.iloc[:, :self._expected_n_features]
                else:
                    X = X[:, :self._expected_n_features]
            elif n_cols < self._expected_n_features:
                pad = self._expected_n_features - n_cols
                logger.warning(
                    f"predict: padding {pad} column(s) with 0 to reach {self._expected_n_features}"
                )
                if is_df:
                    for i in range(pad):
                        X[f"__pad_{i}"] = 0.0
                else:
                    X = np.hstack([X, np.zeros((X.shape[0], pad))])

        return X

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def predict(self, X) -> np.ndarray:
        """
        Generate class predictions.

        Accepts DataFrame or numpy array.  Automatically handles:
        - Feature alignment (name / count mismatch)
        - DataFrame ↔ array conversion for ColumnTransformer pipelines
        - Clear error messages when something still goes wrong
        """
        try:
            X = self._prepare_input(X)
            return self._model.predict(X)
        except Exception as e:
            raise ValueError(self._friendly_predict_error(e, X)) from e

    def predict_proba(self, X) -> np.ndarray:
        """
        Generate probability estimates.

        Falls back to decision_function → sigmoid/softmax if predict_proba
        is unavailable, and further falls back to one-hot encoding of
        hard predictions.
        """
        try:
            X = self._prepare_input(X)
        except Exception as e:
            raise ValueError(self._friendly_predict_error(e, X)) from e

        if hasattr(self._model, 'predict_proba'):
            try:
                return self._model.predict_proba(X)
            except AttributeError as e:
                logger.warning(f"predict_proba failed with AttributeError: {e}, falling back to decision function")
                if hasattr(self._model, 'decision_function'):
                    decision = self._model.decision_function(X)
                    if decision.ndim == 1:
                        proba_positive = 1 / (1 + np.exp(-decision))
                        return np.vstack([1 - proba_positive, proba_positive]).T
                    else:
                        exp_decision = np.exp(decision - np.max(decision, axis=1, keepdims=True))
                        return exp_decision / np.sum(exp_decision, axis=1, keepdims=True)
                raise
            except Exception as e:
                raise ValueError(self._friendly_predict_error(e, X)) from e
        else:
            # Fallback for models without predict_proba (e.g., SVM without probability=True)
            predictions = self.predict(X)
            n_classes = len(np.unique(predictions)) if len(np.unique(predictions)) > 1 else 2
            proba = np.zeros((len(predictions), n_classes))
            for i, pred in enumerate(predictions):
                proba[i, int(pred)] = 1.0
            return proba

    # ------------------------------------------------------------------
    # User-facing error formatting
    # ------------------------------------------------------------------
    def _friendly_predict_error(self, error: Exception, X: Any) -> str:
        """
        Convert a raw sklearn exception into a helpful, actionable message
        that tells the user exactly what went wrong and how to fix it.
        """
        msg = str(error)
        x_shape = X.shape if hasattr(X, 'shape') else "unknown"
        model_class = type(self._model).__name__

        # Feature count mismatch
        if "features" in msg and ("expecting" in msg or "expected" in msg):
            return (
                f"Feature mismatch: the model ({model_class}) was trained on "
                f"{self._expected_n_features or '?'} features, but the dataset "
                f"has {x_shape[1] if hasattr(x_shape, '__getitem__') else '?'} "
                f"features after preprocessing.  "
                f"This usually means the dataset has extra columns (e.g. an ID "
                f"column, or the target column was not dropped).  "
                f"HOW TO FIX: Make sure you upload the same dataset the model "
                f"was trained on, and select the correct target column."
            )

        # ColumnTransformer needs DataFrame
        if "string" in msg.lower() and "dataframe" in msg.lower():
            return (
                f"The model ({model_class}) contains a ColumnTransformer that "
                f"selects columns by name, but received a raw numpy array.  "
                f"This is an internal platform error and has been auto-corrected.  "
                f"If you see this message, please report it as a bug."
            )

        # Generic fallback
        return (
            f"Prediction failed on model '{model_class}' "
            f"(input shape: {x_shape}): {msg}.  "
            f"HOW TO FIX: Ensure the uploaded dataset matches the features "
            f"the model was trained on, and that the correct target column is selected."
        )

    @property
    def model_type(self) -> str:
        return "sklearn"

    @property
    def feature_names(self) -> Optional[list]:
        return self._expected_feature_names

    @property
    def classes(self) -> Optional[np.ndarray]:
        if hasattr(self._model, 'classes_'):
            return self._model.classes_
        # Check last step of pipeline
        if hasattr(self._model, 'steps'):
            last_step = self._model.steps[-1][1]
            if hasattr(last_step, 'classes_'):
                return last_step.classes_
        return None

    @property
    def raw_model(self) -> Any:
        """Access the underlying sklearn model."""
        return self._model


class TensorFlowModelWrapper(ModelWrapper):
    """Wrapper for TensorFlow/Keras models."""
    
    def __init__(self, model: Any):
        self._model = model
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Generate class predictions."""
        predictions = self._model.predict(X, verbose=0)
        
        # Handle different output shapes
        if predictions.ndim == 1 or predictions.shape[1] == 1:
            # Binary classification with single output (sigmoid)
            return (predictions.flatten() > 0.5).astype(int)
        else:
            # Multi-class or binary with softmax
            return np.argmax(predictions, axis=1)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Generate probability estimates."""
        predictions = self._model.predict(X, verbose=0)
        
        # Handle single output (sigmoid) - convert to 2-class format
        if predictions.ndim == 1 or predictions.shape[1] == 1:
            probs = predictions.flatten()
            return np.column_stack([1 - probs, probs])
        
        return predictions
    
    @property
    def model_type(self) -> str:
        return "tensorflow"


class PyTorchModelWrapper(ModelWrapper):
    """Wrapper for PyTorch models."""
    
    def __init__(self, model: Any, device: str = "cpu"):
        import torch
        self._model = model
        self._device = torch.device(device)
        self._model.to(self._device)
        self._model.eval()
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Generate class predictions."""
        import torch
        
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X).to(self._device)
            outputs = self._model(X_tensor)
            
            if outputs.dim() == 1 or outputs.shape[1] == 1:
                # Binary classification with single output
                predictions = (torch.sigmoid(outputs).flatten() > 0.5).int()
            else:
                # Multi-class
                predictions = torch.argmax(outputs, dim=1)
            
            return predictions.cpu().numpy()
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Generate probability estimates."""
        import torch
        import torch.nn.functional as F
        
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X).to(self._device)
            outputs = self._model(X_tensor)
            
            if outputs.dim() == 1 or outputs.shape[1] == 1:
                # Binary with sigmoid
                probs = torch.sigmoid(outputs).flatten()
                probs = torch.stack([1 - probs, probs], dim=1)
            else:
                # Multi-class with softmax
                probs = F.softmax(outputs, dim=1)
            
            return probs.cpu().numpy()
    
    @property
    def model_type(self) -> str:
        return "pytorch"


class ONNXModelWrapper(ModelWrapper):
    """Wrapper for ONNX models using ONNX Runtime."""
    
    def __init__(self, session: Any):
        self._session = session
        self._input_name = self._session.get_inputs()[0].name
        self._output_names = [o.name for o in self._session.get_outputs()]
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Generate class predictions."""
        proba = self.predict_proba(X)
        return np.argmax(proba, axis=1)
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Generate probability estimates."""
        # ONNX expects float32
        X = X.astype(np.float32)
        
        outputs = self._session.run(self._output_names, {self._input_name: X})
        
        # Usually the last output is probabilities
        proba = outputs[-1] if len(outputs) > 1 else outputs[0]
        
        # Handle dictionary outputs (some sklearn converters produce this)
        if isinstance(proba, list) and len(proba) > 0:
            proba = proba[0]
        
        # Ensure 2D
        if proba.ndim == 1:
            proba = np.column_stack([1 - proba, proba])
        
        return proba
    
    @property
    def model_type(self) -> str:
        return "onnx"


class UniversalModelLoader:
    """
    Factory class for loading ML models from various frameworks.
    
    Usage:
        model = UniversalModelLoader.load("path/to/model.pkl")
        predictions = model.predict(X_test)
        probabilities = model.predict_proba(X_test)
    """
    
    SKLEARN_EXTENSIONS = {'.pkl', '.joblib', '.pickle'}
    TENSORFLOW_EXTENSIONS = {'.h5', '.keras'}
    PYTORCH_EXTENSIONS = {'.pt', '.pth'}
    ONNX_EXTENSIONS = {'.onnx'}
    
    @classmethod
    def load(
        cls,
        filepath: Union[str, Path],
        model_type: Optional[str] = None
    ) -> ModelWrapper:
        """
        Load a model from file and wrap it in a unified interface.
        
        Args:
            filepath: Path to the model file
            model_type: Optional explicit model type. If not provided,
                       will be inferred from file extension.
                       Options: 'sklearn', 'tensorflow', 'pytorch', 'onnx'
        
        Returns:
            ModelWrapper instance with unified predict/predict_proba interface
            
        Raises:
            ValueError: If model type cannot be determined or is unsupported
            FileNotFoundError: If model file doesn't exist
        """
        filepath = Path(filepath)
        
        if not filepath.exists():
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        # Determine model type
        if model_type is None:
            model_type = cls._detect_model_type(filepath)
        
        logger.info(f"Loading {model_type} model from {filepath}")
        
        # Load based on type
        if model_type == "sklearn":
            return cls._load_sklearn(filepath)
        elif model_type == "tensorflow":
            return cls._load_tensorflow(filepath)
        elif model_type == "pytorch":
            return cls._load_pytorch(filepath)
        elif model_type == "onnx":
            return cls._load_onnx(filepath)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")
    
    @classmethod
    def _detect_model_type(cls, filepath: Path) -> str:
        """Detect model type from file extension."""
        ext = filepath.suffix.lower()
        
        if ext in cls.SKLEARN_EXTENSIONS:
            return "sklearn"
        elif ext in cls.TENSORFLOW_EXTENSIONS:
            return "tensorflow"
        elif ext in cls.PYTORCH_EXTENSIONS:
            return "pytorch"
        elif ext in cls.ONNX_EXTENSIONS:
            return "onnx"
        elif filepath.is_dir():
            # Could be TensorFlow SavedModel format
            if (filepath / "saved_model.pb").exists():
                return "tensorflow"
            raise ValueError(f"Cannot determine model type for directory: {filepath}")
        else:
            raise ValueError(
                f"Cannot determine model type from extension: {ext}. "
                f"Supported: {cls.SKLEARN_EXTENSIONS | cls.TENSORFLOW_EXTENSIONS | cls.PYTORCH_EXTENSIONS | cls.ONNX_EXTENSIONS}"
            )
    
    @classmethod
    def _load_sklearn(cls, filepath: Path) -> SklearnModelWrapper:
        """Load a scikit-learn model."""
        logger.info(f"Loading sklearn model from {filepath}")

        # -----------------------------------------------------------------------
        # Inject DataCleaner into every plausible module namespace so that
        # joblib/pickle can resolve it regardless of where it was defined when
        # the model was trained (e.g. __main__, a training script, etc.).
        # -----------------------------------------------------------------------
        import types as _types
        _shim_names = [
            "__main__",
            "app.services.model_loader",
            "scripts.train_real_world_model_zoo",
            "scripts.train_benchmark_models",
            "backend.scripts.train_real_world_model_zoo",
        ]
        for _mod_name in _shim_names:
            if _mod_name not in sys.modules:
                sys.modules[_mod_name] = _types.ModuleType(_mod_name)
            if not hasattr(sys.modules[_mod_name], "DataCleaner"):
                sys.modules[_mod_name].DataCleaner = DataCleaner  # type: ignore[attr-defined]

        try:
            # Try joblib first (preferred method)
            model = joblib.load(filepath)
            logger.info("Model loaded successfully with joblib")
        except Exception as joblib_error:
            logger.warning(f"Joblib loading failed: {joblib_error}, trying custom unpickler")
            # Try custom unpickler for compatibility
            try:
                with open(filepath, 'rb') as f:
                    model = SklearnUnpickler(f).load()
                logger.info("Model loaded successfully with custom unpickler")
            except Exception as pickle_error:
                logger.error(f"Custom unpickler failed: {pickle_error}")
                # Last resort: standard pickle
                try:
                    with open(filepath, 'rb') as f:
                        model = pickle.load(f)
                    logger.info("Model loaded successfully with standard pickle")
                except Exception as final_error:
                    raise ValueError(
                        f"Failed to load sklearn model from {filepath}. "
                        f"Joblib error: {joblib_error}. "
                        f"Pickle error: {pickle_error}. "
                        f"Final error: {final_error}"
                    )
        
        return SklearnModelWrapper(model)
    
    @classmethod
    def _load_tensorflow(cls, filepath: Path) -> TensorFlowModelWrapper:
        """Load a TensorFlow/Keras model."""
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError(
                "TensorFlow is required to load .h5 models. "
                "Install with: pip install tensorflow"
            )
        
        model = tf.keras.models.load_model(filepath)
        return TensorFlowModelWrapper(model)
    
    @classmethod
    def _load_pytorch(cls, filepath: Path) -> PyTorchModelWrapper:
        """Load a PyTorch model."""
        try:
            import torch
        except ImportError:
            raise ImportError(
                "PyTorch is required to load .pt/.pth models. "
                "Install with: pip install torch"
            )
        
        model = torch.load(filepath, map_location='cpu')
        
        # Handle state_dict vs full model
        if isinstance(model, dict):
            raise ValueError(
                "Model file contains a state_dict, not a full model. "
                "Please provide the complete model or the model class for loading."
            )
        
        return PyTorchModelWrapper(model)
    
    @classmethod
    def _load_onnx(cls, filepath: Path) -> ONNXModelWrapper:
        """Load an ONNX model."""
        try:
            import onnxruntime as ort
        except ImportError:
            raise ImportError(
                "ONNX Runtime is required to load .onnx models. "
                "Install with: pip install onnxruntime"
            )
        
        session = ort.InferenceSession(str(filepath))
        return ONNXModelWrapper(session)
    
    @classmethod
    def _sanitize_for_json(cls, obj):
        """
        Recursively replace NaN/Infinity float values with None so the dict
        can be stored in PostgreSQL JSONB without raising:
            'invalid input syntax for type json: Token "NaN" is invalid'

        JSON (RFC 8259) does not support NaN or Infinity — only Python and JS do.
        PostgreSQL's JSONB strictly follows the standard, so we must convert them
        to null before insertion.
        """
        if isinstance(obj, float):
            if obj != obj or obj == float('inf') or obj == float('-inf'):  # NaN or ±Inf
                return None
            return obj
        if isinstance(obj, dict):
            return {k: cls._sanitize_for_json(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [cls._sanitize_for_json(v) for v in obj]
        return obj

    @classmethod
    def get_model_metadata(cls, wrapper: ModelWrapper) -> dict:
        """
        Extract metadata from a loaded model.
        
        Args:
            wrapper: A ModelWrapper instance
            
        Returns:
            Dictionary with model metadata (NaN/Inf values replaced with None
            so it is safe to store in PostgreSQL JSONB).
        """
        metadata = {
            "model_type": wrapper.model_type,
            "has_predict_proba": True,  # All our wrappers support this
        }
        
        if wrapper.feature_names:
            metadata["feature_names"] = wrapper.feature_names
            metadata["n_features"] = len(wrapper.feature_names)
        
        if wrapper.classes is not None:
            metadata["classes"] = wrapper.classes.tolist()
            metadata["n_classes"] = len(wrapper.classes)
        
        # For sklearn, try to get more info
        if wrapper.model_type == "sklearn" and hasattr(wrapper, 'raw_model'):
            raw = wrapper.raw_model
            metadata["model_class"] = type(raw).__name__
            
            # Get hyperparameters if available
            if hasattr(raw, 'get_params'):
                try:
                    params = raw.get_params()
                    # Filter out complex objects, keep only JSON-serialisable scalars
                    metadata["hyperparameters"] = {
                        k: v for k, v in params.items()
                        if isinstance(v, (int, float, str, bool, type(None)))
                    }
                except Exception:
                    pass
        
        # Sanitize NaN / Infinity before handing off to the DB layer.
        # PostgreSQL JSONB rejects these tokens even though Python's json module
        # can emit them.  Replace with None → JSON null.
        return cls._sanitize_for_json(metadata)

