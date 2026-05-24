import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Card,
    CardContent,
    CardActions,
    Typography,
    Chip,
    Alert,
    CircularProgress,
    Box,
    Stack,
    Tabs,
    Tab,
    LinearProgress,
    Divider,
} from '@mui/material';
import {
    Gavel as GavelIcon,
    Work as WorkIcon,
    AccountBalance as BankIcon,
    LocalHospital as HospitalIcon,
    School as EducationIcon,
    Psychology as BrainIcon,
    CloudDownload as ImportIcon,
    Dataset as DatasetIcon,
    ModelTraining as ModelIcon,
} from '@mui/icons-material';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface BenchmarkEntry {
    key: string;
    name: string;
    description: string;
    domain: string;
    target_column: string;
    sensitive_attributes: string[];
    key_features: string[];
    reference: string;
    // models only
    accuracy?: number;
    algorithm?: string;
}

interface BenchmarkLoaderProps {
    open: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess: (name: string, type: 'dataset' | 'model') => void;
    /** Names of models already in this project (for duplicate UI indicator) */
    existingModelNames?: string[];
    /** Names of datasets already in this project (for duplicate UI indicator) */
    existingDatasetNames?: string[];
}

// ─────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────

const BENCHMARK_DATASETS: BenchmarkEntry[] = [
    {
        key: 'adult_income',
        name: 'Adult Income',
        description:
            'Census data predicting whether an adult earns >$50K/year. Classic fairness benchmark for Finance / Social Policy.',
        domain: 'finance',
        target_column: 'income_binary',
        sensitive_attributes: ['sex'],
        key_features: ['age', 'education_num', 'hours_per_week', 'capital_gain', 'capital_loss', 'sex_encoded', 'fnlwgt'],
        reference: 'UCI Adult / Census Income Dataset (30 162 rows)',
    },
    {
        key: 'credit_default',
        name: 'Credit Card Default',
        description:
            'Taiwan credit-card dataset predicting payment default. Tests gender-based fairness in Banking / Credit Risk.',
        domain: 'finance',
        target_column: 'default',
        sensitive_attributes: ['SEX_label'],
        key_features: ['LIMIT_BAL', 'SEX', 'EDUCATION', 'MARRIAGE', 'AGE', 'PAY_0', 'PAY_2', 'PAY_3', 'BILL_AMT1', 'PAY_AMT1'],
        reference: 'UCI Default of Credit Card Clients Dataset (30 000 rows)',
    },
    {
        key: 'compas_recidivism',
        name: 'Recidivism Risk',
        description:
            'COMPAS recidivism dataset predicting 2-year reoffending risk. Widely studied for racial bias in Criminal Justice.',
        domain: 'criminal_justice',
        target_column: 'two_year_recid',
        sensitive_attributes: ['race'],
        key_features: ['age', 'sex_enc', 'juv_fel_count', 'juv_misd_count', 'juv_other_count', 'priors_count', 'charge_enc'],
        reference: 'ProPublica COMPAS Analysis (2016) — 7 214 rows',
    },
    {
        key: 'heart_disease',
        name: 'Heart Disease',
        description:
            'Cleveland Heart Disease dataset detecting cardiac disease. Tests sex and age disparities in Healthcare / Medical Diagnosis.',
        domain: 'healthcare',
        target_column: 'target',
        sensitive_attributes: ['sex_label'],
        key_features: ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalch', 'exang', 'oldpeak', 'slope', 'ca', 'thal'],
        reference: 'UCI Heart Disease Dataset (299 rows)',
    },
    {
        key: 'ibm_hr_attrition',
        name: 'Employee Attrition',
        description:
            'IBM HR Analytics dataset predicting employee attrition. Tests gender and age fairness in HR / People Analytics.',
        domain: 'employment',
        target_column: 'Attrition_binary',
        sensitive_attributes: ['Gender'],
        key_features: ['Age', 'DailyRate', 'DistanceFromHome', 'Education', 'EnvironmentSatisfaction', 'JobInvolvement', 'JobLevel', 'JobSatisfaction', 'MonthlyIncome'],
        reference: 'IBM HR Analytics Employee Attrition Dataset (1 470 rows)',
    },
    {
        key: 'student_performance',
        name: 'Student Pass/Fail',
        description:
            'Portuguese student performance dataset predicting pass/fail outcomes. Tests gender and urban/rural fairness in Education.',
        domain: 'education',
        target_column: 'pass_fail',
        sensitive_attributes: ['sex'],
        key_features: ['age', 'sex_enc', 'address_enc', 'Medu', 'Fedu', 'traveltime', 'studytime', 'failures', 'absences', 'G1', 'G2'],
        reference: 'UCI Student Performance Dataset (395 rows)',
    },
];

const BENCHMARK_MODELS: BenchmarkEntry[] = [
    {
        key: 'model_1_income_logreg',
        name: 'Adult Income Predictor',
        description: 'Predicts whether an adult earns >$50K/year (income_binary). Trained on 30 162 census records.',
        domain: 'finance',
        target_column: 'income_binary',
        sensitive_attributes: ['sex'],
        key_features: ['age', 'education_num', 'hours_per_week', 'capital_gain', 'capital_loss', 'sex_encoded', 'fnlwgt'],
        reference: 'UCI Adult / Census Income Dataset',
        accuracy: 0.8228,
        algorithm: 'Logistic Regression (StandardScaler pipeline)',
    },
    {
        key: 'model_2_credit_random_forest',
        name: 'Credit Card Default Classifier',
        description: 'Predicts credit card payment default (default). Trained on 30 000 Taiwan credit records.',
        domain: 'finance',
        target_column: 'default',
        sensitive_attributes: ['SEX_label'],
        key_features: ['LIMIT_BAL', 'SEX', 'EDUCATION', 'MARRIAGE', 'AGE', 'PAY_0', 'PAY_2', 'PAY_3', 'BILL_AMT1', 'PAY_AMT1'],
        reference: 'UCI Default of Credit Card Clients Dataset',
        accuracy: 0.8185,
        algorithm: 'Random Forest (150 trees, max_depth=8)',
    },
    {
        key: 'model_3_recidivism_gbm',
        name: 'Recidivism Risk Assessor',
        description: 'Predicts 2-year recidivism risk (two_year_recid). Trained on 7 214 COMPAS records.',
        domain: 'criminal_justice',
        target_column: 'two_year_recid',
        sensitive_attributes: ['race'],
        key_features: ['age', 'sex_enc', 'juv_fel_count', 'juv_misd_count', 'juv_other_count', 'priors_count', 'charge_enc'],
        reference: 'ProPublica COMPAS Analysis (2016)',
        accuracy: 0.6881,
        algorithm: 'Gradient Boosting (200 estimators, lr=0.05)',
    },
    {
        key: 'model_4_heart_svm',
        name: 'Heart Disease Detector',
        description: 'Detects cardiac disease presence (target). Trained on 299 Cleveland Heart Disease records.',
        domain: 'healthcare',
        target_column: 'target',
        sensitive_attributes: ['sex_label'],
        key_features: ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg', 'thalch', 'exang', 'oldpeak', 'slope', 'ca', 'thal'],
        reference: 'UCI Heart Disease Dataset',
        accuracy: 0.8667,
        algorithm: 'SVM (RBF kernel, probability=True, StandardScaler pipeline)',
    },
    {
        key: 'model_5_attrition_mlp',
        name: 'Employee Attrition Predictor',
        description: 'Predicts employee attrition (Attrition_binary). Trained on 1 470 IBM HR records.',
        domain: 'employment',
        target_column: 'Attrition_binary',
        sensitive_attributes: ['Gender'],
        key_features: ['Age', 'DailyRate', 'DistanceFromHome', 'Education', 'EnvironmentSatisfaction', 'JobInvolvement', 'JobLevel', 'JobSatisfaction', 'MonthlyIncome'],
        reference: 'IBM HR Analytics Employee Attrition Dataset',
        accuracy: 0.8673,
        algorithm: 'MLP Neural Network (128→64→32 ReLU, StandardScaler pipeline)',
    },
    {
        key: 'model_6_student_decision_tree',
        name: 'Student Pass/Fail Predictor',
        description: 'Predicts student pass/fail outcome (pass_fail). Trained on 395 Portuguese student records.',
        domain: 'education',
        target_column: 'pass_fail',
        sensitive_attributes: ['sex'],
        key_features: ['age', 'sex_enc', 'address_enc', 'Medu', 'Fedu', 'traveltime', 'studytime', 'failures', 'absences', 'G1', 'G2'],
        reference: 'UCI Student Performance Dataset',
        accuracy: 0.8228,
        algorithm: 'Decision Tree (max_depth=6, balanced class weights)',
    },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DOMAIN_ICONS: Record<string, React.ReactElement> = {
    finance: <BankIcon sx={{ fontSize: 36 }} />,
    criminal_justice: <GavelIcon sx={{ fontSize: 36 }} />,
    healthcare: <HospitalIcon sx={{ fontSize: 36 }} />,
    employment: <WorkIcon sx={{ fontSize: 36 }} />,
    education: <EducationIcon sx={{ fontSize: 36 }} />,
};

const DOMAIN_COLORS: Record<string, string> = {
    finance: '#2196f3',
    criminal_justice: '#f44336',
    healthcare: '#4caf50',
    employment: '#ff9800',
    education: '#9c27b0',
};

const DOMAIN_LABELS: Record<string, string> = {
    finance: 'Finance',
    criminal_justice: 'Criminal Justice',
    healthcare: 'Healthcare',
    employment: 'Employment',
    education: 'Education',
};

function AccuracyBar({ value }: { value: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 85 ? '#4caf50' : pct >= 75 ? '#ff9800' : '#f44336';
    return (
        <Box>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">Accuracy</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color }}>{pct}%</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                }}
            />
        </Box>
    );
}

// ─────────────────────────────────────────────
// BenchmarkCard
// ─────────────────────────────────────────────

function BenchmarkCard({
    entry,
    type,
    loading,
    alreadyImported,
    onImport,
}: {
    entry: BenchmarkEntry;
    type: 'dataset' | 'model';
    loading: boolean;
    alreadyImported: boolean;
    onImport: (key: string) => void;
}) {
    const color = DOMAIN_COLORS[entry.domain] || '#607d8b';
    const icon = DOMAIN_ICONS[entry.domain] || <BrainIcon sx={{ fontSize: 36 }} />;

    return (
        <Card
            variant="outlined"
            sx={{
                borderLeft: `4px solid ${alreadyImported ? '#4caf50' : color}`,
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: alreadyImported ? 1 : 4 },
                opacity: alreadyImported ? 0.82 : 1,
            }}
        >
            <CardContent>
                {/* Header row */}
                <Box display="flex" alignItems="flex-start" gap={2}>
                    <Box sx={{ color, mt: 0.5, flexShrink: 0 }}>{icon}</Box>
                    <Box flex={1} minWidth={0}>
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                                {entry.name}
                            </Typography>
                            {alreadyImported && (
                                <Chip
                                    label="✓ Already Imported"
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ fontSize: 11, fontWeight: 700 }}
                                />
                            )}
                            <Chip
                                label={DOMAIN_LABELS[entry.domain] || entry.domain}
                                size="small"
                                sx={{ bgcolor: `${color}22`, color, fontWeight: 600, fontSize: 11 }}
                            />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {entry.description}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Metadata grid */}
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
                    {/* Target */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Target Column
                        </Typography>
                        <Chip label={entry.target_column} size="small" variant="outlined" sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 11 }} />
                    </Box>
                    {/* Sensitive */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Sensitive Attribute{entry.sensitive_attributes.length > 1 ? 's' : ''}
                        </Typography>
                        <Box mt={0.5} display="flex" flexWrap="wrap" gap={0.5}>
                            {entry.sensitive_attributes.map((attr) => (
                                <Chip key={attr} label={attr} size="small" color="warning" variant="outlined" sx={{ fontSize: 11 }} />
                            ))}
                        </Box>
                    </Box>
                </Box>

                {/* Algorithm (models only) */}
                {entry.algorithm && (
                    <Box mt={1.5}>
                        <Typography variant="caption" color="text.secondary" display="block">
                            Algorithm
                        </Typography>
                        <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
                            {entry.algorithm}
                        </Typography>
                    </Box>
                )}

                {/* Accuracy bar (models only) */}
                {entry.accuracy !== undefined && (
                    <Box mt={1.5}>
                        <AccuracyBar value={entry.accuracy} />
                    </Box>
                )}

                {/* Key features */}
                <Box mt={1.5}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                        Key Features
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {entry.key_features.slice(0, 6).map((f) => (
                            <Chip key={f} label={f} size="small" sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                        ))}
                        {entry.key_features.length > 6 && (
                            <Chip label={`+${entry.key_features.length - 6} more`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        )}
                    </Box>
                </Box>

                {/* Reference */}
                <Typography variant="caption" color="text.disabled" display="block" mt={1}>
                    📚 {entry.reference}
                </Typography>
            </CardContent>

            <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                <Button
                    variant={alreadyImported ? 'outlined' : 'contained'}
                    size="small"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ImportIcon />}
                    disabled={loading || alreadyImported}
                    onClick={() => onImport(entry.key)}
                    color={alreadyImported ? 'success' : 'primary'}
                    sx={{
                        ...(alreadyImported
                            ? {}
                            : { bgcolor: color, '&:hover': { bgcolor: color, filter: 'brightness(0.88)' } }),
                        ml: 'auto',
                    }}
                >
                    {loading
                        ? 'Importing…'
                        : alreadyImported
                        ? '✓ Already Imported'
                        : `Import ${type === 'model' ? 'Model' : 'Dataset'}`}
                </Button>
            </CardActions>
        </Card>
    );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function BenchmarkDatasetLoader({
    open,
    onClose,
    projectId,
    onSuccess,
    existingModelNames = [],
    existingDatasetNames = [],
}: BenchmarkLoaderProps) {
    const [tab, setTab] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState<string | null>(null);

    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

    const handleImportDataset = async (datasetKey: string) => {
        setError(null);
        setLoadingKey(datasetKey);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(
                `${BASE_URL}/datasets/project/${projectId}/load-benchmark?dataset_key=${datasetKey}`,
                { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
                const body = await res.json();
                if (res.status === 409) {
                    setError(`This dataset is already imported into this project.`);
                } else {
                    throw new Error(body.detail || 'Failed to import dataset');
                }
                return;
            }
            const data = await res.json();
            onSuccess(data.name || datasetKey, 'dataset');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoadingKey(null);
        }
    };

    const handleImportModel = async (modelKey: string) => {
        setError(null);
        setLoadingKey(modelKey);
        try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(
                `${BASE_URL}/models/project/${projectId}/load-benchmark?model_key=${modelKey}`,
                { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) {
                const body = await res.json();
                if (res.status === 409) {
                    setError(`This model is already imported into this project.`);
                } else {
                    throw new Error(body.detail || 'Failed to import model');
                }
                return;
            }
            const data = await res.json();
            onSuccess(data.name || modelKey, 'model');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoadingKey(null);
        }
    };

    const isBusy = loadingKey !== null;

    return (
        <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ pb: 0 }}>
                <Box display="flex" alignItems="center" gap={1}>
                    <ImportIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>Import Benchmark</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                    6 locally trained models and their paired datasets — ready for fairness validation.
                </Typography>
            </DialogTitle>

            <Box px={3} pt={1}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab
                        icon={<DatasetIcon fontSize="small" />}
                        iconPosition="start"
                        label="Datasets (6)"
                        id="bm-tab-0"
                        aria-controls="bm-panel-0"
                    />
                    <Tab
                        icon={<ModelIcon fontSize="small" />}
                        iconPosition="start"
                        label="Models (6)"
                        id="bm-tab-1"
                        aria-controls="bm-panel-1"
                    />
                </Tabs>
            </Box>

            <DialogContent sx={{ pt: 2 }}>
                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Datasets panel */}
                <div role="tabpanel" id="bm-panel-0" hidden={tab !== 0}>
                    {tab === 0 && (
                        <Stack spacing={2}>
                            {BENCHMARK_DATASETS.map((entry) => (
                                <BenchmarkCard
                                    key={entry.key}
                                    entry={entry}
                                    type="dataset"
                                    loading={loadingKey === entry.key}
                                    alreadyImported={existingDatasetNames.some(
                                        (n) => n.toLowerCase() === entry.name.toLowerCase()
                                    )}
                                    onImport={isBusy ? () => {} : handleImportDataset}
                                />
                            ))}
                        </Stack>
                    )}
                </div>

                {/* Models panel */}
                <div role="tabpanel" id="bm-panel-1" hidden={tab !== 1}>
                    {tab === 1 && (
                        <Stack spacing={2}>
                            {BENCHMARK_MODELS.map((entry) => (
                                <BenchmarkCard
                                    key={entry.key}
                                    entry={entry}
                                    type="model"
                                    loading={loadingKey === entry.key}
                                    alreadyImported={existingModelNames.some(
                                        (n) => n.toLowerCase() === entry.name.toLowerCase()
                                    )}
                                    onImport={isBusy ? () => {} : handleImportModel}
                                />
                            ))}
                        </Stack>
                    )}
                </div>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={isBusy}>
                    Cancel
                </Button>
            </DialogActions>
        </Dialog>
    );
}
