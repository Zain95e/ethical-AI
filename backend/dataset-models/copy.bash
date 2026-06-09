#!/bin/bash

SRC="/mnt/c/Users/Zain/Downloads/Datasets"

# Create datasets folder if it doesn't exist
mkdir -p datasets

# Copy and rename all required files
cp "$SRC/compas-scores-two-years.csv"          datasets/compas_recidivism.csv

cp "$SRC/Income/adult_train.csv"               datasets/adult_income.csv

cp "$SRC/Credit/UCI_Credit_Card.csv"           datasets/credit_default.csv

cp "$SRC/Heart/heart_disease_uci.csv"          datasets/heart_disease.csv

cp "$SRC/HR/WA_Fn-UseC_-HR-Employee-Attrition.csv"  datasets/ibm_hr_attrition.csv

cp "$SRC/Student/student-mat.csv"              datasets/student_performance.csv

echo "✅ All datasets copied and renamed successfully!"
echo "📁 Files are now in: datasets/"
ls -lh datasets/
