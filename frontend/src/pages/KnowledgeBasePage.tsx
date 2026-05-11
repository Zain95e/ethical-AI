/**
 * KnowledgeBasePage – in-app reference for all ethical AI concepts.
 * Simplified for easy understanding with analogies and examples for every rule.
 */

import React from 'react';
import {
    Box,
    Container,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
} from '@mui/material';
import {
    ExpandMore as ExpandIcon,
    Balance as FairnessIcon,
    Security as PrivacyIcon,
    Visibility as TransparencyIcon,
    Gavel as AccountabilityIcon,
    MenuBook as BookIcon,
    TipsAndUpdates as TipIcon,
} from '@mui/icons-material';

/* ---------- Styled helpers ---------- */

interface SectionProps {
    icon: React.ReactNode;
    color: string;
    title: string;
    children: React.ReactNode;
    sectionId: string;
    defaultExpanded?: boolean;
}

function Section({ icon, color, title, children, sectionId, defaultExpanded }: SectionProps) {
    return (
        <Accordion id={sectionId} defaultExpanded={defaultExpanded} sx={{ '&:before': { display: 'none' }, mb: 1.5 }}>
            <AccordionSummary expandIcon={<ExpandIcon />} sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 } }}>
                <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
                <Typography variant="h6" fontWeight={700}>{title}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
        </Accordion>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.7 }}>{children}</Typography>;
}

function RuleBox({ title, idea, analogy, example, extra }: { title: string; idea: string; analogy: string; example: string; extra?: React.ReactNode }) {
    return (
        <Box sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', letterSpacing: 1, color: 'secondary.main' }}>
                {title}
            </Typography>
            <P><strong>The Idea:</strong> {idea}</P>
            <Alert severity="info" variant="outlined" sx={{ mb: 1.5, bgcolor: 'rgba(2, 136, 209, 0.05)' }}>
                <strong>Analogy:</strong> {analogy}
            </Alert>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1, mb: extra ? 2 : 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>REAL-WORLD EXAMPLE</Typography>
                <Typography variant="body2">{example}</Typography>
            </Box>
            {extra}
        </Box>
    );
}

function InfoChip({ label, color = 'info' }: { label: string; color?: 'info' | 'success' | 'warning' | 'error' }) {
    return <Chip label={label} color={color} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />;
}

/* ---------- Page ---------- */

export default function KnowledgeBasePage() {
    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <BookIcon color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="h4" fontWeight={700}>Knowledge Base</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                A complete, plain-English guide to every ethical rule, metric, and privacy check used in our AI audits.
            </Typography>

            {/* ── 1. FAIRNESS ────────────────────────────────── */}
            <Section icon={<FairnessIcon />} color="#4caf50" title="Fairness — Metrics & How They Work" sectionId="fairness" defaultExpanded={true}>
                <P>Fairness ensures that AI doesn't pick favorites based on things people can't change, like their background. Our platform checks six built-in metrics plus any custom rules you create.</P>

                {/* How to read scores */}
                <Alert severity="warning" variant="outlined" sx={{ mb: 3, bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
                    <strong>How to Read the Results Screen</strong><br />
                    Each metric shows: <strong>Your Score / Threshold</strong>. There are two types:<br /><br />
                    • <strong>Ratio metrics</strong> — perfect score is <strong>1.0</strong>. The threshold is a <em>minimum floor</em>. Your score must be <strong>≥ threshold</strong> to pass. Example: 0.725 / 0.4 → Pass ✓ (0.725 is above 0.4).<br />
                    • <strong>Difference metrics</strong> — perfect score is <strong>0.0</strong>. The threshold is a <em>maximum ceiling</em>. Your score must be <strong>≤ threshold</strong> to pass. Example: 0.056 / 0.05 → Fail ✗ (0.056 is above 0.05).
                </Alert>

                {/* Metric table */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Default Thresholds</Typography>
                <TableContainer component={Paper} sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Perfect Score</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Default Threshold</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Pass Condition</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[
                                ['Demographic Parity Ratio', 'Ratio', '1.0', '0.8 (80% rule)', 'Score ≥ 0.8'],
                                ['Equalized Odds Ratio', 'Ratio', '1.0', '0.8', 'Score ≥ 0.8'],
                                ['Disparate Impact Ratio', 'Ratio', '1.0', '0.8 (legal std)', 'Score ≥ 0.8'],
                                ['Demographic Parity Difference', 'Difference', '0.0', '0.1', 'Score ≤ 0.1'],
                                ['Equalized Odds Difference', 'Difference', '0.0', '0.1', 'Score ≤ 0.1'],
                                ['Equal Opportunity Difference', 'Difference', '0.0', '0.05', 'Score ≤ 0.05'],
                            ].map(([name, type, perfect, threshold, pass_]) => (
                                <TableRow key={name}>
                                    <TableCell>{name}</TableCell>
                                    <TableCell><InfoChip label={type} color={type === 'Ratio' ? 'success' : 'warning'} /></TableCell>
                                    <TableCell>{perfect}</TableCell>
                                    <TableCell>{threshold}</TableCell>
                                    <TableCell>{pass_}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <RuleBox
                    title="Demographic Parity (The Group Balance Rule)"
                    idea="Every group should get the 'Yes' or 'Approved' result at roughly the same rate, regardless of who they are."
                    analogy="Imagine a school giving out 100 scholarships. If 50% of students are boys and 50% are girls, the scholarships should be split roughly 50/50."
                    example="If a bank approves 20% of male loan applicants, it should also approve roughly 20% of female applicants. We measure both a Ratio (min rate ÷ max rate, should be ≥ 0.8) and a Difference (max rate − min rate, should be ≤ 0.1)."
                />

                <RuleBox
                    title="Equal Opportunity (The Qualified Success Rule)"
                    idea="Among people who actually deserve a positive result, the AI should be equally likely to find them regardless of group. This only looks at the True Positive Rate (TPR)."
                    analogy="In a race, if a boy and a girl are both equally fast runners, they should have the exact same chance of being selected for the team."
                    example="Among people who actually repaid loans, the model should correctly predict 'Will Repay' for men and women at the same rate. Default threshold is strict at 0.05 — so a 0.056 difference means Fail because it exceeds the 5% maximum gap."
                />

                <RuleBox
                    title="Equalized Odds (The Accuracy Match Rule)"
                    idea="The AI should make the same amount of mistakes (and the same amount of correct guesses) for every group. This checks BOTH the True Positive Rate AND the False Positive Rate."
                    analogy="If a teacher is grading exams, they shouldn't accidentally give more 'extra points' to one group or 'stricter penalties' to another."
                    example="The model shouldn't have a 5% error rate for Group A but a 15% error rate for Group B. Errors and correct predictions should be spread evenly across all groups."
                />

                <RuleBox
                    title="Disparate Impact (The 80% Legal Rule)"
                    idea="A legal standard from US employment law that says if one group is getting less than 80% of the success rate of another group, the AI is likely biased."
                    analogy="If you are handing out snacks and Group A gets 10 cookies, Group B must get at least 8 cookies (80%) to be considered 'fair enough' by law."
                    example="If 50% of Group A gets hired but only 35% of Group B gets hired, the ratio is 35/50 = 0.70, which is below 0.80 and fails the legal standard."
                />

                {/* Custom Rules Section */}
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TipIcon color="warning" /> Custom Fairness Rules
                </Typography>
                <P>
                    Custom rules let you create your own fairness checks beyond the six built-in metrics. You define what to measure, how to combine group scores, and what threshold to enforce.
                </P>

                <Alert severity="success" variant="outlined" sx={{ mb: 2, bgcolor: 'rgba(76, 175, 80, 0.05)' }}>
                    <strong>When to use custom rules:</strong> When your project has domain-specific fairness requirements that the standard metrics don't cover. For example, ensuring minimum precision parity for a medical diagnosis AI.
                </Alert>

                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Every Custom Rule Has 4 Parts:</Typography>
                <TableContainer component={Paper} sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Field</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>What It Means</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Options</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell><strong>Base Metric</strong></TableCell>
                                <TableCell>The raw number to measure for each group</TableCell>
                                <TableCell>
                                    <InfoChip label="accuracy_score" /> <InfoChip label="precision_score" />
                                    <InfoChip label="recall_score" /> <InfoChip label="f1_score" />
                                    <InfoChip label="selection_rate" /> <InfoChip label="true_positive_rate" />
                                    <InfoChip label="false_positive_rate" /> <InfoChip label="true_negative_rate" />
                                    <InfoChip label="false_negative_rate" />
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><strong>Aggregation</strong></TableCell>
                                <TableCell>How to compare groups</TableCell>
                                <TableCell>
                                    <InfoChip label="min_ratio → min ÷ max" color="success" />
                                    <InfoChip label="max_difference → max − min" color="warning" />
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><strong>Comparison</strong></TableCell>
                                <TableCell>Pass condition</TableCell>
                                <TableCell><InfoChip label="≥ (for ratios)" color="success" /> <InfoChip label="≤ (for differences)" color="warning" /></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell><strong>Threshold</strong></TableCell>
                                <TableCell>The limit for pass/fail</TableCell>
                                <TableCell>Any number (e.g., 0.8, 0.1, 0.95)</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>

                <RuleBox
                    title="Example: Minimum Precision Ratio"
                    idea="Ensure precision (how many 'Yes' predictions are actually correct) is balanced across groups."
                    analogy="If a doctor's AI diagnoses diseases, it should be equally precise for all patient groups — not highly accurate for one group but sloppy for another."
                    example={'Rule: name="min_precision_ratio", base_metric="precision_score", aggregation="min_ratio", comparison=">=", threshold=0.85. This means: take precision for each group, divide the lowest by the highest, and the result must be ≥ 85%.'}
                />
            </Section>

            {/* ── 2. PRIVACY ─────────────────────────────────── */}
            <Section icon={<PrivacyIcon />} color="#ff9800" title="Privacy — All Checks Explained" sectionId="privacy" defaultExpanded={false}>
                <P>Privacy rules make sure the AI doesn't remember specific people or leak their private information. Our platform runs five privacy checks.</P>

                <Alert severity="info" variant="outlined" sx={{ mb: 3, bgcolor: 'rgba(2, 136, 209, 0.05)' }}>
                    <strong>What are "Quasi-Identifiers"?</strong><br />
                    Quasi-identifiers are pieces of information that aren't inherently sensitive on their own (like Zip Code, Age, or Gender), but when combined together, can be used to uniquely identify someone. For example, knowing someone is "Female" isn't enough to identify them. Knowing they are "Female, aged 32, in zip code 90210" might narrow it down to a single person.<br /><br />
                    <strong>Why do I select them in two different places?</strong><br />
                    1. <strong>Global Quasi-Identifiers:</strong> This is your master list of all columns in your dataset that could be combined to identify someone.<br />
                    2. <strong>k-Anonymity Config Quasi-Identifiers:</strong> You can create multiple k-anonymity rules (configs). For each rule, you select a specific *subset* of your global quasi-identifiers to test. For example, Config 1 might test "Age + Zip Code" with k=5, while Config 2 tests "Age + Gender + Occupation" with k=3.
                </Alert>

                <RuleBox
                    title="PII Detection (The Personal Info Scanner)"
                    idea="Automatically scans every column in your dataset for personal information that could identify someone — names, emails, phone numbers, social security numbers, credit cards, IP addresses, and more."
                    analogy="Like a metal detector at an airport. It scans everything and beeps when it finds something dangerous (personal data)."
                    example="The scanner finds a column called 'SSN' with values like '123-45-6789' and flags it as dangerous. It uses three methods: (1) Column name matching — does the column name look like 'email' or 'phone'? (2) Pattern matching — do the values look like phone numbers or emails? (3) Uniqueness analysis — if 90%+ of values are unique, it might be an identifier."
                    extra={
                        <Alert severity="error" variant="outlined" sx={{ mt: 1.5, bgcolor: 'rgba(244, 67, 54, 0.05)' }}>
                            <strong>Pass condition:</strong> Zero PII columns detected. Even one flagged column = Fail.
                        </Alert>
                    }
                />

                <RuleBox
                    title="k-Anonymity (The Crowd Hiding Rule)"
                    idea={'Every person in the data must look identical to at least "k" other people based on their quasi-identifiers (like age, zip code, gender). If k=5, then for any combination of those fields, there must be at least 5 matching rows.'}
                    analogy="If you wear a red hat in a crowd of 100 people also wearing red hats, no one can find you. If you're the only one in a red hat (k=1), you're easy to spot."
                    example="In a medical dataset with columns Age, Gender, and Zip Code: if there's only 1 row where Age=29, Gender=Female, Zip=10001, that person can be identified. With k=5, we need at least 5 people with that same combination."
                    extra={
                        <Box sx={{ mt: 1.5 }}>
                            <Alert severity="info" variant="outlined" sx={{ bgcolor: 'rgba(2, 136, 209, 0.05)' }}>
                                <strong>Pass condition:</strong> Every group of quasi-identifiers must have ≥ k rows. Default k=3. Groups with fewer are called "violating groups".
                            </Alert>
                        </Box>
                    }
                />

                <RuleBox
                    title="l-Diversity (The Variety Rule)"
                    idea={'A stronger version of k-Anonymity. Even if k people look identical, if they ALL have the same sensitive value (like the same disease), then knowing someone is in that group reveals their secret. l-Diversity requires at least "l" different sensitive values in each group.'}
                    analogy="If you hide in a room of 10 people (k=10) but EVERYONE in that room has cancer, then anyone who knows you're in that room knows you have cancer. l-Diversity says the room must have people with at least 2 different conditions."
                    example="A group of 10 patients all aged 30-35 in Zip 10001 — if they ALL have 'Diabetes' as their diagnosis, l-diversity fails (l=1). We need at least l=2 different diagnoses in the group to pass."
                    extra={
                        <Alert severity="info" variant="outlined" sx={{ mt: 1.5, bgcolor: 'rgba(2, 136, 209, 0.05)' }}>
                            <strong>Pass condition:</strong> Every equivalence class must contain ≥ l distinct values of the sensitive attribute. Default l=2.
                        </Alert>
                    }
                />

                <RuleBox
                    title="Differential Privacy (The Noise Shield — Epsilon ε)"
                    idea={'Adding carefully calculated random "noise" to data or query results so that the overall patterns remain visible but individual records cannot be reverse-engineered. The privacy budget is measured by epsilon (ε) — smaller ε = stronger privacy.'}
                    analogy="Think of a blurred photo. You can see it's a forest (the trend), but you can't see individual leaves or insects (the people). Epsilon controls how blurry the photo is."
                    example={'Instead of saying "Exactly 5 people have this disease", the noisy answer says "Between 3 and 7 people". A target ε of 1.0 is considered strong privacy. If the measured ε is 21.7, the data has very weak privacy protection and the check fails.'}
                    extra={
                        <TableContainer component={Paper} sx={{ mt: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}>
                            <Table size="small">
                                <TableHead><TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Epsilon (ε)</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Privacy Level</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Meaning</TableCell>
                                </TableRow></TableHead>
                                <TableBody>
                                    <TableRow><TableCell>0.1 – 1.0</TableCell><TableCell><InfoChip label="Strong" color="success" /></TableCell><TableCell>Very hard to identify anyone</TableCell></TableRow>
                                    <TableRow><TableCell>1.0 – 5.0</TableCell><TableCell><InfoChip label="Moderate" color="warning" /></TableCell><TableCell>Some risk; acceptable for many uses</TableCell></TableRow>
                                    <TableRow><TableCell>5.0+</TableCell><TableCell><InfoChip label="Weak" color="error" /></TableCell><TableCell>Easy to reverse-engineer individual records</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    }
                />

                <RuleBox
                    title="HIPAA Safe Harbor (The Health Privacy Checklist)"
                    idea="A specific US law (Health Insurance Portability and Accountability Act) that lists 18 categories of identifiers that MUST be removed from medical/health data before it can be shared or used for research."
                    analogy="Like a 'No-Entry' list for a VIP club. If your dataset has ANY of these 18 items, it's not allowed to be used."
                    example="The system scans your dataset and checks: Does it have names? Dates? Phone numbers? Email addresses? Social Security Numbers? Medical record numbers? IP addresses? Photos? If even one is found, the HIPAA check flags it."
                    extra={
                        <Box sx={{ mt: 1.5 }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>The 18 HIPAA Identifiers:</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                {['Names', 'Dates (except year)', 'Phone numbers', 'Fax numbers', 'Email addresses',
                                  'SSN', 'Medical record #', 'Health plan #', 'Account numbers', 'Certificate/license #',
                                  'Vehicle IDs', 'Device IDs', 'Web URLs', 'IP addresses', 'Biometrics (fingerprints)',
                                  'Full-face photos', 'Any unique ID number', 'Geographic data (below state)'].map(id => (
                                    <InfoChip key={id} label={id} color="error" />
                                ))}
                            </Box>
                            <Alert severity="success" variant="outlined" sx={{ bgcolor: 'rgba(76, 175, 80, 0.05)' }}>
                                <strong>Pass condition:</strong> All 18 checks must pass (no identifiers found). Result shows as "18/18 passed".
                            </Alert>
                        </Box>
                    }
                />

                {/* Privacy Risk Score */}
                <Box sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', letterSpacing: 1, color: 'secondary.main' }}>
                        Privacy Risk Score
                    </Typography>
                    <P>An overall score from 0 to 100 that summarizes your dataset's privacy posture. Lower is better.</P>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <InfoChip label="0–30: Low Risk ✓" color="success" />
                        <InfoChip label="30–60: Medium Risk" color="warning" />
                        <InfoChip label="60–100: High Risk ✗" color="error" />
                    </Box>
                </Box>
            </Section>

            {/* ── 3. TRANSPARENCY ────────────────────────────── */}
            <Section icon={<TransparencyIcon />} color="#2196f3" title="Transparency — Explainability Methods" sectionId="transparency" defaultExpanded={false}>
                <P>Transparency rules open the "Black Box" of AI so we can understand exactly why it makes a decision.</P>

                <RuleBox
                    title="SHAP (The Score Card Rule)"
                    idea="SHAP gives every feature a 'score' showing how much it pushed the prediction up or down. Positive scores push toward 'Yes', negative scores push toward 'No'."
                    analogy="If a team wins a game 3-0, SHAP is the report that says: 'Striker A caused 2 goals (+2), Midfielder B caused 1 goal (+1), and Defender C caused 0.'"
                    example="The AI says: 'I rejected this loan because: Low Income (−50 points), High Debt (−30 points), but Good Credit History (+10 points). Net = rejected.' The numbers always add up to the final prediction."
                />

                <RuleBox
                    title="LIME (The Local Spotlight Rule)"
                    idea="LIME focuses on ONE specific prediction and builds a simple, easy-to-understand model around it to show what mattered most for that particular case."
                    analogy="If a hospital rejects 1,000 insurance claims, LIME is the specialist who looks ONLY at your specific claim to tell you exactly why yours was rejected."
                    example="For Patient #41, LIME shows: age (+0.18), prior criminal count (+0.12), juvenile felony count (+0.09) were the top reasons pushing toward a prediction of 0 (low risk)."
                />

                <RuleBox
                    title="Explanation Fidelity"
                    idea="Measures how faithfully the LIME explanation mirrors the actual model. A score of 1.0 means the explanation perfectly matches the model's behavior. Displayed as a percentage."
                    analogy="If someone translates a speech, fidelity measures how accurate the translation is. 95% fidelity means 95% of the meaning was preserved."
                    example="Fidelity of 92.5% means the LIME surrogate model captures 92.5% of the real model's behavior — a very reliable explanation."
                />

                <RuleBox
                    title="Model Cards (The Nutrition Label)"
                    idea="A standardized one-page summary (like a baseball card) showing the model's name, accuracy, precision, recall, F1-score, what it was trained on, and its known limitations."
                    analogy="Like the nutrition label on food — it tells you the ingredients, calories, allergens (limitations) so you can make an informed choice."
                    example="Model Card shows: Accuracy 82%, Precision 75%, Recall 45%, F1 56%. Trained on 30,000 samples with 10 features. Warning: may underperform for age groups over 70."
                />

                <RuleBox
                    title="Global Feature Importance (The Big Picture)"
                    idea="Ranking ALL features by how much they matter to the model's decisions across the ENTIRE dataset, not just one prediction."
                    analogy="In a kitchen, the 'Global Importance' list shows that Heat and Ingredients are the #1 things for cooking, while the color of the plate is #100."
                    example="The bar chart shows: 'priors_count' (16.8%), 'age' (8.7%), 'juv_fel_count' (1.2%) — these are the most influential features the model relies on for all predictions."
                />
            </Section>

            {/* ── 4. ACCOUNTABILITY & TRACEABILITY ─────────── */}
            <Section icon={<AccountabilityIcon />} color="#9c27b0" title="Accountability — Audit & Traceability" sectionId="accountability" defaultExpanded={false}>
                <P>Accountability ensures every AI decision can be traced back to who tested it, when, and what the results were.</P>

                <RuleBox
                    title="Audit Trail (The History Book)"
                    idea="Every validation run is permanently recorded — who ran it, when, which model and dataset were used, and every single metric result. Nothing can be deleted or altered."
                    analogy="Like a black box on an airplane. It records everything so if something goes wrong, investigators can go back and see exactly what happened."
                    example="A year later, a regulator asks: 'Who checked this AI on May 10th?' The audit log shows the user, the exact timestamp, and every pass/fail result."
                />

                <RuleBox
                    title="MLflow Tracking"
                    idea="Every validation run creates an MLflow experiment run that stores all artifacts — the fairness report, privacy report, SHAP values, LIME explanations, and sample predictions — in a versioned, reproducible format."
                    analogy="Like a lab notebook where scientists record every experiment with its exact conditions and results so anyone can reproduce the work."
                    example="Each validation shows an MLflow Run ID (e.g., '10a1413f...'). You can click it to see every metric, artifact, and parameter from that specific run."
                />

                <RuleBox
                    title="Requirement Traceability (The Map)"
                    idea="Linking a legal rule (like 'GDPR Article 22' or 'HIPAA §164.514') directly to the specific test that proved we followed it."
                    analogy="Like a receipt. It proves that for the 'Privacy' you required, you actually received the 'Validation Result' that satisfied it."
                    example="Clicking on a 'Privacy Failed' result immediately shows you which specific law or organizational requirement is being broken, and what action is needed."
                />
            </Section>

            <Divider sx={{ my: 4 }} />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                End of Knowledge Base – Always consult with a legal or ethics expert for critical compliance decisions.
            </Typography>
        </Container>
    );
}
