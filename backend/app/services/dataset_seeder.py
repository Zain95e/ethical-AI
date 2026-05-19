"""
Benchmark Dataset Seeding Service.

This service loads pre-configured benchmark datasets into projects with
proper metadata and sensitive attribute configuration.
"""

import shutil
from pathlib import Path
from typing import List, Dict
from uuid import UUID
import logging

import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.dataset import Dataset
from app.models.project import Project
from app.models.audit_log import AuditLog, AuditAction, ResourceType
from app.config import settings

logger = logging.getLogger(__name__)


class BenchmarkDatasetSeeder:
    """
    Service for loading benchmark datasets into projects.

    Provides one-click loading of pre-configured benchmark datasets
    with automatic sensitive attribute detection and metadata.
    The datasets are the locally-trained ones stored under
    backend/dataset-models/datasets/.
    """

    # Absolute path to the locally trained datasets (processed versions)
    _BASE = Path(__file__).resolve().parent.parent.parent / "dataset-models" / "datasets" / "processed"

    # Dataset metadata configuration – 6 locally trained datasets
    BENCHMARK_DATASETS: Dict[str, Dict] = {
        "adult_income": {
            "name": "Adult Income (Logistic Regression)",
            "description": (
                "Census data predicting whether an adult earns >$50K/year. "
                "Classic fairness benchmark for Finance / Social Policy. "
                "Trained with Logistic Regression (StandardScaler pipeline). "
                "Accuracy: 82.3 %  |  Sensitive attribute: sex"
            ),
            "filename": "adult_income_processed.csv",
            "target_column": "income_binary",
            "sensitive_attributes": ["sex"],
            "key_features": ["age", "education_num", "hours_per_week", "capital_gain", "capital_loss", "sex_encoded", "fnlwgt"],
            "domain": "finance",
            "reference": "UCI Adult / Census Income Dataset (30 162 rows)",
            "model_key": "model_1_income_logreg",
            "model_type": "Logistic Regression",
            "accuracy": 0.8228,
        },
        "credit_default": {
            "name": "Credit Card Default (Random Forest)",
            "description": (
                "Taiwan credit-card dataset predicting payment default. "
                "Tests gender-based fairness in Banking / Credit Risk. "
                "Trained with Random Forest (150 trees, max_depth=8). "
                "Accuracy: 81.9 %  |  Sensitive attribute: SEX_label"
            ),
            "filename": "credit_default_processed.csv",
            "target_column": "default",
            "sensitive_attributes": ["SEX_label"],
            "key_features": ["LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE", "PAY_0", "PAY_2", "PAY_3", "BILL_AMT1", "PAY_AMT1"],
            "domain": "finance",
            "reference": "UCI Default of Credit Card Clients Dataset (30 000 rows)",
            "model_key": "model_2_credit_random_forest",
            "model_type": "Random Forest",
            "accuracy": 0.8185,
        },
        "compas_recidivism": {
            "name": "Recidivism Risk (Gradient Boosting)",
            "description": (
                "COMPAS recidivism dataset predicting 2-year reoffending risk. "
                "Replicates the algorithm studied for racial bias in Criminal Justice. "
                "Trained with Gradient Boosting (200 estimators, lr=0.05). "
                "Accuracy: 68.8 %  |  Sensitive attribute: race"
            ),
            "filename": "compas_recidivism_processed.csv",
            "target_column": "two_year_recid",
            "sensitive_attributes": ["race"],
            "key_features": ["age", "sex_enc", "juv_fel_count", "juv_misd_count", "juv_other_count", "priors_count", "charge_enc"],
            "domain": "criminal_justice",
            "reference": "ProPublica COMPAS Analysis (2016) – 7 214 rows",
            "model_key": "model_3_recidivism_gbm",
            "model_type": "Gradient Boosting",
            "accuracy": 0.6881,
        },
        "heart_disease": {
            "name": "Heart Disease (SVM)",
            "description": (
                "Cleveland Heart Disease dataset detecting cardiac disease presence. "
                "Tests sex and age disparities in Healthcare / Medical Diagnosis. "
                "Trained with SVM (RBF kernel, StandardScaler pipeline). "
                "Accuracy: 86.7 %  |  Sensitive attribute: sex_label"
            ),
            "filename": "heart_disease_processed.csv",
            "target_column": "target",
            "sensitive_attributes": ["sex_label"],
            "key_features": ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalch", "exang", "oldpeak", "slope", "ca", "thal"],
            "domain": "healthcare",
            "reference": "UCI Heart Disease Dataset (299 rows)",
            "model_key": "model_4_heart_svm",
            "model_type": "SVM (RBF kernel)",
            "accuracy": 0.8667,
        },
        "ibm_hr_attrition": {
            "name": "Employee Attrition (MLP Neural Network)",
            "description": (
                "IBM HR Analytics dataset predicting employee attrition. "
                "Tests gender and age fairness in HR / People Analytics. "
                "Trained with MLP Neural Network (128→64→32 ReLU, StandardScaler pipeline). "
                "Accuracy: 86.7 %  |  Sensitive attribute: Gender"
            ),
            "filename": "ibm_hr_attrition_processed.csv",
            "target_column": "Attrition_binary",
            "sensitive_attributes": ["Gender"],
            "key_features": ["Age", "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome", "NumCompaniesWorked", "OverTime_enc", "PerformanceRating", "RelationshipSatisfaction", "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole", "YearsSinceLastPromotion"],
            "domain": "employment",
            "reference": "IBM HR Analytics Employee Attrition Dataset (1 470 rows)",
            "model_key": "model_5_attrition_mlp",
            "model_type": "MLP Neural Network",
            "accuracy": 0.8673,
        },
        "student_performance": {
            "name": "Student Pass/Fail (Decision Tree)",
            "description": (
                "Portuguese student performance dataset predicting pass/fail outcomes. "
                "Tests gender and urban/rural fairness in Education / Academic Performance. "
                "Trained with Decision Tree (max_depth=6, balanced class weights). "
                "Accuracy: 82.3 %  |  Sensitive attribute: sex"
            ),
            "filename": "student_performance_processed.csv",
            "target_column": "pass_fail",
            "sensitive_attributes": ["sex"],
            "key_features": ["age", "sex_enc", "address_enc", "Medu", "Fedu", "traveltime", "studytime", "failures", "famsup_enc", "paid_enc", "internet_enc", "romantic_enc", "higher_enc", "freetime", "goout", "Dalc", "Walc", "health", "absences", "G1", "G2"],
            "domain": "education",
            "reference": "UCI Student Performance Dataset (395 rows)",
            "model_key": "model_6_student_decision_tree",
            "model_type": "Decision Tree",
            "accuracy": 0.8228,
        },
    }
    
    def __init__(self):
        """Initialize the seeder. Datasets live in the class-level _BASE directory."""
        # Ensure the source directory exists (read-only from the app's perspective)
        self.benchmark_dir = self._BASE
        self.benchmark_dir.mkdir(parents=True, exist_ok=True)
    
    async def seed_benchmark_datasets(
        self,
        project_id: UUID,
        dataset_key: str,
        db: AsyncSession,
        user_id: UUID
    ) -> Dataset:
        """
        Load a single benchmark dataset into a project.
        
        Args:
            project_id: Target project UUID
            dataset_key: Key identifying the benchmark dataset.
                Valid options: "adult_income", "credit_default", "compas_recidivism",
                               "heart_disease", "ibm_hr_attrition", "student_performance"
            db: Database session
            user_id: User performing the operation
            
        Returns:
            Created Dataset model instance
            
        Raises:
            ValueError: If dataset_key is invalid
            FileNotFoundError: If dataset file doesn't exist
        """
        # Validate dataset key
        if dataset_key not in self.BENCHMARK_DATASETS:
            raise ValueError(
                f"Invalid dataset key: {dataset_key}. "
                f"Valid options: {list(self.BENCHMARK_DATASETS.keys())}"
            )
        
        # Get dataset metadata
        metadata = self.BENCHMARK_DATASETS[dataset_key]

        # Prevent duplicate dataset names in the same project.
        existing_dataset_result = await db.execute(
            select(Dataset.id).where(
                Dataset.project_id == project_id,
                func.lower(Dataset.name) == metadata["name"].lower(),
            )
        )
        if existing_dataset_result.scalar_one_or_none() is not None:
            raise ValueError(
                f"Dataset with name '{metadata['name']}' already exists in this project"
            )
        
        # Verify project exists
        result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.deleted_at.is_(None)
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError(f"Project not found: {project_id}")
        
        # Load and profile the dataset
        source_path = self.benchmark_dir / metadata["filename"]
        if not source_path.exists():
            raise FileNotFoundError(
                f"Dataset file not found: {source_path}. "
                f"Expected filename: {metadata['filename']}"
            )
        
        # Read dataset to get profiling information
        df = pd.read_csv(source_path)
        
        # Create upload directory for this project
        upload_dir = Path(settings.upload_dir) / "datasets" / str(project_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy file to uploads directory
        dest_filename = f"{dataset_key}_{metadata['filename']}"
        dest_path = upload_dir / dest_filename
        shutil.copy2(source_path, dest_path)
        
        # Profile the dataset
        profile_data = self._profile_dataset(df)
        
        # Create dataset record
        dataset = Dataset(
            project_id=project_id,
            name=metadata["name"],
            description=metadata["description"],
            file_path=str(dest_path.resolve()),
            row_count=len(df),
            column_count=len(df.columns),
            columns=df.columns.tolist(),
            sensitive_attributes=metadata["sensitive_attributes"],
            target_column=metadata["target_column"],
            profile_data=profile_data,
            uploaded_by_id=user_id
        )
        
        db.add(dataset)
        
        # Create audit log
        # FIX: Changed AuditAction.CREATE to DATASET_UPLOAD (correct enum value)
        audit_log = AuditLog(
            user_id=user_id,
            action=AuditAction.DATASET_UPLOAD,
            resource_type=ResourceType.DATASET,
            resource_id=dataset.id,
            details={
                "dataset_name": metadata["name"],
                "dataset_key": dataset_key,
                "domain": metadata["domain"],
                "reference": metadata["reference"],
                "is_benchmark": True
            }
        )
        db.add(audit_log)
        
        await db.commit()
        await db.refresh(dataset)
        
        logger.info(
            f"Loaded benchmark dataset '{dataset_key}' into project {project_id}. "
            f"Dataset ID: {dataset.id}, Rows: {dataset.row_count}"
        )
        
        return dataset
    
    async def seed_all_datasets(
        self,
        project_id: UUID,
        db: AsyncSession,
        user_id: UUID
    ) -> List[Dataset]:
        """
        Load all benchmark datasets into a project.
        
        Args:
            project_id: Target project UUID
            db: Database session
            user_id: User performing the operation
            
        Returns:
            List of created Dataset model instances
        """
        datasets = []
        
        for dataset_key in self.BENCHMARK_DATASETS.keys():
            try:
                dataset = await self.seed_benchmark_datasets(
                    project_id=project_id,
                    dataset_key=dataset_key,
                    db=db,
                    user_id=user_id
                )
                datasets.append(dataset)
            except Exception as e:
                logger.error(f"Failed to load dataset '{dataset_key}': {str(e)}")
                # Continue with other datasets even if one fails
                continue
        
        return datasets
    
    def get_available_datasets(self) -> Dict[str, Dict]:
        """
        Get metadata for all available benchmark datasets.
        
        Returns:
            Dictionary mapping dataset keys to metadata
        """
        datasets: Dict[str, Dict] = {}
        for key, metadata in self.BENCHMARK_DATASETS.items():
            expected_path = self.benchmark_dir / metadata["filename"]
            datasets[key] = {
                **metadata,
                "file_exists": expected_path.exists(),
                "expected_path": str(expected_path),
            }
        return datasets

    def get_required_dataset_files(self) -> List[Dict[str, str]]:
        """
        Return expected benchmark dataset files and target locations.
        """
        required_files: List[Dict[str, str]] = []
        for key, metadata in self.BENCHMARK_DATASETS.items():
            required_files.append(
                {
                    "dataset_key": key,
                    "filename": metadata["filename"],
                    "expected_path": str(self.benchmark_dir / metadata["filename"]),
                }
            )
        return required_files
    
    def _profile_dataset(self, df: pd.DataFrame) -> Dict:
        """
        Generate profiling data for a dataset.
        
        Args:
            df: Pandas DataFrame
            
        Returns:
            Dictionary containing profiling information
        """
        profile = {
            "column_types": {},
            "missing_values": {},
            "unique_counts": {},
            "value_counts": {}
        }
        
        for col in df.columns:
            # Data type
            profile["column_types"][col] = str(df[col].dtype)
            
            # Missing values
            missing_count = int(df[col].isna().sum())
            profile["missing_values"][col] = missing_count
            
            # Unique values
            unique_count = int(df[col].nunique())
            profile["unique_counts"][col] = unique_count
            
            # For categorical columns with few unique values, store value counts
            if unique_count <= 20:
                value_counts = df[col].value_counts().head(20).to_dict()
                # Convert keys and values to native Python types
                profile["value_counts"][col] = {
                    str(k): int(v) for k, v in value_counts.items()
                }
        
        return profile
