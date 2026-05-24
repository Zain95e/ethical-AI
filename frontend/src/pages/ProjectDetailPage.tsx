// Project detail page with model/dataset upload

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    LinearProgress,
    Checkbox,
    Tooltip,
    Stack,
    useTheme,
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    CloudUpload as UploadIcon,
    CloudDownload as ImportIcon,
    Delete as DeleteIcon,
    PlayArrow as RunIcon,
    ModelTraining as ModelIcon,
    Storage as DatasetIcon,
    Assessment as ValidationIcon,
    Assignment as RequirementIcon,
    AutoFixHigh as ElicitIcon,
    AccountTree as TraceIcon,
    ContentCopy as DuplicateIcon,
    Edit as EditIcon,
    CompareArrows as CompareIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, modelsApi, datasetsApi, validationApi, requirementsApi, traceabilityApi, templatesApi, getApiErrorMessage } from '../services/api';
import BenchmarkDatasetLoader from '../components/BenchmarkDatasetLoader';
import TraceabilityMatrix from '../components/TraceabilityMatrix';
import DatasetProfile from '../components/DatasetProfile';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Template, Requirement, MLModel, Dataset } from '../types';

const formatChartNumber = (value: unknown): string => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value ?? '');
};

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

// ---------------------------------------------------------------------------
// Comparison Modal
// ---------------------------------------------------------------------------
type MetricDetail = { value: number | null; threshold: number | null; passed: boolean | null };
type PrincipleMetrics = Record<string, MetricDetail>;

interface ValidationHistoryItem {
    suite_id: string;
    started_at: string;
    completed_at: string | null;
    overall_passed: boolean | null;
    model_name: string | null;
    dataset_name: string;
    validations: {
        fairness?: {
            completed: boolean;
            passed_count: number;
            metrics_count: number;
            metrics?: PrincipleMetrics;
        };
        transparency?: {
            completed: boolean;
            passed_count: number;
            metrics_count: number;
            metrics?: PrincipleMetrics;
        };
        privacy?: {
            completed: boolean;
            passed_count: number;
            metrics_count: number;
            metrics?: PrincipleMetrics;
        };
    };
}

function CompareModal({ open, onClose, runA, runB }: { open: boolean; onClose: () => void; runA: ValidationHistoryItem | null | undefined; runB: ValidationHistoryItem | null | undefined }) {
    if (!runA || !runB) return null;

    const principles: Array<{ key: 'fairness' | 'transparency' | 'privacy'; label: string }> = [
        { key: 'fairness', label: 'Fairness' },
        { key: 'transparency', label: 'Transparency' },
        { key: 'privacy', label: 'Privacy' },
    ];

    const fmt = (v: number | null | undefined) => (v == null ? '\u2014' : Number(v).toFixed(4));

    const deltaColor = (delta: number | null, mkey: string): string => {
        if (delta == null) return 'text.primary';
        const lowerBetter = ['difference', 'disparity'];
        const goodDirection = lowerBetter.some((k) => mkey.includes(k)) ? delta < 0 : delta > 0;
        if (delta === 0) return 'text.secondary';
        return goodDirection ? 'success.main' : 'error.main';
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                Compare Validation Runs
                <Typography variant="body2" color="text.secondary">
                    Run A: {new Date(runA.started_at).toLocaleString()} &nbsp;·&nbsp;
                    Run B: {new Date(runB.started_at).toLocaleString()}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {principles.map(({ key, label }) => {
                    const metricsA: PrincipleMetrics = runA.validations?.[key]?.metrics || {};
                    const metricsB: PrincipleMetrics = runB.validations?.[key]?.metrics || {};
                    const allKeys = Array.from(new Set([...Object.keys(metricsA), ...Object.keys(metricsB)]));
                    const eitherRun = runA.validations?.[key]?.completed || runB.validations?.[key]?.completed;
                    if (!eitherRun) return null;
                    return (
                        <Box key={key} sx={{ mb: 4 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, textTransform: 'uppercase', letterSpacing: 1, color: 'primary.main' }}>
                                {label}
                            </Typography>
                            {allKeys.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">No per-metric breakdown available.</Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Run A &nbsp;<Typography component="span" variant="caption" color="text.secondary">{new Date(runA.started_at).toLocaleDateString()}</Typography></TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Run B &nbsp;<Typography component="span" variant="caption" color="text.secondary">{new Date(runB.started_at).toLocaleDateString()}</Typography></TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Delta (B − A)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {allKeys.map((mkey) => {
                                            const a = metricsA[mkey];
                                            const b = metricsB[mkey];
                                            const delta = a?.value != null && b?.value != null ? b.value - a.value : null;
                                            return (
                                                <TableRow key={mkey} hover>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                                        {mkey.replace(/_/g, ' ')}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {a ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                                                <Typography variant="body2">{fmt(a.value)}</Typography>
                                                                <Chip label={a.passed ? 'PASS' : 'FAIL'} color={a.passed ? 'success' : 'error'} size="small" />
                                                            </Box>
                                                        ) : <Typography variant="body2" color="text.disabled">&mdash;</Typography>}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {b ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                                                <Typography variant="body2">{fmt(b.value)}</Typography>
                                                                <Chip label={b.passed ? 'PASS' : 'FAIL'} color={b.passed ? 'success' : 'error'} size="small" />
                                                            </Box>
                                                        ) : <Typography variant="body2" color="text.disabled">&mdash;</Typography>}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: deltaColor(delta, mkey) }}>
                                                            {delta == null ? '\u2014' : `${delta > 0 ? '+' : ''}${delta.toFixed(4)}`}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </Box>
                    );
                })}
                {/* Overall verdict */}
                <Box sx={{ display: 'flex', gap: 4, mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Run A Overall</Typography>
                        <Box sx={{ mt: 0.5 }}><Chip label={runA.overall_passed ? 'PASSED' : 'FAILED'} color={runA.overall_passed ? 'success' : 'error'} /></Box>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Run B Overall</Typography>
                        <Box sx={{ mt: 0.5 }}><Chip label={runB.overall_passed ? 'PASSED' : 'FAILED'} color={runB.overall_passed ? 'success' : 'error'} /></Box>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
// ---------------------------------------------------------------------------

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <div hidden={value !== index} style={{ paddingTop: 24 }}>
            {value === index && children}
        </div>
    );
}

// File upload area component
function FileUploadArea({
    accept,
    onFileSelect,
    uploading,
    progress,
    selectedFile,
}: {
    accept: string;
    onFileSelect: (file: File) => void;
    uploading: boolean;
    progress: number;
    selectedFile?: File | null;
}) {
    const [dragOver, setDragOver] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
    }, [onFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    return (
        <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: dragOver ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                transition: 'all 0.2s',
                cursor: uploading ? 'not-allowed' : 'pointer',
            }}
        >
            {uploading ? (
                <Box>
                    <CircularProgress size={48} sx={{ mb: 2 }} />
                    <Typography>Uploading...</Typography>
                    <LinearProgress variant="determinate" value={progress} sx={{ mt: 2, mx: 'auto', maxWidth: 300 }} />
                </Box>
            ) : (
                <>
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    {selectedFile ? (
                        <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                            {selectedFile.name}
                        </Typography>
                    ) : (
                        <>
                            <Typography variant="h6" gutterBottom>
                                Drag & drop file here
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                or click to browse
                            </Typography>
                        </>
                    )}
                    <Button
                        variant="outlined"
                        component="label"
                        sx={{ mt: 1 }}
                    >
                        {selectedFile ? 'Change File' : 'Select File'}
                        <input
                            type="file"
                            hidden
                            accept={accept}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onFileSelect(file);
                                // Reset so the same file can be re-selected after a validation error
                                e.target.value = '';
                            }}
                        />
                    </Button>
                </>
            )}
        </Box>
    );
}

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const theme = useTheme();

    const [tab, setTab] = useState(0);
    const [uploadModelOpen, setUploadModelOpen] = useState(false);
    const [uploadDatasetOpen, setUploadDatasetOpen] = useState(false);
    const [benchmarkLoaderOpen, setBenchmarkLoaderOpen] = useState(false);
    const [modelName, setModelName] = useState('');
    const [datasetName, setDatasetName] = useState('');
    const [pendingModelFile, setPendingModelFile] = useState<File | null>(null);
    const [pendingDatasetFile, setPendingDatasetFile] = useState<File | null>(null);
    const [sensitiveAttrs, setSensitiveAttrs] = useState('');
    const [targetColumn, setTargetColumn] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());
    const [compareModalOpen, setCompareModalOpen] = useState(false);
    const [profileDatasetId, setProfileDatasetId] = useState<string>('');
    const [profileQuasiIdentifiers, setProfileQuasiIdentifiers] = useState<string[]>([]);
    const [profileSensitiveAttribute, setProfileSensitiveAttribute] = useState<string>('');

    const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;
    const MODEL_EXTENSIONS = new Set(['.pkl', '.joblib', '.pickle', '.h5', '.keras', '.pt', '.pth', '.onnx']);
    const DATASET_EXTENSIONS = new Set(['.csv', '.xlsx', '.parquet']);

    const getFileExtension = (filename: string): string => {
        const dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
    };

    // Fetch project
    const { data: project, isLoading: projectLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => projectsApi.get(id!),
        enabled: !!id,
    });

    // Fetch models
    const { data: models, isLoading: modelsLoading } = useQuery<MLModel[]>({
        queryKey: ['models', id],
        queryFn: () => modelsApi.list(id!),
        enabled: !!id,
    });

    // Fetch datasets
    const { data: datasets, isLoading: datasetsLoading } = useQuery<Dataset[]>({
        queryKey: ['datasets', id],
        queryFn: () => datasetsApi.list(id!),
        enabled: !!id,
    });

    // Fetch validation history
    const { data: savedRequirements = [] } = useQuery<Requirement[]>({
        queryKey: ['requirements', id],
        queryFn: () => requirementsApi.listByProject(id!),
        enabled: !!id,
    });

    // Fetch templates for requirement source lookup (Phase 5)
    const { data: allTemplates = [] } = useQuery<Template[]>({
        queryKey: ['templates'],
        queryFn: () => templatesApi.list(),
        enabled: !!id,
    });
    const templateMap = new Map(allTemplates.map((t) => [t.id, t]));

    // Duplicate requirement mutation (Phase 5 – 6.7)
    const duplicateRequirementMutation = useMutation({
        mutationFn: (req: Requirement) =>
            requirementsApi.create(id!, {
                name: `${req.name} (Copy)`,
                principle: req.principle,
                description: req.description ?? undefined,
                specification: req.specification,
                based_on_template_id: req.based_on_template_id ?? undefined,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requirements', id] });
        },
    });

    const { data: validationHistory, isLoading: validationsLoading } = useQuery<ValidationHistoryItem[]>({
        queryKey: ['validations', id],
        queryFn: () => validationApi.getHistory(id!),
        enabled: !!id && tab === 3,
    });

    const { data: traceabilityData, isLoading: traceabilityLoading, error: traceabilityError, refetch: refetchTraceability } = useQuery({
        queryKey: ['traceability', id],
        queryFn: () => traceabilityApi.getMatrix(id!),
        enabled: !!id && tab === 4,
        refetchOnMount: 'always',
    });

    const { data: datasetProfile, isLoading: datasetProfileLoading } = useQuery({
        queryKey: ['dataset-profile', profileDatasetId],
        queryFn: () => datasetsApi.getProfile(profileDatasetId),
        enabled: !!profileDatasetId,
    });

    const handleOpenProfile = (datasetId: string) => {
        setProfileDatasetId(datasetId);
        setProfileQuasiIdentifiers([]);
        setProfileSensitiveAttribute('');
    };

    const toggleProfileQuasiIdentifier = (column: string) => {
        setProfileQuasiIdentifiers((prev) =>
            prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column],
        );
    };

    const openValidationWithProfileSelection = () => {
        if (!profileDatasetId) {
            navigate(`/projects/${id}/validate`);
            return;
        }

        const params = new URLSearchParams();
        params.set('dataset_id', profileDatasetId);
        params.set('selected_validators', 'privacy');
        if (profileQuasiIdentifiers.length > 0) {
            params.set('quasi_identifiers', profileQuasiIdentifiers.join(','));
        }
        if (profileSensitiveAttribute) {
            params.set('sensitive_attribute', profileSensitiveAttribute);
        }
        navigate(`/projects/${id}/validate?${params.toString()}`);
    };

    // Upload model
    const handleModelUpload = async (file: File) => {
        if (!modelName.trim()) {
            setError('Please enter a model name');
            return;
        }

        const ext = getFileExtension(file.name);
        if (!MODEL_EXTENSIONS.has(ext)) {
            setError('Unsupported model format. Allowed: .pkl, .joblib, .pickle, .h5, .keras, .pt, .pth, .onnx');
            return;
        }

        if (file.size <= 0) {
            setError('Selected model file is empty');
            return;
        }

        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
            setError('Model file exceeds 500 MB upload limit');
            return;
        }

        setUploading(true);
        setError('');

        try {
            await modelsApi.upload(id!, file, modelName);
            queryClient.invalidateQueries({ queryKey: ['models', id] });
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            setUploadModelOpen(false);
            setModelName('');
            setPendingModelFile(null);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Model upload failed'));
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Upload dataset
    const handleDatasetUpload = async (file: File) => {
        if (!datasetName.trim()) {
            setError('Please enter a dataset name');
            return;
        }

        const ext = getFileExtension(file.name);
        if (!DATASET_EXTENSIONS.has(ext)) {
            setError('Unsupported dataset format. Allowed: .csv, .xlsx, .parquet');
            return;
        }

        if (file.size <= 0) {
            setError('Selected dataset file is empty');
            return;
        }

        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
            setError('Dataset file exceeds 500 MB upload limit');
            return;
        }

        setUploading(true);
        setError('');

        try {
            await datasetsApi.upload(id!, file, datasetName, sensitiveAttrs, targetColumn);
            queryClient.invalidateQueries({ queryKey: ['datasets', id] });
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            setUploadDatasetOpen(false);
            setDatasetName('');
            setSensitiveAttrs('');
            setTargetColumn('');
            setPendingDatasetFile(null);
        } catch (err) {
            setError(getApiErrorMessage(err, 'Dataset upload failed'));
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Delete model
    const handleDeleteModel = async (modelId: string) => {
        if (!confirm('Are you sure you want to delete this model?')) return;

        try {
            await modelsApi.delete(modelId);
            queryClient.invalidateQueries({ queryKey: ['models', id] });
            queryClient.invalidateQueries({ queryKey: ['project', id] });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete model');
        }
    };

    // Delete dataset
    const handleDeleteDataset = async (datasetId: string) => {
        if (!confirm('Are you sure you want to delete this dataset?')) return;

        try {
            await datasetsApi.delete(datasetId);
            queryClient.invalidateQueries({ queryKey: ['datasets', id] });
            queryClient.invalidateQueries({ queryKey: ['project', id] });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete dataset');
        }
    };

    if (projectLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!project) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Alert severity="error">Project not found</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <IconButton onClick={() => navigate('/projects')} sx={{ mr: 2 }}>
                    <BackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {project.name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {project.description || 'No description'}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<RunIcon />}
                    onClick={() => navigate(`/projects/${id}/validate`)}
                >
                    Run Validation
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<TraceIcon />}
                    onClick={() => navigate(`/projects/${id}/traceability`)}
                    sx={{ ml: 1 }}
                >
                    Traceability
                </Button>
            </Box>

            {/* Tabs */}
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab icon={<ModelIcon />} iconPosition="start" label={`Models (${models?.length || 0})`} />
                <Tab icon={<DatasetIcon />} iconPosition="start" label={`Datasets (${datasets?.length || 0})`} />
                <Tab icon={<RequirementIcon />} iconPosition="start" label={`Requirements (${savedRequirements.length})`} />
                <Tab icon={<ValidationIcon />} iconPosition="start" label="Validations" />
                <Tab icon={<TraceIcon />} iconPosition="start" label="Traceability" />
            </Tabs>

            {/* Models Tab */}
            <TabPanel value={tab} index={0}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<ImportIcon />}
                        onClick={() => setBenchmarkLoaderOpen(true)}
                    >
                        Import Benchmark
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={() => setUploadModelOpen(true)}
                    >
                        Upload Model
                    </Button>
                </Box>

                {modelsLoading ? (
                    <CircularProgress />
                ) : models?.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <ModelIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No models uploaded yet
                            </Typography>
                            <Button
                                variant="outlined"
                                startIcon={<UploadIcon />}
                                sx={{ mt: 2 }}
                                onClick={() => setUploadModelOpen(true)}
                            >
                                Upload First Model
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Card}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Version</TableCell>
                                    <TableCell>Size</TableCell>
                                    <TableCell>Uploaded</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {models?.map((model: MLModel) => (
                                    <TableRow key={model.id}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <ModelIcon sx={{ mr: 1, color: 'primary.main' }} />
                                                {model.name}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip
                                                title={(model.model_metadata?.algorithm as string | undefined) || model.model_type}
                                                placement="top"
                                            >
                                                <Chip
                                                    label={
                                                        typeof model.model_metadata?.algorithm === 'string'
                                                            ? model.model_metadata.algorithm.split('(')[0].trim()
                                                            : model.model_type
                                                    }
                                                    size="small"
                                                    color={
                                                        model.model_metadata?.benchmark ? 'primary' : 'default'
                                                    }
                                                    variant={model.model_metadata?.benchmark ? 'outlined' : 'filled'}
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{model.version}</TableCell>
                                        <TableCell>{(model.file_size / 1024).toFixed(1)} KB</TableCell>
                                        <TableCell>
                                            {new Date(model.uploaded_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteModel(model.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </TabPanel>

            {/* Datasets Tab */}
            <TabPanel value={tab} index={1}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => setBenchmarkLoaderOpen(true)}
                    >
                        Import Benchmark
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<UploadIcon />}
                        onClick={() => setUploadDatasetOpen(true)}
                    >
                        Upload Dataset
                    </Button>
                </Box>

                {datasetsLoading ? (
                    <CircularProgress />
                ) : datasets?.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <DatasetIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No datasets uploaded yet
                            </Typography>
                            <Button
                                variant="outlined"
                                startIcon={<UploadIcon />}
                                sx={{ mt: 2 }}
                                onClick={() => setUploadDatasetOpen(true)}
                            >
                                Upload First Dataset
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <TableContainer component={Card}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Rows</TableCell>
                                        <TableCell>Columns</TableCell>
                                        <TableCell>Sensitive Attrs</TableCell>
                                        <TableCell>Uploaded</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {datasets?.map((dataset: Dataset) => (
                                        <TableRow key={dataset.id}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <DatasetIcon sx={{ mr: 1, color: 'secondary.main' }} />
                                                    {dataset.name}
                                                </Box>
                                            </TableCell>
                                            <TableCell>{dataset.row_count?.toLocaleString()}</TableCell>
                                            <TableCell>{dataset.column_count}</TableCell>
                                            <TableCell>
                                                {dataset.sensitive_attributes?.length > 0 ? (
                                                    dataset.sensitive_attributes.map((attr: string) => (
                                                        <Chip key={attr} label={attr} size="small" sx={{ mr: 0.5 }} />
                                                    ))
                                                ) : (
                                                    <Typography variant="body2" color="text.disabled">None</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(dataset.uploaded_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    variant={profileDatasetId === dataset.id ? 'contained' : 'outlined'}
                                                    sx={{ mr: 1 }}
                                                    onClick={() => handleOpenProfile(dataset.id)}
                                                >
                                                    Profile
                                                </Button>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteDataset(dataset.id)}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {profileDatasetId && (
                            <Box sx={{ mt: 2 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        Column Profiling
                                    </Typography>
                                    <Button variant="contained" onClick={openValidationWithProfileSelection}>
                                        Validate With Selected Columns
                                    </Button>
                                </Stack>
                                {datasetProfileLoading ? (
                                    <CircularProgress sx={{ mt: 2 }} />
                                ) : datasetProfile ? (
                                    <DatasetProfile
                                        profile={datasetProfile}
                                        selectedQuasiIdentifiers={profileQuasiIdentifiers}
                                        selectedSensitiveAttribute={profileSensitiveAttribute}
                                        onToggleQuasiIdentifier={toggleProfileQuasiIdentifier}
                                        onSetSensitiveAttribute={setProfileSensitiveAttribute}
                                    />
                                ) : null}
                            </Box>
                        )}
                    </>
                )}
            </TabPanel>

            {/* Requirements Tab (Phase 5 – 6.7 improved) */}
            <TabPanel value={tab} index={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        Define ethical requirements and use Cognitive RE to auto-generate them from your data and model.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<ElicitIcon />}
                        onClick={() => navigate(`/projects/${id}/requirements/elicit`)}
                    >
                        Elicit Requirements
                    </Button>
                </Box>
                {savedRequirements.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <RequirementIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No requirements defined yet
                            </Typography>
                            <Button
                                variant="outlined"
                                startIcon={<ElicitIcon />}
                                sx={{ mt: 2 }}
                                onClick={() => navigate(`/projects/${id}/requirements/elicit`)}
                            >
                                Elicit Requirements
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <TableContainer component={Card}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Principle</TableCell>
                                    <TableCell>Source</TableCell>
                                    <TableCell>Rules</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {savedRequirements.map((req: Requirement) => {
                                    const srcTemplate = req.based_on_template_id
                                        ? templateMap.get(req.based_on_template_id)
                                        : null;
                                    const sourceLabel = srcTemplate
                                        ? `Template (${srcTemplate.template_id})`
                                        : req.elicited_automatically
                                        ? 'Auto-generated'
                                        : 'Manual';
                                    const sourceColor: 'primary' | 'secondary' | 'default' = srcTemplate
                                        ? 'secondary'
                                        : req.elicited_automatically
                                        ? 'primary'
                                        : 'default';
                                    return (
                                        <TableRow key={req.id} hover>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={500}>{req.name}</Typography>
                                                {req.description && (
                                                    <Typography variant="caption" color="text.secondary">{req.description}</Typography>
                                                )}
                                                {srcTemplate && (
                                                    <Chip
                                                        label={`From ${srcTemplate.name}`}
                                                        size="small"
                                                        variant="outlined"
                                                        color="secondary"
                                                        sx={{ mt: 0.5, display: 'block', width: 'fit-content' }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip label={req.principle} size="small" />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={sourceLabel}
                                                    size="small"
                                                    variant="outlined"
                                                    color={sourceColor}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {req.specification?.rules?.length ?? 0} rule(s)
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => navigate(`/projects/${id}/requirements/elicit`)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="small"
                                                    startIcon={<DuplicateIcon />}
                                                    onClick={() => duplicateRequirementMutation.mutate(req)}
                                                    disabled={duplicateRequirementMutation.isPending}
                                                >
                                                    Duplicate
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </TabPanel>

            {/* Validations Tab */}
            <TabPanel value={tab} index={3}>
                {validationsLoading ? (
                    <CircularProgress />
                ) : validationHistory?.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <ValidationIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No validations run yet
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<RunIcon />}
                                sx={{ mt: 2 }}
                                onClick={() => navigate(`/projects/${id}/validate`)}
                            >
                                Run First Validation
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="h6">Validation History</Typography>
                                {compareSelected.size > 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                        {compareSelected.size} selected
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title={compareSelected.size !== 2 ? 'Select exactly 2 runs to compare' : ''}>
                                    <span>
                                        <Button
                                            variant="outlined"
                                            startIcon={<CompareIcon />}
                                            disabled={compareSelected.size !== 2}
                                            onClick={() => setCompareModalOpen(true)}
                                        >
                                            Compare ({compareSelected.size}/2)
                                        </Button>
                                    </span>
                                </Tooltip>
                                <Button
                                    variant="contained"
                                    startIcon={<RunIcon />}
                                    onClick={() => navigate(`/projects/${id}/validate`)}
                                >
                                    Run New Validation
                                </Button>
                            </Box>
                        </Box>

                        {/* Fairness Metrics Over Time Chart */}
                        {(() => {
                            const chartRuns = (validationHistory || [])
                                .filter((v: ValidationHistoryItem) => !!(v.validations?.fairness?.completed && v.validations.fairness.metrics && Object.keys(v.validations.fairness.metrics).length > 0))
                                .reverse(); // oldest first
                            if (chartRuns.length < 2) {
                                return (
                                    <Card sx={{ mb: 3 }}>
                                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                Run at least 2 validations with fairness metrics to see the trend chart.
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                );
                            }
                            // Collect all metric keys across runs
                            const metricKeys = new Set<string>();
                            chartRuns.forEach((v: ValidationHistoryItem) => {
                                if (v.validations?.fairness?.metrics) {
                                    Object.keys(v.validations.fairness.metrics).forEach((k: string) => metricKeys.add(k));
                                }
                            });
                            const chartData = chartRuns.map((v: ValidationHistoryItem) => {
                                const point: Record<string, string | number> = { date: new Date(v.started_at).toLocaleDateString() };
                                metricKeys.forEach((k) => {
                                    const m = v.validations?.fairness?.metrics?.[k];
                                    if (m && m.value !== null) point[k] = Number(m.value);
                                });
                                return point;
                            });
                            const COLORS = ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336', '#00bcd4', '#ffeb3b'];
                            
                            const isDark = theme.palette.mode === 'dark';
                            return (
                                <Card sx={{ 
                                    mb: 3, 
                                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)', 
                                    backdropFilter: 'blur(10px)', 
                                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)' 
                                }}>
                                    <CardContent>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
                                            Fairness Metrics Over Time
                                        </Typography>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                                                <XAxis 
                                                    dataKey="date" 
                                                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }} 
                                                    axisLine={{ stroke: theme.palette.divider }}
                                                    tickLine={{ stroke: theme.palette.divider }}
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 11, fill: theme.palette.text.secondary }} 
                                                    axisLine={{ stroke: theme.palette.divider }}
                                                    tickLine={{ stroke: theme.palette.divider }}
                                                    domain={[0, 'auto']} 
                                                    tickFormatter={formatChartNumber} 
                                                />
                                                <RechartsTooltip 
                                                    formatter={(value) => formatChartNumber(value)}
                                                    contentStyle={{ 
                                                        backgroundColor: theme.palette.background.paper, 
                                                        border: '1px solid ' + theme.palette.divider,
                                                        borderRadius: '8px',
                                                        color: theme.palette.text.primary,
                                                        boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.08)'
                                                    }}
                                                    itemStyle={{ padding: '2px 0' }}
                                                    labelStyle={{ fontWeight: 700, marginBottom: '8px', color: theme.palette.text.secondary }}
                                                />
                                                <Legend 
                                                    wrapperStyle={{ paddingTop: '20px' }}
                                                    formatter={(value) => <span style={{ color: theme.palette.text.secondary, fontSize: '12px' }}>{value}</span>}
                                                />
                                                {Array.from(metricKeys).map((key, idx) => (
                                                    <Line
                                                        key={key}
                                                        type="monotone"
                                                        dataKey={key}
                                                        name={key.replace(/_/g, ' ')}
                                                        stroke={COLORS[idx % COLORS.length]}
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 2, stroke: '#0f172a' }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                        connectNulls
                                                    />
                                                ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            );
                        })()}
                        
                        <TableContainer component={Card}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Tooltip title="Select to compare (max 2)">
                                                <span><Checkbox disabled /></span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Model</TableCell>
                                        <TableCell>Dataset</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Fairness</TableCell>
                                        <TableCell>Transparency</TableCell>
                                        <TableCell>Privacy</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {validationHistory?.map((validation: ValidationHistoryItem) => (
                                        <TableRow
                                            key={validation.suite_id}
                                            selected={compareSelected.has(validation.suite_id)}
                                            sx={{ '&.Mui-selected': { bgcolor: 'action.selected' } }}
                                        >
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={compareSelected.has(validation.suite_id)}
                                                    disabled={!compareSelected.has(validation.suite_id) && compareSelected.size >= 2}
                                                    onChange={(e) => {
                                                        setCompareSelected((prev) => {
                                                            const next = new Set(prev);
                                                            if (e.target.checked) next.add(validation.suite_id);
                                                            else next.delete(validation.suite_id);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {new Date(validation.started_at).toLocaleDateString()}
                                                <br />
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(validation.started_at).toLocaleTimeString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {validation.model_name || (
                                                    <Chip label="Dataset Only" size="small" color="info" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>{validation.dataset_name}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={validation.overall_passed ? 'PASSED' : 'FAILED'}
                                                    color={validation.overall_passed ? 'success' : 'error'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {validation.validations?.fairness?.completed ? (
                                                    <Chip
                                                        label={`${validation.validations.fairness.passed_count}/${validation.validations.fairness.metrics_count}`}
                                                        color={validation.validations.fairness.passed_count === validation.validations.fairness.metrics_count ? 'success' : 'warning'}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Chip label="N/A" size="small" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {validation.validations?.transparency?.completed ? (
                                                    <Chip
                                                        label={`${validation.validations.transparency.passed_count}/${validation.validations.transparency.metrics_count}`}
                                                        color={validation.validations.transparency.passed_count === validation.validations.transparency.metrics_count ? 'success' : 'warning'}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Chip label="N/A" size="small" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {validation.validations?.privacy?.completed ? (
                                                    <Chip
                                                        label={`${validation.validations.privacy.passed_count}/${validation.validations.privacy.metrics_count}`}
                                                        color={validation.validations.privacy.passed_count === validation.validations.privacy.metrics_count ? 'success' : 'warning'}
                                                        size="small"
                                                    />
                                                ) : (
                                                    <Chip label="N/A" size="small" variant="outlined" />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    onClick={() => navigate(`/projects/${id}/validate?suite=${validation.suite_id}`)}
                                                >
                                                    View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Compare modal */}
                        {(() => {
                            const [idA, idB] = Array.from(compareSelected);
                            const runA = validationHistory?.find((v: ValidationHistoryItem) => v.suite_id === idA);
                            const runB = validationHistory?.find((v: ValidationHistoryItem) => v.suite_id === idB);
                            return (
                                <CompareModal
                                    open={compareModalOpen}
                                    onClose={() => setCompareModalOpen(false)}
                                    runA={runA}
                                    runB={runB}
                                />
                            );
                        })()}
                    </>
                )}
            </TabPanel>

            {/* Traceability Tab */}
            <TabPanel value={tab} index={4}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Requirement Traceability Matrix</Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="outlined"
                            onClick={() => refetchTraceability()}
                            disabled={traceabilityLoading}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<TraceIcon />}
                            onClick={() => navigate(`/projects/${id}/traceability`)}
                        >
                            Full Traceability View
                        </Button>
                    </Stack>
                </Box>
                {traceabilityError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Failed to load traceability data: {(traceabilityError as Error).message}
                    </Alert>
                )}
                <TraceabilityMatrix
                    traces={traceabilityData?.traces || []}
                    loading={traceabilityLoading}
                    onViewRootCause={(validationId) => navigate(`/projects/${id}/traceability?rootCause=${validationId}`)}
                />
            </TabPanel>

            {/* Upload Model Dialog */}
            <Dialog
                open={uploadModelOpen}
                onClose={() => { setUploadModelOpen(false); setPendingModelFile(null); setError(''); }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Upload Model</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <TextField
                        label="Model Name"
                        fullWidth
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        sx={{ mb: 3, mt: 1 }}
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Supported formats: .pkl, .joblib, .h5, .keras, .pt, .pth, .onnx
                    </Typography>

                    <FileUploadArea
                        accept=".pkl,.joblib,.pickle,.h5,.keras,.pt,.pth,.onnx"
                        onFileSelect={(f) => { setError(''); setPendingModelFile(f); }}
                        uploading={uploading}
                        progress={uploadProgress}
                        selectedFile={pendingModelFile}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setUploadModelOpen(false); setPendingModelFile(null); setError(''); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!pendingModelFile || uploading}
                        onClick={() => pendingModelFile && handleModelUpload(pendingModelFile)}
                    >
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Upload Dataset Dialog */}
            <Dialog
                open={uploadDatasetOpen}
                onClose={() => { setUploadDatasetOpen(false); setPendingDatasetFile(null); setError(''); }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Upload Dataset</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <TextField
                        label="Dataset Name"
                        fullWidth
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value)}
                        sx={{ mb: 2, mt: 1 }}
                    />

                    <TextField
                        label="Sensitive Attributes (comma-separated)"
                        fullWidth
                        value={sensitiveAttrs}
                        onChange={(e) => setSensitiveAttrs(e.target.value)}
                        placeholder="e.g., gender, race, age"
                        helperText="Columns to use for fairness analysis"
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        label="Target Column"
                        fullWidth
                        value={targetColumn}
                        onChange={(e) => setTargetColumn(e.target.value)}
                        placeholder="e.g., approved, label"
                        helperText="The prediction target column"
                        sx={{ mb: 3 }}
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Supported formats: CSV, Excel (.xlsx), Parquet
                    </Typography>

                    <FileUploadArea
                        accept=".csv,.xlsx,.parquet"
                        onFileSelect={(f) => { setError(''); setPendingDatasetFile(f); }}
                        uploading={uploading}
                        progress={uploadProgress}
                        selectedFile={pendingDatasetFile}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setUploadDatasetOpen(false); setPendingDatasetFile(null); setError(''); }}>Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={!pendingDatasetFile || uploading}
                        onClick={() => pendingDatasetFile && handleDatasetUpload(pendingDatasetFile)}
                    >
                        Upload
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Benchmark Dataset Loader */}
            <BenchmarkDatasetLoader
                open={benchmarkLoaderOpen}
                onClose={() => setBenchmarkLoaderOpen(false)}
                projectId={id!}
                existingModelNames={(models ?? []).map((m: MLModel) => m.name)}
                existingDatasetNames={(datasets ?? []).map((d: Dataset) => d.name)}
                onSuccess={(name, type) => {
                    if (type === 'model') {
                        queryClient.invalidateQueries({ queryKey: ['models', id] });
                        queryClient.invalidateQueries({ queryKey: ['project', id] });
                        alert(`Successfully imported model: ${name}`);
                    } else {
                        queryClient.invalidateQueries({ queryKey: ['datasets', id] });
                        queryClient.invalidateQueries({ queryKey: ['project', id] });
                        alert(`Successfully imported dataset: ${name}`);
                    }
                }}
            />
        </Container>
    );
}
