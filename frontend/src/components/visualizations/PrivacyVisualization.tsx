import { Box, Card, CardContent, Typography, Chip, Table, TableHead, TableRow, TableCell, TableBody, Paper } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadialBarChart, RadialBar } from 'recharts';

interface PrivacyVisualizationProps {
    piiDetected: string[];
    kAnonymityGroups?: Array<{ size: number; count: number }>;
    riskScore: number;
}

export default function PrivacyVisualization({ piiDetected, kAnonymityGroups = [], riskScore }: PrivacyVisualizationProps) {
    const gaugeData = [{ name: 'Risk', value: Math.max(0, Math.min(100, riskScore)) }];
    const riskLevel = riskScore >= 70 ? 'High' : riskScore >= 30 ? 'Medium' : 'Low';
    const riskColor = riskScore >= 70 ? 'error' : riskScore >= 30 ? 'warning' : 'success';
    const colorHex = riskScore >= 70 ? '#ef4444' : riskScore >= 30 ? '#f59e0b' : '#22c55e';

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
                    <Typography variant="h6" sx={{ mb: 2 }}>k-Anonymity Group Distribution</Typography>
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
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="size" label={{ value: 'Group Size (k)', position: 'bottom', offset: 0 }} />
                                    <YAxis label={{ value: 'Number of Groups', angle: -90, position: 'insideLeft', offset: -5 }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
                                    <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" fill={colorHex} cornerRadius={10} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="h2" sx={{ fontWeight: 800, color: colorHex, lineHeight: 1 }}>
                                {riskScore.toFixed(0)}<span style={{ fontSize: '1.5rem', color: '#94a3b8' }}>/100</span>
                            </Typography>
                            <Chip color={riskColor as any} label={`${riskLevel} Risk`} sx={{ fontWeight: 700, width: 'fit-content' }} />
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
