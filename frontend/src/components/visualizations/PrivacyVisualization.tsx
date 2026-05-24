import { Box, Card, CardContent, Typography, Chip, Table, TableHead, TableRow, TableCell, TableBody, Paper, Grid, Alert, useTheme } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar, Cell } from 'recharts';

interface PrivacyVisualizationProps {
    piiDetected: string[];
    kAnonymityGroups?: Array<{ size: number; count: number }>;
    riskScore: number;
}

export default function PrivacyVisualization({ piiDetected, kAnonymityGroups = [], riskScore }: PrivacyVisualizationProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const gaugeData = [{ name: 'Risk', value: Math.max(0, Math.min(100, riskScore)) }];
    const riskLevel = riskScore >= 70 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low';
    const riskColor: 'error' | 'warning' | 'success' = riskScore >= 70 ? 'error' : riskScore >= 30 ? 'warning' : 'success';
    const colorHex = riskScore >= 70 ? theme.palette.error.main : riskScore >= 30 ? theme.palette.warning.main : theme.palette.success.main;

    // Calculate k-anonymity metrics
    let totalGroups = 0;
    let totalRecords = 0;
    let highRiskRecordsCount = 0;
    let minK = Infinity;

    kAnonymityGroups.forEach(g => {
        totalGroups += g.count;
        totalRecords += g.size * g.count;
        if (g.size < 5) {
            highRiskRecordsCount += g.size * g.count;
        }
        if (g.size < minK) {
            minK = g.size;
        }
    });

    if (minK === Infinity) minK = 0;
    const highRiskPercent = totalRecords > 0 ? (highRiskRecordsCount / totalRecords) * 100 : 0;

    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>PII Detection</Typography>
                    {piiDetected.length === 0 ? (
                        <Chip label="No PII columns detected" color="success" />
                    ) : (
                        <Paper variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Column Name</TableCell>
                                        <TableCell>PII Type</TableCell>
                                        <TableCell>Risk</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {piiDetected.map((col) => (
                                        <TableRow key={col}>
                                            <TableCell>{col}</TableCell>
                                            <TableCell>Sensitive Identifier</TableCell>
                                            <TableCell><Chip size="small" color="error" label="High" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Paper>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 1 }}>k-Anonymity Group Distribution</Typography>

                    {kAnonymityGroups.length > 0 && (
                        <>
                            <Alert severity="info" sx={{ mb: 3 }}>
                                <strong>What is k-Anonymity?</strong> It evaluates dataset privacy by measuring the sizes of groups sharing identical quasi-identifiers (like age, zip code, and gender).
                                To prevent re-identification, each group should contain at least <strong>k</strong> individuals (recommended k ≥ 5).
                                Red bars show tiny, high-risk groups size &lt; 5. Orange shows size 5 to 9. Purple shows safe larger groups (10+).
                            </Alert>

                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: minK < 5 ? 'error.main' : 'success.main', borderWidth: 1.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            DATASET K-ANONYMITY
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: minK < 5 ? 'error.main' : 'success.main' }}>
                                            k = {minK}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                            {minK < 5
                                                ? '🚨 Critical: some individuals are in tiny groups of size < 5'
                                                : '✅ Safe: every individual shares attributes with at least ' + (minK - 1) + ' others'
                                            }
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            {"HIGH-RISK RECORDS (k < 5)"}
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: highRiskPercent > 0 ? 'warning.main' : 'success.main' }}>
                                            {highRiskPercent.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                            {highRiskRecordsCount.toLocaleString()} out of {totalRecords.toLocaleString()} rows are highly vulnerable to identity disclosure.
                                        </Typography>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                            TOTAL QUASI-IDENTIFIER GROUPS
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                            {totalGroups.toLocaleString()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                            Average group size is {totalGroups > 0 ? (totalRecords / totalGroups).toFixed(1) : 0} rows.
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </>
                    )}

                    {kAnonymityGroups.length === 0 ? (
                        <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No k-anonymity data available. Run a privacy validation with k-anonymity enabled.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ height: 320, pr: 2 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={kAnonymityGroups} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                                    <XAxis
                                        dataKey="size"
                                        tick={{ fill: theme.palette.text.secondary }}
                                        label={{ value: 'Group Size (k)', position: 'bottom', offset: -10, fill: theme.palette.text.primary, fontWeight: 500 }}
                                    />
                                    <YAxis
                                        tick={{ fill: theme.palette.text.secondary }}
                                        label={{ value: 'Number of Groups', angle: -90, position: 'insideLeft', offset: -5, fill: theme.palette.text.primary, fontWeight: 500 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: theme.palette.background.paper,
                                            border: '1px solid ' + theme.palette.divider,
                                            borderRadius: '8px',
                                            color: theme.palette.text.primary,
                                            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.08)'
                                        }}
                                        itemStyle={{ color: theme.palette.text.secondary }}
                                        formatter={(value) => [value, 'Groups']}
                                        labelFormatter={(label) => `Group Size (k) = ${label}`}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {kAnonymityGroups.map((entry, idx) => {
                                            const color = entry.size < 5
                                                ? theme.palette.error.main
                                                : entry.size < 10
                                                    ? theme.palette.warning.main
                                                    : '#8b5cf6';
                                            return <Cell key={`cell-${idx}`} fill={color} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Privacy Risk Score</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, height: 200 }}>
                        <Box sx={{ width: 220, height: 220, mt: -2 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
                                    <RadialBar background={{ fill: theme.palette.action.hover }} dataKey="value" fill={colorHex} cornerRadius={10} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="h2" sx={{ fontWeight: 800, color: colorHex, lineHeight: 1 }}>
                                {riskScore.toFixed(0)}<span style={{ fontSize: '1.5rem', color: theme.palette.text.disabled }}>/100</span>
                            </Typography>
                            <Chip color={riskColor} label={`${riskLevel} Risk`} sx={{ fontWeight: 700, width: 'fit-content' }} />
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
