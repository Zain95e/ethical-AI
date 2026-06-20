"""
train.py — 5 Production-Quality ML Models
==========================================
Trains 5 real classifiers with:
  - Stratified 5-fold cross-validation (AUC-ROC scoring)
  - Proper hyperparameters (not sklearn defaults)
  - Class imbalance handling (class_weight='balanced')
  - Full metrics: Accuracy, F1, AUC-ROC per model
  - Processed CSVs ready to upload to the platform

Column names are matched to the ACTUAL files on disk.

Run from backend/dataset-models/:
  python train.py
"""

import os
import json
import pickle
import warnings

import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
    HistGradientBoostingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_val_score,
)
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    roc_auc_score,
    classification_report,
)

warnings.filterwarnings("ignore")

os.makedirs("trained_models", exist_ok=True)
os.makedirs("datasets/processed", exist_ok=True)

metadata = {}
CV = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)


# ─────────────────────────────────────────────────────────────────────────────
# SHARED HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def evaluate(name, model, X_train, y_train, X_test, y_test):
    cv_auc = cross_val_score(model, X_train, y_train, cv=CV, scoring="roc_auc", n_jobs=-1)
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    print(f"\n{'─'*60}")
    print(f"  {name}")
    print(f"  CV AUC-ROC   : {cv_auc.mean():.4f} ± {cv_auc.std():.4f}  (5-fold stratified)")
    print(f"  Test Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"  Test F1      : {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  Test AUC-ROC : {roc_auc_score(y_test, y_prob):.4f}")
    print(classification_report(y_test, y_pred,
                                target_names=["0 (neg)", "1 (pos)"], zero_division=0))


def save_pkl(obj, path):
    with open(path, "wb") as f:
        pickle.dump(obj, f)
    print(f"  Saved → {path}")


def save_joblib(obj, path):
    joblib.dump(obj, path)
    print(f"  Saved → {path}")


def save_processed(df, feature_cols, target_col, sensitive_col, filename):
    keep = [c for c in feature_cols if c in df.columns]
    for extra in [target_col, sensitive_col]:
        if extra in df.columns and extra not in keep:
            keep.append(extra)
    out_path = f"datasets/processed/{filename}"
    df[keep].to_csv(out_path, index=False)
    print(f"  Saved dataset → {out_path}  ({len(df)} rows, {len(keep)} cols)")


def binary_encode(series, positives):
    return series.apply(lambda x: 1 if str(x).strip().lower() in positives else 0)


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1 — Adult Income  →  HistGradientBoosting
#
# File columns use dots: education.num, capital.gain, marital.status, etc.
# Sensitive: sex  |  Target: income >$50K  |  Domain: Finance / Policy
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 1 — Adult Income  (HistGradientBoostingClassifier)")
print("=" * 60)

df1 = pd.read_csv("datasets/adult_income.csv")
df1.replace(" ?", pd.NA, inplace=True)
df1.dropna(inplace=True)

# Binary encode target
df1["income_binary"] = binary_encode(df1["income"], {">50k", ">50k.", "1"})
df1["sex_encoded"]   = binary_encode(df1["sex"],    {"male", " male"})

# Encode categorical columns that carry real signal
df1["workclass_enc"] = binary_encode(
    df1.get("workclass", pd.Series(["?"] * len(df1))), {"private", " private"}
)
df1["marital_enc"] = binary_encode(
    df1.get("marital.status", pd.Series(["?"] * len(df1))),
    {"married-civ-spouse", " married-civ-spouse"}
)
df1["occupation_enc"] = (
    df1.get("occupation", pd.Series(["?"] * len(df1)))
    .astype("category").cat.codes
)

# Actual column names in this file use dots (education.num, capital.gain, etc.)
FEAT1 = [
    "age", "education.num", "hours.per.week",
    "capital.gain", "capital.loss", "fnlwgt",
    "sex_encoded", "workclass_enc", "marital_enc", "occupation_enc",
]
FEAT1 = [c for c in FEAT1 if c in df1.columns]
print(f"  Features used: {FEAT1}")

X1 = df1[FEAT1]
y1 = df1["income_binary"]

X1_tr, X1_te, y1_tr, y1_te = train_test_split(
    X1, y1, test_size=0.2, stratify=y1, random_state=42
)

model1 = HistGradientBoostingClassifier(
    max_iter=400,
    max_depth=6,
    learning_rate=0.05,
    min_samples_leaf=20,
    l2_regularization=0.1,
    class_weight="balanced",
    random_state=42,
)
model1.fit(X1_tr, y1_tr)
evaluate("Adult Income — HistGradientBoosting", model1, X1_tr, y1_tr, X1_te, y1_te)

save_joblib(model1, "trained_models/model_1_income_hgbm.joblib")
save_processed(df1, FEAT1, "income_binary", "sex", "adult_income_processed.csv")

metadata["model_1_income_hgbm"] = {
    "file": "trained_models/model_1_income_hgbm.joblib",
    "dataset": "datasets/processed/adult_income_processed.csv",
    "feature_columns": FEAT1,
    "target_column": "income_binary",
    "sensitive_feature": "sex",
    "positive_label": 1,
    "description": "Predicts whether an adult earns >$50K/year. Classic fairness benchmark for gender bias.",
    "domain": "Finance / Social Policy",
    "model_type": "HistGradientBoostingClassifier (400 iter, lr=0.05, depth=6, balanced)",
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 2 — Credit Card Default  →  Random Forest
#
# Uses ALL 6 months of payment history (PAY_0–PAY_6), all 6 bill amounts,
# all 6 payment amounts — 22 features total for a strong model.
# Sensitive: SEX_label  |  Target: default  |  Domain: Banking
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 2 — Credit Card Default  (Random Forest — full payment history)")
print("=" * 60)

df2 = pd.read_csv("datasets/credit_default.csv")
df2.rename(columns={"default.payment.next.month": "default"}, inplace=True)
df2.drop(columns=["ID"], errors="ignore", inplace=True)
df2.dropna(inplace=True)
df2 = df2[df2["default"].isin([0, 1])]

# Human-readable sensitive column (kept in processed CSV for fairness validator)
df2["SEX_label"] = df2["SEX"].map({1: "Male", 2: "Female"}).fillna("Unknown")
df2["AGE_group"] = pd.cut(
    df2["AGE"], bins=[0, 25, 35, 50, 100],
    labels=["Under25", "25-35", "35-50", "Over50"]
)

# Full feature set — all 6 months of payment status, bill amounts, payment amounts
FEAT2 = [
    "LIMIT_BAL", "SEX", "EDUCATION", "MARRIAGE", "AGE",
    "PAY_0", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6",
    "BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6",
    "PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6",
]
FEAT2 = [c for c in FEAT2 if c in df2.columns]
print(f"  Features used ({len(FEAT2)}): {FEAT2}")

X2 = df2[FEAT2]
y2 = df2["default"].astype(int)

X2_tr, X2_te, y2_tr, y2_te = train_test_split(
    X2, y2, test_size=0.2, stratify=y2, random_state=42
)

model2 = RandomForestClassifier(
    n_estimators=300,
    max_depth=10,
    min_samples_leaf=10,
    min_samples_split=20,
    max_features="sqrt",
    class_weight="balanced",
    n_jobs=-1,
    random_state=42,
)
model2.fit(X2_tr, y2_tr)
evaluate("Credit Default — Random Forest", model2, X2_tr, y2_tr, X2_te, y2_te)

save_joblib(model2, "trained_models/model_2_credit_rf.joblib")
save_processed(df2, FEAT2, "default", "SEX_label", "credit_default_processed.csv")

metadata["model_2_credit_rf"] = {
    "file": "trained_models/model_2_credit_rf.joblib",
    "dataset": "datasets/processed/credit_default_processed.csv",
    "feature_columns": FEAT2,
    "target_column": "default",
    "sensitive_feature": "SEX_label",
    "positive_label": 1,
    "description": "Predicts credit card payment default using full 6-month payment history. Tests gender-based fairness.",
    "domain": "Banking / Credit Risk",
    "model_type": "RandomForest (300 trees, depth=10, sqrt features, balanced)",
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 3 — Recidivism Risk  →  Logistic Regression (ElasticNet)
#
# This file (propublica fairml version) has race one-hot encoded into separate
# columns: African_American, Asian, Hispanic, Native_American, Other.
# We reconstruct a single "race" column for the fairness validator.
# Race is NOT used as a model feature — only as the sensitive attribute.
#
# Sensitive: race  |  Target: Two_yr_Recidivism  |  Domain: Criminal Justice
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 3 — Recidivism Risk  (Logistic Regression — ElasticNet)")
print("=" * 60)

df3 = pd.read_csv("datasets/compas_recidivism.csv")
df3.dropna(inplace=True)

# Reconstruct human-readable race column from one-hot encoding
def reconstruct_race(row):
    if row.get("African_American", 0) == 1:
        return "African-American"
    if row.get("Asian", 0) == 1:
        return "Asian"
    if row.get("Hispanic", 0) == 1:
        return "Hispanic"
    if row.get("Native_American", 0) == 1:
        return "Native American"
    if row.get("Other", 0) == 1:
        return "Other"
    return "Caucasian"

df3["race"] = df3.apply(reconstruct_race, axis=1)

# Features: only legitimate criminological factors — NOT race
# Female=1 means female, 0 means male
FEAT3 = [
    "Number_of_Priors",
    "Age_Above_FourtyFive",
    "Age_Below_TwentyFive",
    "Female",
    "Misdemeanor",
    "score_factor",
]
FEAT3 = [c for c in FEAT3 if c in df3.columns]
print(f"  Features used: {FEAT3}")
print(f"  Race distribution: {df3['race'].value_counts().to_dict()}")

X3 = df3[FEAT3]
y3 = df3["Two_yr_Recidivism"].astype(int)

X3_tr, X3_te, y3_tr, y3_te = train_test_split(
    X3, y3, test_size=0.2, stratify=y3, random_state=42
)

model3 = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(
        penalty="elasticnet",
        solver="saga",
        l1_ratio=0.5,
        C=0.5,
        max_iter=2000,
        class_weight="balanced",
        random_state=42,
    )),
])
model3.fit(X3_tr, y3_tr)
evaluate("Recidivism — Logistic Regression (ElasticNet)", model3, X3_tr, y3_tr, X3_te, y3_te)

save_pkl(model3, "trained_models/model_3_recidivism_logreg.pkl")
save_processed(df3, FEAT3, "Two_yr_Recidivism", "race", "compas_recidivism_processed.csv")

metadata["model_3_recidivism_logreg"] = {
    "file": "trained_models/model_3_recidivism_logreg.pkl",
    "dataset": "datasets/processed/compas_recidivism_processed.csv",
    "feature_columns": FEAT3,
    "target_column": "Two_yr_Recidivism",
    "sensitive_feature": "race",
    "positive_label": 1,
    "description": "Predicts 2-year recidivism using ProPublica COMPAS data. Tests racial bias in criminal justice.",
    "domain": "Criminal Justice",
    "model_type": "Logistic Regression (ElasticNet, C=0.5, balanced)",
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 4 — Heart Disease  →  Gradient Boosting
#
# Sensitive: sex_label  |  Target: disease present (num > 0)  |  Domain: Healthcare
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 4 — Heart Disease  (Gradient Boosting)")
print("=" * 60)

df4 = pd.read_csv("datasets/heart_disease.csv")
df4.drop(columns=["id", "dataset"], errors="ignore", inplace=True)

# Encode string columns before numeric coercion
df4["sex"]     = (df4["sex"] == "Male").astype(float)
df4["fbs"]     = df4["fbs"].astype(str).str.lower().map(
    {"true": 1, "false": 0, "1": 1, "0": 0}
)
df4["exang"]   = df4["exang"].astype(str).str.lower().map(
    {"true": 1, "false": 0, "yes": 1, "no": 0}
)
df4["cp"]      = df4["cp"].map(
    {"typical angina": 0, "atypical angina": 1, "non-anginal": 2, "asymptomatic": 3}
)
df4["restecg"] = df4["restecg"].map(
    {"normal": 0, "st-t abnormality": 1, "lv hypertrophy": 2}
)
df4["slope"]   = df4["slope"].map(
    {"upsloping": 0, "flat": 1, "downsloping": 2}
)
df4["thal"]    = df4["thal"].map(
    {"normal": 0, "fixed defect": 1, "reversable defect": 2}
)

df4["target"] = (df4["num"] > 0).astype(int)
df4.drop(columns=["num"], inplace=True)

for col in df4.columns:
    df4[col] = pd.to_numeric(df4[col], errors="coerce")
df4.dropna(inplace=True)

# Human-readable sensitive columns for fairness validator
df4["sex_label"] = df4["sex"].apply(lambda x: "Male" if int(x) == 1 else "Female")
df4["age_group"] = pd.cut(
    df4["age"], bins=[0, 40, 55, 70, 120],
    labels=["Under40", "40-55", "55-70", "Over70"]
)

FEAT4 = [c for c in df4.columns if c not in ("target", "sex_label", "age_group")]
print(f"  Features used ({len(FEAT4)}): {FEAT4}")

X4 = df4[FEAT4]
y4 = df4["target"].astype(int)

X4_tr, X4_te, y4_tr, y4_te = train_test_split(
    X4, y4, test_size=0.2, stratify=y4, random_state=42
)

model4 = GradientBoostingClassifier(
    n_estimators=300,
    max_depth=3,
    learning_rate=0.05,
    subsample=0.8,
    min_samples_leaf=5,
    max_features="sqrt",
    random_state=42,
)
model4.fit(X4_tr, y4_tr)
evaluate("Heart Disease — Gradient Boosting", model4, X4_tr, y4_tr, X4_te, y4_te)

save_pkl(model4, "trained_models/model_4_heart_gbm.pkl")
save_processed(df4, FEAT4, "target", "sex_label", "heart_disease_processed.csv")

metadata["model_4_heart_gbm"] = {
    "file": "trained_models/model_4_heart_gbm.pkl",
    "dataset": "datasets/processed/heart_disease_processed.csv",
    "feature_columns": FEAT4,
    "target_column": "target",
    "sensitive_feature": "sex_label",
    "positive_label": 1,
    "description": "Detects heart disease presence. Tests sex and age disparities in medical diagnosis.",
    "domain": "Healthcare / Medical Diagnosis",
    "model_type": "GradientBoosting (300 trees, depth=3, lr=0.05, subsample=0.8)",
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 5 — Employee Attrition  →  MLP Neural Network
#
# Sensitive: Gender  |  Target: Attrition  |  Domain: HR / People Analytics
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("MODEL 5 — Employee Attrition  (MLP Neural Network)")
print("=" * 60)

df5 = pd.read_csv("datasets/ibm_hr_attrition.csv", encoding="utf-8-sig")
df5.dropna(inplace=True)

df5["Attrition_binary"] = binary_encode(df5["Attrition"], {"yes"})
df5["OverTime_enc"]     = binary_encode(df5["OverTime"],  {"yes"})
df5["Gender_enc"]       = binary_encode(df5["Gender"],    {"male"})

FEAT5 = [
    "Age", "DailyRate", "DistanceFromHome", "Education",
    "EnvironmentSatisfaction", "Gender_enc", "JobInvolvement", "JobLevel",
    "JobSatisfaction", "MonthlyIncome", "NumCompaniesWorked", "OverTime_enc",
    "PerformanceRating", "RelationshipSatisfaction", "TotalWorkingYears",
    "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany",
    "YearsInCurrentRole", "YearsSinceLastPromotion",
]
FEAT5 = [c for c in FEAT5 if c in df5.columns]
print(f"  Features used ({len(FEAT5)}): {FEAT5}")

X5 = df5[FEAT5]
y5 = df5["Attrition_binary"].astype(int)

X5_tr, X5_te, y5_tr, y5_te = train_test_split(
    X5, y5, test_size=0.2, stratify=y5, random_state=42
)

model5 = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", MLPClassifier(
        hidden_layer_sizes=(256, 128, 64, 32),
        activation="relu",
        alpha=0.01,
        learning_rate="adaptive",
        learning_rate_init=0.001,
        max_iter=600,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        random_state=42,
    )),
])
model5.fit(X5_tr, y5_tr)
evaluate("Employee Attrition — MLP Neural Network", model5, X5_tr, y5_tr, X5_te, y5_te)

save_pkl(model5, "trained_models/model_5_attrition_mlp.pkl")
save_processed(df5, FEAT5, "Attrition_binary", "Gender", "ibm_hr_attrition_processed.csv")

metadata["model_5_attrition_mlp"] = {
    "file": "trained_models/model_5_attrition_mlp.pkl",
    "dataset": "datasets/processed/ibm_hr_attrition_processed.csv",
    "feature_columns": FEAT5,
    "target_column": "Attrition_binary",
    "sensitive_feature": "Gender",
    "positive_label": 1,
    "description": "Predicts employee attrition using IBM HR data. Tests gender fairness in HR decisions.",
    "domain": "HR / People Analytics",
    "model_type": "MLP (256→128→64→32 ReLU, L2 alpha=0.01, adaptive LR, early stopping)",
}


# ─────────────────────────────────────────────────────────────────────────────
# SAVE METADATA
# ─────────────────────────────────────────────────────────────────────────────
meta_path = "trained_models/model_metadata.json"
with open(meta_path, "w") as f:
    json.dump(metadata, f, indent=2)

print("\n" + "=" * 60)
print("ALL DONE")
print("=" * 60)
for key, m in metadata.items():
    print(f"\n  [{key}]")
    print(f"    Domain    : {m['domain']}")
    print(f"    Model     : {m['model_type']}")
    print(f"    File      : {m['file']}")
    print(f"    Dataset   : {m['dataset']}")
    print(f"    Target    : {m['target_column']}")
    print(f"    Sensitive : {m['sensitive_feature']}")
    print(f"    Features  : {m['feature_columns']}")

print("\n  Upload to platform:")
print("    Models   → trained_models/*.pkl / *.joblib")
print("    Datasets → datasets/processed/*.csv")
