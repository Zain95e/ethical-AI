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
    Tooltip,
} from '@mui/material';
import {
    Gavel as GavelIcon,
    Work as WorkIcon,
    AccountBalance as BankIcon,
    LocalHospital as HospitalIcon,
    Psychology as BrainIcon,
    CloudDownload as ImportIcon,
    Dataset as DatasetIcon,
    ModelTraining as ModelIcon,
    Warning as WarningIcon,
    CheckCircle as CheckIcon,
    ErrorOutline as CriticalIcon,
    Info as InfoIcon,
} from '@mui/icons-material';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type BiasLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface BenchmarkEntry {
    key: string;
    name: string;
    description: string;
    domain: string;
    target_column: string;
    target_values: { '0': string; '1': string };
    sensitive_attributes: string[];
    sensitive_values: Record<string, string[]>;
    key_features: string[];
    reference: string;
    rows: number;
    bias_level: BiasLevel;
    bias_description: string;
    // models only
    accuracy?: number;
    auc_roc?: number;
    algorithm?: string;
}

interface BenchmarkLoaderProps {
    open: boolean;
    onClose: () => void;
    projectId: string;
    onSuccess: (name: string, type: 'dataset' | 'model') => void;
    existingModelNames?: string[];
    existingDatasetNames?: string[];
}

// ─────────────────────────────────────────────
// Catalogue — 5 Datasets
// ─────────────────────────────────────────────

const BENCHMARK_DATASETS: BenchmarkEntry[] = [
    {
        key: 'adult_income',
        name: 'Adult Income',
        description:
            'UCI Census Income dataset — 32 561 US adults from the 1994 census. Predicts whether a person earns above or below $50K/year based on demographic and employment data.',
        domain: 'finance',
        target_column: 'income_binary',
        target_values: { '0': 'Earns ≤$50K / year', '1': 'Earns >$50K / year' },
        sensitive_attributes: ['sex'],
        sensitive_values: { sex: ['Male', 'Female'] },
        key_features: ['age', 'education.num', 'hours.per.week', 'capital.gain', 'capital.loss', 'fnlwgt', 'sex_encoded', 'workclass_enc', 'marital_enc', 'occupation_enc'],
        reference: 'UCI Adult / Census Income Dataset (32 561 rows)',
        rows: 32561,
        bias_level: 'HIGH',
        bias_description:
            'Known gender pay gap — women are predicted to earn >$50K at roughly half the rate of men, reflecting 1994 census wage inequality. Demographic parity and equal opportunity metrics will likely FAIL.',
    },
    {
        key: 'credit_default',
        name: 'Credit Card Default',
        description:
            'Taiwan credit-card payment data — 30 000 clients with full 6-month payment history. Predicts whether a client will default on their payment next month.',
        domain: 'finance',
        target_column: 'default',
        target_values: { '0': 'Paid on time (no default)', '1': 'Defaulted next month' },
        sensitive_attributes: ['SEX_label'],
        sensitive_values: { SEX_label: ['Male', 'Female'] },
        key_features: ['LIMIT_BAL', 'AGE', 'PAY_0', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6', 'BILL_AMT1', 'BILL_AMT2', 'PAY_AMT1', 'PAY_AMT2'],
        reference: 'UCI Default of Credit Card Clients Dataset (30 000 rows)',
        rows: 30000,
        bias_level: 'LOW',
        bias_description:
            'Model relies almost entirely on payment history, not demographics. SHAP analysis confirms gender (SEX) has very low feature importance. Fairness metrics typically PASS — good example of a relatively fair model.',
    },
    {
        key: 'compas_recidivism',
        name: 'COMPAS Recidivism',
        description:
            'ProPublica COMPAS dataset — 6 172 Florida defendants from 2013–2014. Predicts whether a defendant will reoffend within 2 years.',
        domain: 'criminal_justice',
        target_column: 'Two_yr_Recidivism',
        target_values: { '0': 'Did not reoffend within 2 years', '1': 'Reoffended within 2 years' },
        sensitive_attributes: ['race'],
        sensitive_values: { race: ['African-American', 'Caucasian', 'Hispanic', 'Asian', 'Native American', 'Other'] },
        key_features: ['Number_of_Priors', 'Age_Above_FourtyFive', 'Age_Below_TwentyFive', 'Female', 'Misdemeanor', 'score_factor'],
        reference: 'ProPublica "Machine Bias" Investigation (2016) — 6 172 rows',
        rows: 6172,
        bias_level: 'CRITICAL',
        bias_description:
            'DOCUMENTED RACIAL BIAS — African-Americans represent 51.4% of this dataset and are flagged for recidivism at significantly higher rates than Caucasians. This is the dataset behind ProPublica\'s landmark 2016 investigation "Machine Bias". Fairness metrics on race WILL FAIL — this is intentional, demonstrating real-world algorithmic discrimination.',
    },
    {
        key: 'heart_disease',
        name: 'Heart Disease',
        description:
            'Cleveland Heart Disease dataset — 299 patients from the UCI repository. Predicts presence of cardiac disease from 13 clinical measurements.',
        domain: 'healthcare',
        target_column: 'target',
        target_values: { '0': 'No cardiac disease detected', '1': 'Cardiac disease present' },
        sensitive_attributes: ['sex_label'],
        sensitive_values: { sex_label: ['Male', 'Female'] },
        key_features: ['age', 'sex', 'cp', 'trestbps', 'chol', 'thalch', 'exang', 'oldpeak', 'slope', 'ca', 'thal'],
        reference: 'UCI Heart Disease Dataset — Cleveland (299 rows)',
        rows: 299,
        bias_level: 'MEDIUM',
        bias_description:
            'Heart disease has real clinical sex differences — symptoms and presentation differ between men and women. Expect mixed results: some fairness metrics may pass, others may flag sex-based detection disparities. Small dataset (299 rows) means results have higher variance.',
    },
    {
        key: 'ibm_hr_attrition',
        name: 'IBM HR Attrition',
        description:
            'IBM HR Analytics synthetic dataset — 1 470 employees. Predicts whether an employee will leave the company, using job satisfaction, salary, and role information.',
        domain: 'employment',
        target_column: 'Attrition_binary',
        target_values: { '0': 'Employee stayed at company', '1': 'Employee left (attrition)' },
        sensitive_attributes: ['Gender'],
        sensitive_values: { Gender: ['Male', 'Female'] },
        key_features: ['Age', 'MonthlyIncome', 'OverTime_enc', 'JobSatisfaction', 'YearsAtCompany', 'WorkLifeBalance', 'JobLevel', 'TotalWorkingYears', 'EnvironmentSatisfaction'],
        reference: 'IBM HR Analytics Employee Attrition Dataset (1 470 rows)',
        rows: 1470,
        bias_level: 'LOW',
        bias_description:
            'Synthetic dataset created by IBM — relatively balanced by gender. Only 16% of employees leave (class imbalance), handled with balanced class weights during training. Fairness metrics typically PASS. Use this as a baseline to contrast against COMPAS and Adult Income.',
    },
];

// ─────────────────────────────────────────────
// Catalogue — 5 Models
// ─────────────────────────────────────────────

const BENCHMARK_MODELS: BenchmarkEntry[] = [
    {
        key: 'model_1_income_hgbm',
        name: 'Adult Income Predictor',
        description:
            'Predicts whether a US adult earns >$50K/year. Trained on 32 561 census records using the full UCI Adult dataset.',
        domain: 'finance',
        target_column: 'income_binary',
        target_values: { '0': 'Earns ≤$50K / year', '1': 'Earns >$50K / year' },
        sensitive_attributes: ['sex'],
        sensitive_values: { sex: ['Male', 'Female'] },
        key_features: ['age', 'education.num', 'hours.per.week', 'capital.gain', 'capital.loss', 'sex_encoded', 'workclass_enc', 'marital_enc', 'occupation_enc'],
        reference: 'UCI Adult / Census Income Dataset (32 561 rows)',
        rows: 32561,
        bias_level: 'HIGH',
        bias_description:
            'Gender pay gap encoded in training data — women predicted >$50K at roughly half the rate of men. Demographic parity and equal opportunity metrics will likely FAIL.',
        accuracy: 0.8268,
        auc_roc: 0.9224,
        algorithm: 'HistGradientBoosting (400 iter, lr=0.05, depth=6)',
    },
    {
        key: 'model_2_credit_rf',
        name: 'Credit Card Default Classifier',
        description:
            'Predicts credit card payment default using full 6-month payment history. Trained on 30 000 Taiwan credit records.',
        domain: 'finance',
        target_column: 'default',
        target_values: { '0': 'Paid on time', '1': 'Defaulted' },
        sensitive_attributes: ['SEX_label'],
        sensitive_values: { SEX_label: ['Male', 'Female'] },
        key_features: ['LIMIT_BAL', 'AGE', 'PAY_0', 'PAY_2', 'PAY_3', 'PAY_4', 'PAY_5', 'PAY_6', 'BILL_AMT1', 'PAY_AMT1'],
        reference: 'UCI Default of Credit Card Clients Dataset (30 000 rows)',
        rows: 30000,
        bias_level: 'LOW',
        bias_description:
            'Payment history dominates (confirmed by SHAP). Gender has very low feature importance. Fairness metrics typically PASS — good fair model baseline.',
        accuracy: 0.7732,
        auc_roc: 0.7764,
        algorithm: 'Random Forest (300 trees, depth=10, balanced)',
    },
    {
        key: 'model_3_recidivism_logreg',
        name: 'Recidivism Risk Assessor',
        description:
            'Predicts 2-year reoffending risk. Logistic Regression chosen deliberately for interpretability in high-stakes criminal justice. Trained on ProPublica COMPAS data.',
        domain: 'criminal_justice',
        target_column: 'Two_yr_Recidivism',
        target_values: { '0': 'Did not reoffend', '1': 'Reoffended within 2 years' },
        sensitive_attributes: ['race'],
        sensitive_values: { race: ['African-American', 'Caucasian', 'Hispanic', 'Asian', 'Native American', 'Other'] },
        key_features: ['Number_of_Priors', 'Age_Above_FourtyFive', 'Age_Below_TwentyFive', 'Female', 'Misdemeanor', 'score_factor'],
        reference: 'ProPublica COMPAS Analysis (2016) — 6 172 rows',
        rows: 6172,
        bias_level: 'CRITICAL',
        bias_description:
            'DOCUMENTED RACIAL BIAS. African-Americans flagged at significantly higher rates. This replicates the bias found in ProPublica\'s 2016 "Machine Bias" investigation. Fairness metrics WILL FAIL on race.',
        accuracy: 0.6761,
        auc_roc: 0.7368,
        algorithm: 'Logistic Regression (ElasticNet, C=0.5, balanced)',
    },
    {
        key: 'model_4_heart_gbm',
        name: 'Heart Disease Detector',
        description:
            'Detects cardiac disease from 13 clinical measurements. Shallow trees prevent overfitting on this small 299-row dataset.',
        domain: 'healthcare',
        target_column: 'target',
        target_values: { '0': 'No cardiac disease', '1': 'Cardiac disease present' },
        sensitive_attributes: ['sex_label'],
        sensitive_values: { sex_label: ['Male', 'Female'] },
        key_features: ['age', 'sex', 'cp', 'trestbps', 'chol', 'thalch', 'exang', 'oldpeak', 'slope', 'ca', 'thal'],
        reference: 'UCI Heart Disease Dataset — Cleveland (299 rows)',
        rows: 299,
        bias_level: 'MEDIUM',
        bias_description:
            'Clinical sex differences in heart disease symptoms cause mixed fairness results. Some metrics may pass, others may flag sex-based detection disparities. Small dataset means higher variance.',
        accuracy: 0.8167,
        auc_roc: 0.8973,
        algorithm: 'Gradient Boosting (300 trees, depth=3, lr=0.05, subsample=0.8)',
    },
    {
        key: 'model_5_attrition_mlp',
        name: 'Employee Attrition Predictor',
        description:
            'Predicts employee attrition using job satisfaction, salary, role, and tenure data. Deep MLP with L2 regularisation handles the 20 correlated HR features.',
        domain: 'employment',
        target_column: 'Attrition_binary',
        target_values: { '0': 'Employee stayed', '1': 'Employee left (attrition)' },
        sensitive_attributes: ['Gender'],
        sensitive_values: { Gender: ['Male', 'Female'] },
        key_features: ['Age', 'MonthlyIncome', 'OverTime_enc', 'JobSatisfaction', 'YearsAtCompany', 'WorkLifeBalance', 'JobLevel', 'TotalWorkingYears', 'EnvironmentSatisfaction'],
        reference: 'IBM HR Analytics Employee Attrition Dataset (1 470 rows)',
        rows: 1470,
        bias_level: 'LOW',
        bias_description:
            'Synthetic IBM dataset, relatively balanced by gender. Fairness metrics typically PASS. Good contrast to COMPAS — shows what a fair model looks like.',
        accuracy: 0.8673,
        auc_roc: 0.7635,
        algorithm: 'MLP Neural Network (256→128→64→32 ReLU, L2 alpha=0.01)',
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
};

const DOMAIN_COLORS: Record<string, string> = {
    finance: '#2196f3',
    criminal_justice: '#f44336',
    healthcare: '#4caf50',
    employment: '#ff9800',
};

const DOMAIN_LABELS: Record<string, string> = {
    finance: 'Finance',
    criminal_justice: 'Criminal Justice',
    healthcare: 'Healthcare',
    employment: 'Employment',
};

const BIAS_CONFIG: Record<BiasLevel, { color: string; bgcolor: string; icon: React.ReactElement; label: string }> = {
    CRITICAL: { color: '#c62828', bgcolor: '#ffebee', icon: <CriticalIcon sx={{ fontSize: 14 }} />, label: 'CRITICAL BIAS' },
    HIGH:     { color: '#e65100', bgcolor: '#fff3e0', icon: <WarningIcon sx={{ fontSize: 14 }} />, label: 'HIGH BIAS' },
    MEDIUM:   { color: '#f57f17', bgcolor: '#fffde7', icon: <InfoIcon sx={{ fontSize: 14 }} />,    label: 'MEDIUM BIAS' },
    LOW:      { color: '#2e7d32', bgcolor: '#e8f5e9', icon: <CheckIcon sx={{ fontSize: 14 }} />,   label: 'LOW BIAS' },
};

function AccuracyBar({ value, auc }: { value: number; auc?: number }) {
    const pct = Math.round(value * 100);
    const color = pct >= 85 ? '#4caf50' : pct >= 75 ? '#ff9800' : '#f44336';
    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography variant="caption" color="text.secondary">Accuracy</Typography>
                <Box display="flex" gap={1.5} alignItems="center">
                    {auc !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                            AUC-ROC: <strong>{auc.toFixed(3)}</strong>
                        </Typography>
                    )}
                    <Typography variant="caption" fontWeight={700} sx={{ color }}>{pct}%</Typography>
                </Box>
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
    const bias = BIAS_CONFIG[entry.bias_level];

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
            <CardContent sx={{ pb: 1 }}>

                {/* ── Header row ── */}
                <Box display="flex" alignItems="flex-start" gap={2}>
                    <Box sx={{ color, mt: 0.5, flexShrink: 0 }}>{icon}</Box>
                    <Box flex={1} minWidth={0}>
                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                                {entry.name}
                            </Typography>
                            {alreadyImported && (
                                <Chip label="✓ Already Imported" size="small" color="success" variant="outlined" sx={{ fontSize: 11, fontWeight: 700 }} />
                            )}
                            <Chip
                                label={DOMAIN_LABELS[entry.domain] || entry.domain}
                                size="small"
                                sx={{ bgcolor: `${color}22`, color, fontWeight: 600, fontSize: 11 }}
                            />
                            <Typography variant="caption" color="text.disabled">
                                {entry.rows.toLocaleString()} rows
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {entry.description}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* ── Bias Assessment ── */}
                <Box
                    sx={{
                        bgcolor: bias.bgcolor,
                        border: `1px solid ${bias.color}44`,
                        borderRadius: 1.5,
                        px: 1.5,
                        py: 1,
                        mb: 1.5,
                    }}
                >
                    <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                        <Box sx={{ color: bias.color, display: 'flex' }}>{bias.icon}</Box>
                        <Typography variant="caption" fontWeight={700} sx={{ color: bias.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Bias Assessment: {bias.label}
                        </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: bias.color, lineHeight: 1.5 }}>
                        {entry.bias_description}
                    </Typography>
                </Box>

                {/* ── Target & Sensitive columns ── */}
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5} mb={1.5}>

                    {/* Target column */}
                    <Box
                        sx={{
                            bgcolor: 'action.hover',
                            borderRadius: 1.5,
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
                            🎯 TARGET COLUMN
                        </Typography>
                        <Chip
                            label={entry.target_column}
                            size="small"
                            variant="outlined"
                            sx={{ fontFamily: 'monospace', fontSize: 11, mb: 0.75, fontWeight: 700 }}
                        />
                        <Box display="flex" flexDirection="column" gap={0.4} mt={0.25}>
                            <Typography variant="caption" color="text.secondary">
                                <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: 'action.selected', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>0</Box>
                                {entry.target_values['0']}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: 'action.selected', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>1</Box>
                                {entry.target_values['1']}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Sensitive attributes */}
                    <Box
                        sx={{
                            bgcolor: 'action.hover',
                            borderRadius: 1.5,
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
                            ⚖️ SENSITIVE FEATURE{entry.sensitive_attributes.length > 1 ? 'S' : ''}
                        </Typography>
                        {entry.sensitive_attributes.map((attr) => (
                            <Box key={attr} mb={0.75}>
                                <Chip
                                    label={attr}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ fontSize: 11, fontWeight: 700, mb: 0.5, fontFamily: 'monospace' }}
                                />
                                <Box display="flex" flexWrap="wrap" gap={0.4}>
                                    {(entry.sensitive_values[attr] || []).map((val) => (
                                        <Tooltip key={val} title={`Possible value for ${attr}`}>
                                            <Chip
                                                label={val}
                                                size="small"
                                                sx={{ fontSize: 10, height: 18, '& .MuiChip-label': { px: 0.75 } }}
                                            />
                                        </Tooltip>
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* ── Algorithm (models only) ── */}
                {entry.algorithm && (
                    <Box mb={1.5} sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 1.25, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                            🤖 ALGORITHM
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {entry.algorithm}
                        </Typography>
                    </Box>
                )}

                {/* ── Accuracy bar (models only) ── */}
                {entry.accuracy !== undefined && (
                    <Box mb={1.5}>
                        <AccuracyBar value={entry.accuracy} auc={entry.auc_roc} />
                    </Box>
                )}

                {/* ── Key features ── */}
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
                        KEY FEATURES
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {entry.key_features.slice(0, 8).map((f) => (
                            <Chip key={f} label={f} size="small" sx={{ fontFamily: 'monospace', fontSize: 10 }} />
                        ))}
                        {entry.key_features.length > 8 && (
                            <Chip label={`+${entry.key_features.length - 8} more`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        )}
                    </Box>
                </Box>

                {/* ── Reference ── */}
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
                    setError('This dataset is already imported into this project.');
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
                    setError('This model is already imported into this project.');
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
                    5 real-world models and paired datasets — each card shows target column, sensitive features, and bias assessment.
                </Typography>

                {/* Legend */}
                <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                    {(Object.entries(BIAS_CONFIG) as [BiasLevel, typeof BIAS_CONFIG[BiasLevel]][]).map(([level, cfg]) => (
                        <Box
                            key={level}
                            display="flex"
                            alignItems="center"
                            gap={0.5}
                            sx={{ bgcolor: cfg.bgcolor, border: `1px solid ${cfg.color}44`, borderRadius: 1, px: 1, py: 0.25 }}
                        >
                            <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
                            <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 700, fontSize: 10 }}>{cfg.label}</Typography>
                        </Box>
                    ))}
                </Box>
            </DialogTitle>

            <Box px={3} pt={1}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab icon={<DatasetIcon fontSize="small" />} iconPosition="start" label="Datasets (5)" id="bm-tab-0" aria-controls="bm-panel-0" />
                    <Tab icon={<ModelIcon fontSize="small" />} iconPosition="start" label="Models (5)" id="bm-tab-1" aria-controls="bm-panel-1" />
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
                                        (n) => n.toLowerCase().includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(n.toLowerCase())
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
                <Button onClick={onClose} disabled={isBusy}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
