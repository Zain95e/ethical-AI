import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.dataset import Dataset
from app.routers.validation import FairnessValidator
import pandas as pd
import numpy as np

async def main():
    df = pd.read_csv("data/adult.csv")
    
    def _to_binary(series: pd.Series) -> np.ndarray:
        if series.dtype == 'object' or series.dtype.name == 'category':
            return (series.astype(str).str.contains('>|high|yes|true|1|approved', case=False, regex=True)).astype(int).values
        arr = series.values
        if not np.all(np.isin(arr, [0, 1])):
            return (arr > 0.5).astype(int)
        return arr.astype(int)

    # test 1: sensitive = income
    print("Test 1: Sensitive = income, Pred = income")
    y_pred = _to_binary(df['income'])
    y_true = _to_binary(df['income'])
    sensitive = df['income'].values
    validator = FairnessValidator(y_true=y_true, y_pred=y_pred, sensitive_features=sensitive)
    report = validator.validate_all(thresholds={"demographic_parity_ratio": 0.8}, selected_metrics=["demographic_parity_ratio"])
    print(report.metrics[0].by_group)
    print("Value:", report.metrics[0].overall_value)

    # test 2: sensitive = sex
    print("\nTest 2: Sensitive = sex, Pred = income")
    sensitive = df['sex'].values
    validator = FairnessValidator(y_true=y_true, y_pred=y_pred, sensitive_features=sensitive)
    report = validator.validate_all(thresholds={"demographic_parity_ratio": 0.8}, selected_metrics=["demographic_parity_ratio"])
    print(report.metrics[0].by_group)
    print("Value:", report.metrics[0].overall_value)

asyncio.run(main())
