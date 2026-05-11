import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Card,
    CardContent,
    Tabs,
    Tab,
    Chip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import WebIcon from '@mui/icons-material/Web';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import { reportsApi, traceabilityApi } from '../services/api';
import CertificateModal from '../components/CertificateModal';
import SHAPVisualization from '../components/visualizations/SHAPVisualization';
import LIMEVisualization from '../components/visualizations/LIMEVisualization';
import FairnessVisualization from '../components/visualizations/FairnessVisualization';
import PrivacyVisualization from '../components/visualizations/PrivacyVisualization';
import TraceabilityMatrix from '../components/TraceabilityMatrix';
import RemediationPanel from '../components/RemediationPanel';
import { exportReportToPDF } from '../services/pdf-export';

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
    return (
        <Box hidden={value !== index} sx={{ pt: 2 }}>
            {value === index && children}
        </Box>
    );
}

export default function ReportViewerPage() {
    const navigate = useNavigate();
    const { suiteId } = useParams<{ suiteId: string }>();
    const [tab, setTab] = useState(0);
    const [showCertificate, setShowCertificate] = useState(false);
    const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

    const handleExportClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setExportMenuAnchor(event.currentTarget);
    };
    const handleExportClose = () => {
        setExportMenuAnchor(null);
    };

    const { data, isLoading, error } = useQuery({
        queryKey: ['validationReport', suiteId],
        queryFn: () => reportsApi.getValidationReport(suiteId!),
        enabled: !!suiteId,
    });

    // Fetch traceability matrix for this report's project
    const projectId = data?.project_id;
    const { data: traceabilityData } = useQuery({
        queryKey: ['traceability-matrix', projectId],
        queryFn: () => traceabilityApi.getMatrix(projectId),
        enabled: !!projectId,
    });

    const fairnessMetrics = useMemo(() => {
        const rows = data?.validations?.fairness?.results || [];
        return rows.map((r: any) => ({
            name: r.metric_name,
            value: Number(r.metric_value ?? 0),
            threshold: Number(r.threshold ?? 0),
            by_group: r.details?.by_group || undefined,
        }));
    }, [data]);

    const confusionMatrices = useMemo(() => {
        const rows = data?.validations?.fairness?.results || [];
        const matrixRow = rows.find((r: any) => r.metric_name === 'group_confusion_matrices');
        const value = matrixRow?.details?.by_group || matrixRow?.details || {};
        if (!value || typeof value !== 'object') return [];
        return Object.entries(value).map(([group, m]: any) => ({
            group,
            tp: Number(m.tp ?? 0),
            fp: Number(m.fp ?? 0),
            tn: Number(m.tn ?? 0),
            fn: Number(m.fn ?? 0),
        }));
    }, [data]);

    const shapGlobal = useMemo(() => {
        const map = data?.validations?.transparency?.feature_importance || {};
        return Object.entries(map).map(([feature, importance]) => ({ feature, importance: Number(importance) }));
    }, [data]);

    const localExplanations = useMemo(() => {
        const samples = data?.validations?.transparency?.sample_predictions || [];
        return samples.map((s: any) => ({
            sample_index: Number(s.sample_index ?? 0),
            prediction: Number(s.predicted_label ?? 0),
            contributions: Object.entries(s.top_features || {}).map(([feature, info]: any) => ({
                feature,
                value: Number(info?.value ?? 0),
                shap: Number(info?.shap_contribution ?? 0),
            })),
        }));
    }, [data]);

    const transparencyWarning = data?.validations?.transparency?.warning;

    const firstLime = localExplanations[0];

    const privacyReport = data?.validations?.privacy?.report || {};
    const piiDetected: string[] = privacyReport?.pii_detected || [];
    const kDist = privacyReport?.k_anonymity?.distribution
        ? Object.entries(privacyReport.k_anonymity.distribution).map(([size, count]) => ({ size: Number(size), count: Number(count) }))
        : [];
    // Read privacy_risk_score from API response (computed dynamically by backend)
    const riskScore = privacyReport?.privacy_risk_score ?? 0;

    const handleDownloadBackendPdf = async () => {
        const blob = await reportsApi.downloadValidationPdf(suiteId!);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `validation_report_${suiteId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadFrontendPdf = async () => {
        await exportReportToPDF('report-view-root', `validation_report_${suiteId}_frontend.pdf`);
    };

    const handleExportJson = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `validation_report_${suiteId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadHtml = async () => {
        try {
            const blob = await reportsApi.downloadValidationHtml(suiteId!);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `validation_report_${suiteId}.html`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { /* silent */ }
    };

    if (isLoading) {
        return (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !data) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error">Failed to load report data.</Alert>
            </Box>
        );
    }

    return (
        <Box id="report-view-root" sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
                <Box>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1 }}>Back</Button>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>Validation Report</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {data.project_name} • {data.model_name} • {data.dataset_name}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Chip icon={<AssessmentIcon />} label={String(data.overall_status || '').toUpperCase()} color={data.overall_passed ? 'success' : 'error'} sx={{ mr: 2 }} />
                    <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportClick}>
                        Export Report
                    </Button>
                    <Menu
                        anchorEl={exportMenuAnchor}
                        open={Boolean(exportMenuAnchor)}
                        onClose={handleExportClose}
                        PaperProps={{
                            sx: { mt: 1, border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'background.paper', minWidth: 200 }
                        }}
                    >
                        <MenuItem onClick={() => { handleDownloadFrontendPdf(); handleExportClose(); }}>
                            <ListItemIcon><PictureAsPdfIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Download PDF (Full)</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { handleDownloadBackendPdf(); handleExportClose(); }}>
                            <ListItemIcon><PictureAsPdfIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Download PDF (Summary)</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { setShowCertificate(true); handleExportClose(); }}>
                            <ListItemIcon><WorkspacePremiumIcon fontSize="small" sx={{ color: '#f59e0b' }} /></ListItemIcon>
                            <ListItemText>View Certificate</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { handleExportJson(); handleExportClose(); }}>
                            <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Export JSON Data</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => { handleDownloadHtml(); handleExportClose(); }}>
                            <ListItemIcon><WebIcon fontSize="small" /></ListItemIcon>
                            <ListItemText>Export HTML</ListItemText>
                        </MenuItem>
                    </Menu>
                </Box>
            </Box>

            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 1 }}>Executive Summary</Typography>
                    <Typography variant="body2" color="text.secondary">{data.executive_summary}</Typography>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Recommendations</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {(data.recommendations || []).map((r: string, idx: number) => (
                                <li key={idx}><Typography variant="body2">{r}</Typography></li>
                            ))}
                        </ul>
                    </Box>
                </CardContent>
            </Card>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                <Tab label="Fairness" />
                <Tab label="Transparency" />
                <Tab label="Privacy" />
                <Tab label="Traceability" />
                <Tab label="Remediation" />
            </Tabs>

            <TabPanel value={tab} index={0}>
                <FairnessVisualization metrics={fairnessMetrics} confusion_matrices={confusionMatrices} />
            </TabPanel>

            <TabPanel value={tab} index={1}>
                <Box sx={{ display: 'grid', gap: 2 }}>
                    {transparencyWarning && (
                        <Alert severity="warning">
                            {transparencyWarning}. Upload a properly trained model with varying predictions and matching feature schema.
                        </Alert>
                    )}
                    <SHAPVisualization globalImportance={shapGlobal} localExplanations={localExplanations} />
                    {firstLime && (
                        <LIMEVisualization
                            prediction={firstLime.prediction}
                            contributions={firstLime.contributions.map((c: { feature: string; shap: number }) => ({ feature: c.feature, weight: c.shap }))}
                        />
                    )}
                </Box>
            </TabPanel>

            <TabPanel value={tab} index={2}>
                <PrivacyVisualization piiDetected={piiDetected} kAnonymityGroups={kDist} riskScore={riskScore} />
            </TabPanel>

            <TabPanel value={tab} index={3}>
                <TraceabilityMatrix
                    traces={traceabilityData?.traces ?? []}
                    summary={traceabilityData?.summary ?? {
                        total_requirements: 0,
                        total_validations: 0,
                        pass_count: 0,
                        fail_count: 0,
                        not_validated_count: 0,
                        pass_rate: 0,
                    }}
                />
            </TabPanel>

            <TabPanel value={tab} index={4}>
                {suiteId && <RemediationPanel suiteId={suiteId} />}
            </TabPanel>

            {/* Certificate Modal */}
            {showCertificate && (
                <CertificateModal
                    open={showCertificate}
                    onClose={() => setShowCertificate(false)}
                    recipientName="Valued User"
                    projectName={data.project_name}
                    suiteId={suiteId!}
                    validationsPassed={Object.keys(data?.validations || {})}
                    overallPassed={data.overall_passed ?? false}
                />
            )}
        </Box>
    );
}
