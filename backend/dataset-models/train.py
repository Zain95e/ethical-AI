"""
train.py
=============================================
Trains 6 ML models using LOCAL dataset CSVs — no downloads required.

Prerequisites:
    pip install scikit-learn pandas numpy joblib

Run:
    python train.py

Outputs (in ./trained_models/):
    model_1_income_logreg.pkl
    model_2_credit_random_forest.joblib
    model_3_recidivism_gbm.pkl
    model_4_heart_svm.pkl
    model_5_attrition_mlp.pkl
    model_6_student_decision_tree.pkl
    model_metadata.json
"""

import os
import json
import pickle
import warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report

warnings.filterwarnings("ignore")

os.makedirs("trained_models", exist_ok=True)

metadata = {}


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def report(name, y_test, y_pred):
    acc = accuracy_score(y_test, y_pred)
    print(f"\n{'─'*60}")
    print(f"  {name}")
    print(f"  Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["0 (neg)", "1 (pos)"]))


def save_pkl(model, path):
    with open(path, "wb") as f:
        pickle.dump(model, f)
    print(f"  Saved → {path}")


def save_joblib(model, path):
    joblib.dump(model, path)
    print(f"  Saved → {path}")


def save_processed_dataset(df, feature_cols, target_col, out_name):
    """Save the final preprocessed dataframe to disk so it can be uploaded to the platform."""
    out_dir = "datasets/processed"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, out_name)
    
    # Extract only the required features and the target column
    keep_cols = [c for c in feature_cols if c in df.columns] + [target_col]
    df_out = df[keep_cols].copy()
    
    df_out.to_csv(out_path, index=False)
    print(f"  Saved Processed Dataset → {out_path} ({df_out.shape[1]} columns)")


def encode_binary(series, positive_values):
    """Map values in positive_values → 1, everything else → 0."""
    return series.apply(lambda x: 1 if str(x).strip().lower() in positive_values else 0)


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1 — Adult Income (Logistic Regression)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 1 — Adult Income  (Logistic Regression)")
print("="*60)

df_adult = pd.read_csv("datasets/adult_income.csv")
df_adult.dropna(inplace=True)

df_adult["income_binary"] = encode_binary(df_adult["income"], {">50k", ">50k.", "1"})
df_adult["sex_encoded"]   = encode_binary(df_adult["sex"], {"male"})

feature_cols = ["age", "education_num", "hours_per_week", "capital_gain",
                "capital_loss", "sex_encoded", "fnlwgt"]

X = df_adult[feature_cols].copy()
y = df_adult["income_binary"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

pipe1 = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", LogisticRegression(max_iter=1000, C=0.5, random_state=42))
])
pipe1.fit(X_train, y_train)
report("Adult Income — Logistic Regression", y_test, pipe1.predict(X_test))

save_pkl(pipe1, "trained_models/model_1_income_logreg.pkl")
save_processed_dataset(df_adult, feature_cols, "income_binary", "adult_income_processed.csv")
print(f"  Dataset used → datasets/processed/adult_income_processed.csv  ({len(df_adult)} rows)")

metadata["model_1_income_logreg"] = {
    "file": "trained_models/model_1_income_logreg.pkl",
    "dataset": "datasets/adult_income.csv",
    "feature_columns": feature_cols,
    "target_column": "income_binary",
    "sensitive_feature": "sex",
    "positive_label": 1,
    "description": "Predicts whether an adult earns >$50K/year. Classic fairness benchmark.",
    "domain": "Finance / Social Policy",
    "model_type": "Logistic Regression (Pipeline with StandardScaler)"
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 2 — Credit Card Default (Random Forest)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 2 — Credit Card Default  (Random Forest)")
print("="*60)

df_credit = pd.read_csv("datasets/credit_default.csv")
df_credit.rename(columns={"default.payment.next.month": "default"}, inplace=True)
df_credit.dropna(inplace=True)

df_credit["SEX_label"] = df_credit["SEX"].map({1: "Male", 2: "Female"})
df_credit["AGE_group"] = pd.cut(df_credit["AGE"], bins=[0,25,35,50,100],
                                 labels=["Under25","25-35","35-50","Over50"])

feature_cols2 = ["LIMIT_BAL","SEX","EDUCATION","MARRIAGE","AGE",
                 "PAY_0","PAY_2","PAY_3","BILL_AMT1","PAY_AMT1"]

X2 = df_credit[feature_cols2].copy()
y2 = df_credit["default"].astype(int)

X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42)

rf = RandomForestClassifier(n_estimators=150, max_depth=8, random_state=42, n_jobs=-1)
rf.fit(X2_train, y2_train)
report("Credit Default — Random Forest", y2_test, rf.predict(X2_test))

save_joblib(rf, "trained_models/model_2_credit_random_forest.joblib")
save_processed_dataset(df_credit, feature_cols2, "default", "credit_default_processed.csv")
print(f"  Dataset used → datasets/processed/credit_default_processed.csv  ({len(df_credit)} rows)")

metadata["model_2_credit_random_forest"] = {
    "file": "trained_models/model_2_credit_random_forest.joblib",
    "dataset": "datasets/credit_default.csv",
    "feature_columns": feature_cols2,
    "target_column": "default",
    "sensitive_feature": "SEX_label",
    "positive_label": 1,
    "description": "Predicts credit card payment default. Tests gender-based fairness in banking.",
    "domain": "Banking / Credit Risk",
    "model_type": "Random Forest (150 trees, max_depth=8)"
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 3 — Recidivism Risk (Gradient Boosting)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 3 — Recidivism Risk  (Gradient Boosting)")
print("="*60)

df_compas = pd.read_csv("datasets/compas_recidivism.csv")

keep = ["sex","age","race","juv_fel_count","juv_misd_count","juv_other_count",
        "priors_count","c_charge_degree","two_year_recid"]
df_compas = df_compas[keep].copy()
df_compas.dropna(inplace=True)

df_compas["sex_enc"]    = encode_binary(df_compas["sex"], {"male"})
df_compas["charge_enc"] = encode_binary(df_compas["c_charge_degree"], {"f"})

feature_cols3 = ["age","sex_enc","juv_fel_count","juv_misd_count",
                 "juv_other_count","priors_count","charge_enc"]

X3 = df_compas[feature_cols3].copy()
y3 = df_compas["two_year_recid"].astype(int)

X3_train, X3_test, y3_train, y3_test = train_test_split(X3, y3, test_size=0.2, random_state=42)

gbm = GradientBoostingClassifier(n_estimators=200, max_depth=4,
                                  learning_rate=0.05, random_state=42)
gbm.fit(X3_train, y3_train)
report("Recidivism — Gradient Boosting", y3_test, gbm.predict(X3_test))

save_pkl(gbm, "trained_models/model_3_recidivism_gbm.pkl")
save_processed_dataset(df_compas, feature_cols3, "two_year_recid", "compas_recidivism_processed.csv")
print(f"  Dataset used → datasets/processed/compas_recidivism_processed.csv  ({len(df_compas)} rows)")

metadata["model_3_recidivism_gbm"] = {
    "file": "trained_models/model_3_recidivism_gbm.pkl",
    "dataset": "datasets/compas_recidivism.csv",
    "feature_columns": feature_cols3,
    "target_column": "two_year_recid",
    "sensitive_feature": "race",
    "positive_label": 1,
    "description": "Predicts 2-year recidivism risk. Replicates the COMPAS algorithm studied for racial bias.",
    "domain": "Criminal Justice",
    "model_type": "Gradient Boosting (200 estimators, lr=0.05)"
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 4 — Heart Disease (SVM)  ← FIXED: encode strings before numeric coerce
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 4 — Heart Disease  (SVM)")
print("="*60)

df_heart = pd.read_csv("datasets/heart_disease.csv")
df_heart.drop(columns=["id", "dataset"], errors="ignore", inplace=True)

# Encode all string/bool columns FIRST, before pd.to_numeric
df_heart["sex"]     = (df_heart["sex"] == "Male").astype(int)
df_heart["fbs"]     = df_heart["fbs"].astype(str).str.lower().map({"true": 1, "false": 0, "1": 1, "0": 0})
df_heart["exang"]   = df_heart["exang"].astype(str).str.lower().map({"true": 1, "false": 0, "yes": 1, "no": 0})
df_heart["cp"]      = df_heart["cp"].map({"typical angina": 0, "atypical angina": 1, "non-anginal": 2, "asymptomatic": 3})
df_heart["restecg"] = df_heart["restecg"].map({"normal": 0, "st-t abnormality": 1, "lv hypertrophy": 2})
df_heart["slope"]   = df_heart["slope"].map({"upsloping": 0, "flat": 1, "downsloping": 2})
df_heart["thal"]    = df_heart["thal"].map({"normal": 0, "fixed defect": 1, "reversable defect": 2})

# Target: binarise 'num' column (>0 = disease present)
df_heart["target"] = (df_heart["num"] > 0).astype(int)
df_heart.drop(columns=["num"], inplace=True)

# Now safely coerce remaining columns and drop NaNs
for col in df_heart.columns:
    df_heart[col] = pd.to_numeric(df_heart[col], errors="coerce")
df_heart.dropna(inplace=True)

# Human-readable sensitive columns (after encoding, for metadata use only)
df_heart["sex_label"] = df_heart["sex"].apply(lambda x: "Male" if int(x) == 1 else "Female")
df_heart["age_group"] = pd.cut(df_heart["age"], bins=[0, 40, 55, 70, 120],
                                labels=["Under40", "40-55", "55-70", "Over70"])

feature_cols4 = [c for c in df_heart.columns if c not in ["target", "sex_label", "age_group"]]

X4 = df_heart[feature_cols4].copy()
y4 = df_heart["target"].astype(int)

X4_train, X4_test, y4_train, y4_test = train_test_split(X4, y4, test_size=0.2, random_state=42)

pipe4 = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", SVC(kernel="rbf", C=1.0, gamma="scale", probability=True, random_state=42))
])
pipe4.fit(X4_train, y4_train)
report("Heart Disease — SVM", y4_test, pipe4.predict(X4_test))

save_pkl(pipe4, "trained_models/model_4_heart_svm.pkl")
save_processed_dataset(df_heart, feature_cols4, "target", "heart_disease_processed.csv")
print(f"  Dataset used → datasets/processed/heart_disease_processed.csv  ({len(df_heart)} rows)")

metadata["model_4_heart_svm"] = {
    "file": "trained_models/model_4_heart_svm.pkl",
    "dataset": "datasets/heart_disease.csv",
    "feature_columns": feature_cols4,
    "target_column": "target",
    "sensitive_feature": "sex_label",
    "positive_label": 1,
    "description": "Detects heart disease presence. Tests sex and age disparities in medical diagnosis.",
    "domain": "Healthcare / Medical Diagnosis",
    "model_type": "SVM (RBF kernel, probability=True, Pipeline with StandardScaler)"
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 5 — Employee Attrition (MLP Neural Network)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 5 — Employee Attrition  (MLP Neural Network)")
print("="*60)

df_ibm = pd.read_csv("datasets/ibm_hr_attrition.csv")
df_ibm.dropna(inplace=True)

df_ibm["Attrition_binary"] = encode_binary(df_ibm["Attrition"], {"yes"})
df_ibm["OverTime_enc"]     = encode_binary(df_ibm["OverTime"], {"yes"})
df_ibm["Age_group"]        = pd.cut(df_ibm["Age"], bins=[0, 30, 40, 50, 100],
                                     labels=["Under30", "30-40", "40-50", "Over50"])

feature_cols5 = ["Age", "DailyRate", "DistanceFromHome", "Education",
                 "EnvironmentSatisfaction", "JobInvolvement", "JobLevel",
                 "JobSatisfaction", "MonthlyIncome", "NumCompaniesWorked",
                 "OverTime_enc", "PerformanceRating", "RelationshipSatisfaction",
                 "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance",
                 "YearsAtCompany", "YearsInCurrentRole", "YearsSinceLastPromotion"]
feature_cols5 = [c for c in feature_cols5 if c in df_ibm.columns]

X5 = df_ibm[feature_cols5].copy()
y5 = df_ibm["Attrition_binary"].astype(int)

X5_train, X5_test, y5_train, y5_test = train_test_split(X5, y5, test_size=0.2, random_state=42)

pipe5 = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", MLPClassifier(hidden_layer_sizes=(128, 64, 32),
                          activation="relu",
                          max_iter=500,
                          random_state=42,
                          early_stopping=True))
])
pipe5.fit(X5_train, y5_train)
report("Employee Attrition — MLP", y5_test, pipe5.predict(X5_test))

save_pkl(pipe5, "trained_models/model_5_attrition_mlp.pkl")
save_processed_dataset(df_ibm, feature_cols5, "Attrition_binary", "ibm_hr_attrition_processed.csv")
print(f"  Dataset used → datasets/processed/ibm_hr_attrition_processed.csv  ({len(df_ibm)} rows)")

metadata["model_5_attrition_mlp"] = {
    "file": "trained_models/model_5_attrition_mlp.pkl",
    "dataset": "datasets/ibm_hr_attrition.csv",
    "feature_columns": feature_cols5,
    "target_column": "Attrition_binary",
    "sensitive_feature": "Gender",
    "positive_label": 1,
    "description": "Predicts employee attrition. Tests gender and age fairness in HR decisions.",
    "domain": "HR / People Analytics",
    "model_type": "MLP Neural Network (128→64→32 ReLU, Pipeline with StandardScaler)"
}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 6 — Student Pass/Fail (Decision Tree)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("MODEL 6 — Student Pass/Fail  (Decision Tree)")
print("="*60)

df_student = pd.read_csv("datasets/student_performance.csv")
df_student.dropna(inplace=True)

df_student["pass_fail"]    = (df_student["G3"] >= 10).astype(int)
df_student["sex_enc"]      = encode_binary(df_student["sex"], {"m"})
df_student["address_enc"]  = encode_binary(df_student["address"], {"u"})
df_student["internet_enc"] = encode_binary(df_student["internet"], {"yes"})
df_student["higher_enc"]   = encode_binary(df_student["higher"], {"yes"})
df_student["romantic_enc"] = encode_binary(df_student["romantic"], {"yes"})
df_student["famsup_enc"]   = encode_binary(df_student["famsup"], {"yes"})
df_student["paid_enc"]     = encode_binary(df_student["paid"], {"yes"})

feature_cols6 = ["age", "sex_enc", "address_enc", "Medu", "Fedu",
                 "traveltime", "studytime", "failures", "famsup_enc",
                 "paid_enc", "internet_enc", "romantic_enc", "higher_enc",
                 "freetime", "goout", "Dalc", "Walc", "health", "absences",
                 "G1", "G2"]
feature_cols6 = [c for c in feature_cols6 if c in df_student.columns]

X6 = df_student[feature_cols6].copy()
y6 = df_student["pass_fail"].astype(int)

X6_train, X6_test, y6_train, y6_test = train_test_split(X6, y6, test_size=0.2, random_state=42)

dt = DecisionTreeClassifier(max_depth=6, min_samples_split=10,
                             class_weight="balanced", random_state=42)
dt.fit(X6_train, y6_train)
report("Student Pass/Fail — Decision Tree", y6_test, dt.predict(X6_test))

save_pkl(dt, "trained_models/model_6_student_decision_tree.pkl")
save_processed_dataset(df_student, feature_cols6, "pass_fail", "student_performance_processed.csv")
print(f"  Dataset used → datasets/processed/student_performance_processed.csv  ({len(df_student)} rows)")

metadata["model_6_student_decision_tree"] = {
    "file": "trained_models/model_6_student_decision_tree.pkl",
    "dataset": "datasets/student_performance.csv",
    "feature_columns": feature_cols6,
    "target_column": "pass_fail",
    "sensitive_feature": "sex",
    "positive_label": 1,
    "description": "Predicts student pass/fail. Tests gender and urban/rural fairness in education outcomes.",
    "domain": "Education / Academic Performance",
    "model_type": "Decision Tree (max_depth=6, balanced class weight)"
}


# ─────────────────────────────────────────────────────────────────────────────
# SAVE METADATA
# ─────────────────────────────────────────────────────────────────────────────
meta_path = "trained_models/model_metadata.json"
with open(meta_path, "w") as f:
    json.dump(metadata, f, indent=2)

print("\n" + "="*60)
print("DONE — Model Metadata Summary")
print("="*60)
print(f"\nFull metadata saved to: {meta_path}\n")

for key, m in metadata.items():
    print(f"  [{key}]")
    print(f"    Domain      : {m['domain']}")
    print(f"    Model file  : {m['file']}")
    print(f"    Target col  : {m['target_column']}")
    print(f"    Sensitive   : {m['sensitive_feature']}")
    print(f"    Features    : {m['feature_columns']}")
    print()