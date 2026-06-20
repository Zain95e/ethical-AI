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

    # Dataset metadata configuration – 5 locally trained datasets
    BENCHMARK_DATASETS: Dict[str, Dict] = {
        "adult_income": {
            "name": "Adult Income — for Adult Income Predictor (HistGradientBoosting)",
            "description": (
                "Paired model: Adult Income Predictor | Algorithm: HistGradientBoosting. "
                "UCI Census Income dataset — 32 561 US adults from the 1994 census. "
                "TARGET COLUMN: income_binary (0 = earns <=50K/year, 1 = earns >50K/year). "
                "SENSITIVE FEATURE: sex (values: Male, Female). "
                "Other quasi-identifiers: age, marital_enc, occupation_enc. "
                "Accuracy: 82.7% | AUC-ROC: 0.922. "
                "BIAS WARNING: Known gender pay gap — women predicted to earn >50K at "
                "roughly half the rate of men. Demographic parity and equal opportunity "
                "metrics will likely FAIL. Use this dataset to demonstrate how the platform "
                "detects real-world gender bias encoded in historical data."
            ),
            "filename": "adult_income_processed.csv",
            "target_column": "income_binary",
            "sensitive_attributes": ["sex"],
            "key_features": ["age", "education.num", "hours.per.week", "capital.gain", "capital.loss", "fnlwgt", "sex_encoded", "workclass_enc", "marital_enc", "occupation_enc"],
            "domain": "finance",
            "reference": "UCI Adult / Census Income Dataset (32 561 rows)",
            "model_key": "model_1_income_hgbm",
            "model_type": "HistGradientBoosting",
            "accuracy": 0.8268,
            "bias_level": "HIGH",
        },
        "credit_default": {
            "name": "Credit Card Default — for Credit Default Classifier (Random Forest)",
            "description": (
                "Paired model: Credit Card Default Classifier | Algorithm: Random Forest (300 trees). "
                "Taiwan credit-card payment data — 30 000 clients, full 6-month payment history. "
                "TARGET COLUMN: default (0 = paid on time, 1 = defaulted next month). "
                "SENSITIVE FEATURE: SEX_label (values: Male, Female). "
                "Other quasi-identifiers: AGE, EDUCATION, MARRIAGE. "
                "Payment history columns: PAY_0 to PAY_6 (-1=paid early, 0=on time, 1-9=months late). "
                "Bill amounts: BILL_AMT1-6. Payment amounts: PAY_AMT1-6. "
                "Accuracy: 77.3% | AUC-ROC: 0.776. "
                "BIAS NOTE: Model relies on payment behaviour, not demographics. "
                "Gender has very low feature importance (confirmed by SHAP). "
                "Fairness metrics typically PASS — good example of a relatively fair model."
            ),
            "filename": "credit_default_processed.csv",
            "target_column": "default",
            "sensitive_attributes": ["SEX_label"],
            "key_features": ["LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE", "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6", "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6", "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6"],
            "domain": "finance",
            "reference": "UCI Default of Credit Card Clients Dataset (30 000 rows)",
            "model_key": "model_2_credit_rf",
            "model_type": "Random Forest",
            "accuracy": 0.7732,
            "bias_level": "LOW",
        },
        "compas_recidivism": {
            "name": "COMPAS Recidivism — for Recidivism Risk Assessor (Logistic Regression)",
            "description": (
                "Paired model: Recidivism Risk Assessor | Algorithm: Logistic Regression (ElasticNet). "
                "ProPublica COMPAS dataset — 6 172 Florida defendants, 2013-2014. "
                "TARGET COLUMN: Two_yr_Recidivism (0 = did not reoffend, 1 = reoffended within 2 years). "
                "SENSITIVE FEATURE: race (values: African-American, Caucasian, Hispanic, Asian, Native American, Other). "
                "Other sensitive attribute: Female (0=Male, 1=Female). "
                "Features: Number_of_Priors, Age_Above_FourtyFive, Age_Below_TwentyFive, Misdemeanor, score_factor. "
                "Accuracy: 67.6% | AUC-ROC: 0.737. "
                "DOCUMENTED RACIAL BIAS: African-Americans represent 51.4% of dataset and are "
                "flagged for recidivism at significantly higher rates. This is the dataset behind "
                "ProPublica's 2016 investigation 'Machine Bias'. "
                "Fairness metrics on race will FAIL. This is intentional — use it to show the "
                "platform detecting documented real-world algorithmic discrimination."
            ),
            "filename": "compas_recidivism_processed.csv",
            "target_column": "Two_yr_Recidivism",
            "sensitive_attributes": ["race"],
            "key_features": ["Number_of_Priors", "Age_Above_FourtyFive", "Age_Below_TwentyFive", "Female", "Misdemeanor", "score_factor"],
            "domain": "criminal_justice",
            "reference": "ProPublica COMPAS Analysis 2016 — 6 172 rows",
            "model_key": "model_3_recidivism_logreg",
            "model_type": "Logistic Regression",
            "accuracy": 0.6761,
            "bias_level": "CRITICAL",
        },
        "heart_disease": {
            "name": "Heart Disease — for Heart Disease Detector (Gradient Boosting)",
            "description": (
                "Paired model: Heart Disease Detector | Algorithm: Gradient Boosting (300 trees, depth=3). "
                "Cleveland Heart Disease dataset — 299 patients from the UCI repository. "
                "TARGET COLUMN: target (0 = no cardiac disease, 1 = disease present). "
                "SENSITIVE FEATURE: sex_label (values: Male, Female). "
                "Other quasi-identifiers: age, age_group (Under40/40-55/55-70/Over70). "
                "Clinical features: cp (chest pain type), trestbps (resting BP), chol (cholesterol), "
                "thalch (max heart rate), exang (exercise-induced angina), oldpeak, ca, thal. "
                "Accuracy: 81.7% | AUC-ROC: 0.897. "
                "BIAS NOTE: Heart disease has real clinical sex differences — symptoms present "
                "differently in men and women. Expect mixed fairness results: some metrics may pass, "
                "others may flag sex-based detection disparities. Small dataset (299 rows) — "
                "results may have higher variance."
            ),
            "filename": "heart_disease_processed.csv",
            "target_column": "target",
            "sensitive_attributes": ["sex_label"],
            "key_features": ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalch", "exang", "oldpeak", "slope", "ca", "thal"],
            "domain": "healthcare",
            "reference": "UCI Heart Disease Dataset — Cleveland (299 rows)",
            "model_key": "model_4_heart_gbm",
            "model_type": "Gradient Boosting",
            "accuracy": 0.8167,
            "bias_level": "MEDIUM",
        },
        "ibm_hr_attrition": {
            "name": "IBM HR Attrition — for Employee Attrition Predictor (MLP Neural Network)",
            "description": (
                "Paired model: Employee Attrition Predictor | Algorithm: MLP Neural Network (256→128→64→32). "
                "IBM HR Analytics synthetic dataset — 1 470 employees. "
                "TARGET COLUMN: Attrition_binary (0 = employee stayed, 1 = employee left). "
                "SENSITIVE FEATURE: Gender (values: Male, Female). "
                "Other quasi-identifiers: Age, MaritalStatus, Department. "
                "Key features: MonthlyIncome, OverTime_enc, JobSatisfaction, YearsAtCompany, "
                "WorkLifeBalance, JobLevel, TotalWorkingYears. "
                "Accuracy: 86.7% | AUC-ROC: 0.764. "
                "BIAS NOTE: Synthetic dataset — IBM designed it to be relatively balanced. "
                "Only ~16% attrition rate (class imbalance handled with balanced class weights). "
                "Fairness metrics typically PASS on gender. "
                "Good baseline for demonstrating what a FAIR model looks like in contrast to COMPAS."
            ),
            "filename": "ibm_hr_attrition_processed.csv",
            "target_column": "Attrition_binary",
            "sensitive_attributes": ["Gender"],
            "key_features": ["Age", "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "Gender_enc", "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome", "NumCompaniesWorked", "OverTime_enc", "PerformanceRating", "RelationshipSatisfaction", "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole", "YearsSinceLastPromotion"],
            "domain": "employment",
            "reference": "IBM HR Analytics Employee Attrition Dataset (1 470 rows)",
            "model_key": "model_5_attrition_mlp",
            "model_type": "MLP Neural Network",
            "accuracy": 0.8673,
            "bias_level": "LOW",
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
