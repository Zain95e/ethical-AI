# Models router - ML model upload and management

import os
import shutil
from typing import List, Optional
from uuid import UUID
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..dependencies import get_current_user
from ..config import settings
from ..models.user import User
from ..models.project import Project
from ..models.ml_model import MLModel, ModelType
from ..models.audit_log import AuditLog, AuditAction, ResourceType
from ..services.model_loader import UniversalModelLoader
from ..middleware.upload_security import validate_upload_file, safe_filename
from ..middleware.logging_config import get_logger

logger = get_logger("routers.models")

router = APIRouter(prefix="/models", tags=["models"])

ALLOWED_MODEL_EXTENSIONS = {".pkl", ".joblib", ".pickle", ".h5", ".keras", ".pt", ".pth", ".onnx"}


# Pydantic models for responses
from pydantic import BaseModel

class ModelResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    file_path: str
    file_size: int
    model_type: str
    model_metadata: dict
    version: str
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


def get_model_type_from_extension(filename: str) -> ModelType:
    """Determine model type from file extension."""
    ext = Path(filename).suffix.lower()
    mapping = {
        '.pkl': ModelType.SKLEARN,
        '.joblib': ModelType.SKLEARN,
        '.pickle': ModelType.SKLEARN,
        '.h5': ModelType.TENSORFLOW,
        '.keras': ModelType.TENSORFLOW,
        '.pt': ModelType.PYTORCH,
        '.pth': ModelType.PYTORCH,
        '.onnx': ModelType.ONNX,
    }
    return mapping.get(ext, ModelType.UNKNOWN)


@router.post("/upload", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(...),
    project_id: UUID = Form(...),
    description: Optional[str] = Form(None),
    version: str = Form("1.0.0"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an ML model file.
    
    Supported formats:
    - scikit-learn: .pkl, .joblib, .pickle
    - TensorFlow/Keras: .h5, .keras
    - PyTorch: .pt, .pth
    - ONNX: .onnx
    """
    # Verify project exists and user has access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role.value != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    # Validate file using security utility
    ext = validate_upload_file(file, allowed_extensions=list(ALLOWED_MODEL_EXTENSIONS), label="model")

    if not name.strip():
        raise HTTPException(status_code=400, detail="Model name cannot be empty")
    
    # Create upload directory
    upload_dir = Path(settings.upload_dir) / "models" / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename (sanitised)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sanitised = safe_filename(name)
    safe_name = "".join(c for c in sanitised if c.isalnum() or c in "._-").strip("._-")
    if not safe_name:
        safe_name = "model"
    filename = f"{safe_name}_{timestamp}{ext}"
    file_path = upload_dir / filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    try:
        # Get file size and validate limits
        file_size = os.path.getsize(file_path)
        if file_size <= 0:
            raise HTTPException(status_code=400, detail="Uploaded model file is empty")

        max_size_bytes = settings.max_upload_size_mb * 1024 * 1024
        if file_size > max_size_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Model file exceeds maximum size of {settings.max_upload_size_mb} MB"
            )

        # Strict validation: model must be loadable at upload time
        try:
            loaded_model = UniversalModelLoader.load(str(file_path))
            model_metadata = UniversalModelLoader.get_model_metadata(loaded_model)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Model file is invalid or not loadable for the declared format: {str(e)}"
            )

    except HTTPException:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to validate uploaded model: {str(e)}")
    
    # Create database record
    ml_model = MLModel(
        project_id=project_id,
        name=name,
        description=description,
        file_path=str(file_path),
        file_size=file_size,
        model_type=get_model_type_from_extension(file.filename),
        model_metadata=model_metadata,
        version=version,
        uploaded_by_id=current_user.id
    )
    
    db.add(ml_model)
    await db.commit()
    await db.refresh(ml_model)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.MODEL_UPLOAD,
        resource_type=ResourceType.MODEL,
        resource_id=ml_model.id,
        details={
            "model_name": name,
            "file_size": file_size,
            "model_type": ml_model.model_type if isinstance(ml_model.model_type, str) else ml_model.model_type.value
        }
    )
    db.add(audit)
    await db.commit()
    
    logger.info(
        "Model uploaded: name=%s project=%s size=%d type=%s",
        name, project_id, file_size,
        ml_model.model_type if isinstance(ml_model.model_type, str) else ml_model.model_type.value,
    )
    
    return ModelResponse(
        id=ml_model.id,
        project_id=ml_model.project_id,
        name=ml_model.name,
        description=ml_model.description,
        file_path=ml_model.file_path,
        file_size=ml_model.file_size,
        model_type=ml_model.model_type if isinstance(ml_model.model_type, str) else ml_model.model_type.value,
        model_metadata=ml_model.model_metadata or {},
        version=ml_model.version,
        uploaded_at=ml_model.uploaded_at
    )


@router.get("/project/{project_id}", response_model=List[ModelResponse])
async def list_models(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all models in a project."""
    # Verify project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role.value != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get models
    result = await db.execute(
        select(MLModel).where(MLModel.project_id == project_id).order_by(MLModel.uploaded_at.desc())
    )
    models = result.scalars().all()
    
    return [
        ModelResponse(
            id=m.id,
            project_id=m.project_id,
            name=m.name,
            description=m.description,
            file_path=m.file_path,
            file_size=m.file_size,
            model_type=m.model_type if isinstance(m.model_type, str) else m.model_type.value,
            model_metadata=m.model_metadata or {},
            version=m.version,
            uploaded_at=m.uploaded_at
        )
        for m in models
    ]


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(
    model_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific model by ID."""
    result = await db.execute(
        select(MLModel).where(MLModel.id == model_id)
    )
    model = result.scalar_one_or_none()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Check project access
    result = await db.execute(
        select(Project).where(Project.id == model.project_id)
    )
    project = result.scalar_one_or_none()
    
    if current_user.role.value != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return ModelResponse(
        id=model.id,
        project_id=model.project_id,
        name=model.name,
        description=model.description,
        file_path=model.file_path,
        file_size=model.file_size,
        model_type=model.model_type if isinstance(model.model_type, str) else model.model_type.value,
        model_metadata=model.model_metadata or {},
        version=model.version,
        uploaded_at=model.uploaded_at
    )


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a model."""
    result = await db.execute(
        select(MLModel).where(MLModel.id == model_id)
    )
    model = result.scalar_one_or_none()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Check project access
    result = await db.execute(
        select(Project).where(Project.id == model.project_id)
    )
    project = result.scalar_one_or_none()
    
    if current_user.role.value != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete file
    try:
        if os.path.exists(model.file_path):
            os.remove(model.file_path)
    except Exception:
        pass  # Continue even if file deletion fails
    
    # Delete record
    await db.delete(model)
    await db.commit()


# ---------------------------------------------------------------------------
# Benchmark model catalogue (locally trained models)
# ---------------------------------------------------------------------------

# Resolve path to dataset-models/ relative to this file
_MODELS_BASE = Path(__file__).resolve().parent.parent.parent / "dataset-models" / "trained_models"

BENCHMARK_MODELS = {
    "model_1_income_hgbm": {
        "name": "Adult Income Predictor",
        "description": (
            "Algorithm: HistGradientBoosting (400 iter, lr=0.05, depth=6, balanced). "
            "Predicts whether a US adult earns >$50K/year. "
            "Trained on 32 561 census records (UCI Adult Dataset). "
            "Accuracy: 82.7% | AUC-ROC: 0.922 | CV AUC: 0.925 +/- 0.002. "
            "Target column: income_binary (0 = <=50K, 1 = >50K). "
            "Sensitive feature: sex (Male / Female). "
            "Bias warning: Known gender bias — women are predicted to earn >$50K at roughly half the rate of men, "
            "reflecting real-world wage gap patterns in the 1994 census data. "
            "Expect fairness metrics (demographic parity, equal opportunity) to flag this dataset."
        ),
        "filename": "model_1_income_hgbm.joblib",
        "model_type": "sklearn",
        "target_column": "income_binary",
        "sensitive_attributes": ["sex"],
        "feature_columns": ["age", "education.num", "hours.per.week", "capital.gain", "capital.loss", "fnlwgt", "sex_encoded", "workclass_enc", "marital_enc", "occupation_enc"],
        "domain": "Finance / Social Policy",
        "accuracy": 0.8268,
        "auc_roc": 0.9224,
        "algorithm": "HistGradientBoostingClassifier",
        "dataset_key": "adult_income",
    },
    "model_2_credit_rf": {
        "name": "Credit Card Default Classifier",
        "description": (
            "Algorithm: Random Forest (300 trees, depth=10, balanced class weights). "
            "Predicts whether a credit card client will default next month. "
            "Trained on 30 000 Taiwan credit records using full 6-month payment history. "
            "Accuracy: 77.3% | AUC-ROC: 0.776 | CV AUC: 0.783 +/- 0.005. "
            "Target column: default (0 = paid, 1 = defaulted). "
            "Sensitive feature: SEX_label (Male / Female). "
            "Bias note: Model primarily uses payment history (PAY_0-PAY_6). "
            "Gender (SEX) has low feature importance — fairness metrics typically pass. "
            "Good example of a relatively unbiased financial model."
        ),
        "filename": "model_2_credit_rf.joblib",
        "model_type": "sklearn",
        "target_column": "default",
        "sensitive_attributes": ["SEX_label"],
        "feature_columns": ["LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE", "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6", "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6", "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6"],
        "domain": "Banking / Credit Risk",
        "accuracy": 0.7732,
        "auc_roc": 0.7764,
        "algorithm": "Random Forest",
        "dataset_key": "credit_default",
    },
    "model_3_recidivism_logreg": {
        "name": "Recidivism Risk Assessor",
        "description": (
            "Algorithm: Logistic Regression with ElasticNet regularisation (L1+L2, C=0.5, balanced). "
            "Interpretable model intentionally chosen for high-stakes criminal justice decisions. "
            "Predicts 2-year reoffending risk using ProPublica COMPAS dataset. "
            "Trained on 6 172 defendant records. "
            "Accuracy: 67.6% | AUC-ROC: 0.737 | CV AUC: 0.731 +/- 0.023. "
            "Target column: Two_yr_Recidivism (0 = did not reoffend, 1 = reoffended within 2 years). "
            "Sensitive feature: race (African-American / Caucasian / Hispanic / Asian / Other). "
            "Bias warning: DOCUMENTED RACIAL BIAS — African-Americans make up 51.4% of this dataset "
            "and are flagged at significantly higher rates. This is the dataset behind ProPublica's "
            "landmark 2016 investigation 'Machine Bias'. Expect fairness metrics to FAIL on race."
        ),
        "filename": "model_3_recidivism_logreg.pkl",
        "model_type": "sklearn",
        "target_column": "Two_yr_Recidivism",
        "sensitive_attributes": ["race"],
        "feature_columns": ["Number_of_Priors", "Age_Above_FourtyFive", "Age_Below_TwentyFive", "Female", "Misdemeanor", "score_factor"],
        "domain": "Criminal Justice",
        "accuracy": 0.6761,
        "auc_roc": 0.7368,
        "algorithm": "Logistic Regression (ElasticNet)",
        "dataset_key": "compas_recidivism",
    },
    "model_4_heart_gbm": {
        "name": "Heart Disease Detector",
        "description": (
            "Algorithm: Gradient Boosting (300 shallow trees, depth=3, lr=0.05, subsample=0.8). "
            "Detects presence of cardiac disease from clinical measurements. "
            "Trained on 299 Cleveland Heart Disease records (UCI). "
            "Accuracy: 81.7% | AUC-ROC: 0.897 | CV AUC: 0.894 +/- 0.026. "
            "Target column: target (0 = no disease, 1 = disease present). "
            "Sensitive feature: sex_label (Male / Female). "
            "Bias note: Heart disease has known clinical sex differences — symptoms and presentation "
            "differ between men and women. Mixed fairness results expected: some metrics may pass, "
            "others may flag sex-based disparities in detection rates."
        ),
        "filename": "model_4_heart_gbm.pkl",
        "model_type": "sklearn",
        "target_column": "target",
        "sensitive_attributes": ["sex_label"],
        "feature_columns": ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalch", "exang", "oldpeak", "slope", "ca", "thal"],
        "domain": "Healthcare / Medical Diagnosis",
        "accuracy": 0.8167,
        "auc_roc": 0.8973,
        "algorithm": "Gradient Boosting",
        "dataset_key": "heart_disease",
    },
    "model_5_attrition_mlp": {
        "name": "Employee Attrition Predictor",
        "description": (
            "Algorithm: MLP Neural Network (256→128→64→32 ReLU, L2 alpha=0.01, adaptive LR, early stopping). "
            "Predicts whether an employee will leave the company. "
            "Trained on 1 470 IBM HR Analytics records. "
            "Accuracy: 86.7% | AUC-ROC: 0.764 | CV AUC: 0.740 +/- 0.098. "
            "Target column: Attrition_binary (0 = stayed, 1 = left). "
            "Sensitive feature: Gender (Male / Female). "
            "Bias note: IBM's dataset is synthetic and relatively balanced by gender — "
            "fairness metrics typically pass. Good baseline for demonstrating a fair model. "
            "Note: Only 16% of employees leave (class imbalance), so class_weight=balanced was applied."
        ),
        "filename": "model_5_attrition_mlp.pkl",
        "model_type": "sklearn",
        "target_column": "Attrition_binary",
        "sensitive_attributes": ["Gender"],
        "feature_columns": ["Age", "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "Gender_enc", "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome", "NumCompaniesWorked", "OverTime_enc", "PerformanceRating", "RelationshipSatisfaction", "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole", "YearsSinceLastPromotion"],
        "domain": "HR / People Analytics",
        "accuracy": 0.8673,
        "auc_roc": 0.7635,
        "algorithm": "MLP Neural Network",
        "dataset_key": "ibm_hr_attrition",
    },
}


@router.get("/benchmark/available")
async def get_available_benchmark_models():
    """
    Get list of available benchmark models with metadata.

    Returns metadata for all 6 locally trained benchmark models including
    their domain, target column, sensitive attributes, accuracy, and algorithm.
    """
    result = {}
    for key, meta in BENCHMARK_MODELS.items():
        model_path = _MODELS_BASE / meta["filename"]
        result[key] = {
            **meta,
            "file_exists": model_path.exists(),
            "file_size_bytes": model_path.stat().st_size if model_path.exists() else 0,
        }
    return {
        "models": result,
        "count": len(result),
    }


@router.post(
    "/project/{project_id}/load-benchmark",
    response_model=ModelResponse,
    status_code=status.HTTP_201_CREATED,
)
async def load_benchmark_model(
    project_id: UUID,
    model_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import a pre-trained benchmark model into a project.

    Available model keys:
    - ``model_1_income_hgbm``        – Adult Income, HistGradientBoosting (AUC 0.922)
    - ``model_2_credit_rf``          – Credit Card Default, Random Forest (AUC 0.776)
    - ``model_3_recidivism_logreg``  – Recidivism Risk, Logistic Regression ElasticNet (AUC 0.737)
    - ``model_4_heart_gbm``          – Heart Disease, Gradient Boosting (AUC 0.897)
    - ``model_5_attrition_mlp``      – Employee Attrition, MLP Neural Network (AUC 0.764)
    """
    if model_key not in BENCHMARK_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown model key '{model_key}'. "
                   f"Valid options: {list(BENCHMARK_MODELS.keys())}",
        )

    meta = BENCHMARK_MODELS[model_key]

    # Verify project + access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role.value != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # ── Duplicate-name guard ─────────────────────────────────────────
    existing = await db.execute(
        select(MLModel.id).where(
            MLModel.project_id == project_id,
            func.lower(MLModel.name) == meta["name"].lower(),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail=f"A model named '{meta['name']}' already exists in this project.",
        )

    source_path = _MODELS_BASE / meta["filename"]
    if not source_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Benchmark model file not found on server: {meta['filename']}",
        )

    # Copy to project upload dir with a unique timestamped filename so that
    # even if the same benchmark is re-imported later it gets its own file
    # and deleting one record never breaks another.
    upload_dir = Path(settings.upload_dir) / "models" / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = Path(meta["filename"]).stem
    suffix = Path(meta["filename"]).suffix
    unique_filename = f"{stem}_{timestamp}{suffix}"
    dest_path = upload_dir / unique_filename
    shutil.copy2(source_path, dest_path)

    file_size = dest_path.stat().st_size

    # Load and inspect
    try:
        loaded_model = UniversalModelLoader.load(str(dest_path))
        model_metadata = UniversalModelLoader.get_model_metadata(loaded_model)
    except Exception as exc:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Benchmark model file could not be loaded: {exc}",
        )

    model_type = get_model_type_from_extension(meta["filename"])

    ml_model = MLModel(
        project_id=project_id,
        name=meta["name"],
        description=meta["description"],
        file_path=str(dest_path.resolve()),
        file_size=file_size,
        model_type=model_type,
        model_metadata={
            **model_metadata,
            "benchmark": True,
            "model_key": model_key,
            "target_column": meta["target_column"],
            "sensitive_attributes": meta["sensitive_attributes"],
            "feature_columns": meta["feature_columns"],
            "domain": meta["domain"],
            "accuracy": meta["accuracy"],
            "algorithm": meta["algorithm"],
            "dataset_key": meta["dataset_key"],
        },
        version="1.0.0",
        uploaded_by_id=current_user.id,
    )
    db.add(ml_model)

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.MODEL_UPLOAD,
        resource_type=ResourceType.MODEL,
        resource_id=ml_model.id,
        details={
            "model_name": meta["name"],
            "model_key": model_key,
            "is_benchmark": True,
            "domain": meta["domain"],
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(ml_model)

    logger.info(
        "Benchmark model imported: key=%s project=%s model_id=%s",
        model_key, project_id, ml_model.id,
    )

    return ModelResponse(
        id=ml_model.id,
        project_id=ml_model.project_id,
        name=ml_model.name,
        description=ml_model.description,
        file_path=ml_model.file_path,
        file_size=ml_model.file_size,
        model_type=ml_model.model_type if isinstance(ml_model.model_type, str) else ml_model.model_type.value,
        model_metadata=ml_model.model_metadata or {},
        version=ml_model.version,
        uploaded_at=ml_model.uploaded_at,
    )
