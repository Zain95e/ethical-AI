#!/bin/bash

SRC="/mnt/c/Users/Zain/Downloads/Datasets"

# Create all required subfolders
mkdir -p "$SRC/Income"
mkdir -p "$SRC/Credit"
mkdir -p "$SRC/Heart"
mkdir -p "$SRC/HR"
mkdir -p datasets

echo "📁 Folders created under $SRC"
echo ""

# ── 1. COMPAS Recidivism ─────────────────────────────────────────────────────
# Kaggle search: "COMPAS Recidivism Racial Bias"  by danofer
# File in zip: compas-scores-two-years.csv
# Place at:    C:\Users\Zain\Downloads\Datasets\compas-scores-two-years.csv
if [ -f "$SRC/compas-scores-two-years.csv" ]; then
    cp "$SRC/compas-scores-two-years.csv" datasets/compas_recidivism.csv
    echo "✅ COMPAS copied"
else
    echo "❌ MISSING: $SRC/compas-scores-two-years.csv"
fi

# ── 2. Adult Income ───────────────────────────────────────────────────────────
# Kaggle search: "Adult Census Income"  by uciml
# File in zip:   adult.csv  (some zips call it adult_train.csv — either works)
# Place at:      C:\Users\Zain\Downloads\Datasets\Income\adult.csv
if [ -f "$SRC/Income/adult.csv" ]; then
    cp "$SRC/Income/adult.csv" datasets/adult_income.csv
    echo "✅ Adult Income copied  (adult.csv)"
elif [ -f "$SRC/Income/adult_train.csv" ]; then
    cp "$SRC/Income/adult_train.csv" datasets/adult_income.csv
    echo "✅ Adult Income copied  (adult_train.csv)"
else
    echo "❌ MISSING: $SRC/Income/adult.csv  (or adult_train.csv)"
fi

# ── 3. Credit Card Default ────────────────────────────────────────────────────
# Kaggle search: "Default of Credit Card Clients Dataset"  by uciml
# File in zip:   UCI_Credit_Card.csv
# Place at:      C:\Users\Zain\Downloads\Datasets\Credit\UCI_Credit_Card.csv
if [ -f "$SRC/Credit/UCI_Credit_Card.csv" ]; then
    cp "$SRC/Credit/UCI_Credit_Card.csv" datasets/credit_default.csv
    echo "✅ Credit Default copied"
else
    echo "❌ MISSING: $SRC/Credit/UCI_Credit_Card.csv"
fi

# ── 4. Heart Disease ──────────────────────────────────────────────────────────
# Kaggle search: "Heart Disease Data"  by redwankarimsony
# File in zip:   heart_disease_uci.csv
# Place at:      C:\Users\Zain\Downloads\Datasets\Heart\heart_disease_uci.csv
if [ -f "$SRC/Heart/heart_disease_uci.csv" ]; then
    cp "$SRC/Heart/heart_disease_uci.csv" datasets/heart_disease.csv
    echo "✅ Heart Disease copied"
else
    echo "❌ MISSING: $SRC/Heart/heart_disease_uci.csv"
fi

# ── 5. IBM HR Attrition ───────────────────────────────────────────────────────
# Kaggle search: "IBM HR Analytics Employee Attrition"  by pavansubhasht
# File in zip:   WA_Fn-UseC_-HR-Employee-Attrition.csv
# Place at:      C:\Users\Zain\Downloads\Datasets\HR\WA_Fn-UseC_-HR-Employee-Attrition.csv
if [ -f "$SRC/HR/WA_Fn-UseC_-HR-Employee-Attrition.csv" ]; then
    cp "$SRC/HR/WA_Fn-UseC_-HR-Employee-Attrition.csv" datasets/ibm_hr_attrition.csv
    echo "✅ IBM HR Attrition copied"
else
    echo "❌ MISSING: $SRC/HR/WA_Fn-UseC_-HR-Employee-Attrition.csv"
fi

echo ""
echo "📊 Files now in datasets/:"
ls -lh datasets/ 2>/dev/null || echo "(empty)"
