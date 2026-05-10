/**
 * KnowledgeBasePage – in-app reference for all ethical AI concepts.
 * Simplified for easy understanding with analogies and examples for every rule.
 */

import { useMemo, useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Divider,
    Alert,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    ExpandMore as ExpandIcon,
    Balance as FairnessIcon,
    Security as PrivacyIcon,
    Visibility as TransparencyIcon,
    Gavel as AccountabilityIcon,
    AccountTree as TraceIcon,
    MenuBook as BookIcon,
    Search as SearchIcon,
} from '@mui/icons-material';

/* ---------- Styled section ---------- */

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

function H3({ children, id }: { children: React.ReactNode; id?: string }) {
    return <Typography id={id} variant="subtitle1" fontWeight={700} sx={{ mt: 2.3, mb: 1, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>{children}</Typography>;
}

function RuleBox({ title, idea, analogy, example }: { title: string; idea: string; analogy: string; example: string }) {
    return (
        <Box sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', letterSpacing: 1, color: 'secondary.main' }}>
                {title}
            </Typography>
            <P><strong>The Idea:</strong> {idea}</P>
            <Alert severity="info" variant="outlined" sx={{ mb: 1.5, bgcolor: 'rgba(2, 136, 209, 0.05)' }}>
                <strong>Analogy:</strong> {analogy}
            </Alert>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5, color: 'text.secondary' }}>REAL-WORLD EXAMPLE</Typography>
                <Typography variant="body2">{example}</Typography>
            </Box>
        </Box>
    );
}

/* ---------- Page ---------- */

export default function KnowledgeBasePage() {
    const [search, setSearch] = useState('');

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <BookIcon color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="h4" fontWeight={700}>Knowledge Base</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                A complete, plain-English guide to every ethical rule and metric used in our AI audits.
            </Typography>

            {/* ── 1. FAIRNESS ────────────────────────────────── */}
            <Section icon={<FairnessIcon />} color="#4caf50" title="Fairness (The Justice Rules)" sectionId="fairness" defaultExpanded={true}>
                <P>Fairness ensures that AI doesn't pick favorites based on things people can't change, like their background.</P>

                <RuleBox 
                    title="Demographic Parity (The Group Balance Rule)"
                    idea="Every group should get the 'Yes' or 'Approved' result at the same rate, regardless of who they are."
                    analogy="Imagine a school giving out 100 scholarships. If 50% of students are boys and 50% are girls, the scholarships should be split 50/50."
                    example="If a bank approves 20% of male loan applicants, it should also approve roughly 20% of female applicants."
                />

                <RuleBox 
                    title="Equal Opportunity (The Qualified Success Rule)"
                    idea="If two people are both qualified and 'deserve' a positive result, the AI should be equally likely to pick both of them."
                    analogy="In a race, if a boy and a girl are both equally fast runners, they should have the exact same chance of being selected for the team."
                    example="Among people who actually repaid their loans in the past, the model should correctly predict 'Success' for men and women at the same rate."
                />

                <RuleBox 
                    title="Equalized Odds (The Accuracy Match Rule)"
                    idea="The AI should make the same amount of mistakes (and the same amount of correct guesses) for every group."
                    analogy="If a teacher is grading exams, they shouldn't accidentally give more 'extra points' to one group or 'stricter penalties' to another."
                    example="The model shouldn't have a 5% error rate for Group A but a 15% error rate for Group B. Errors should be spread evenly."
                />

                <RuleBox 
                    title="Disparate Impact (The 80% Fairness Rule)"
                    idea="A legal standard that says if one group is getting less than 80% of the success of another group, the AI is likely biased."
                    analogy="If you are handing out snacks and Group A gets 10 cookies, Group B must get at least 8 cookies to be considered 'fair enough' by law."
                    example="If 100% of Group A gets promoted, but only 70% of Group B gets promoted, the model fails this rule (since 70% is less than 80%)."
                />

                <RuleBox 
                    title="Custom Fairness Rules (Your Golden Rules)"
                    idea="Special rules you create for your specific project that are even stricter than the standard laws."
                    analogy="A building might have a legal safety limit of 100 people, but the owner sets a 'Custom Rule' of 80 people just to be extra safe."
                    example="You might decide that for a specific medical AI, the success rate for elderly patients MUST be 95% of the rate for young patients, override any other rule."
                />
            </Section>

            {/* ── 2. PRIVACY ─────────────────────────────────── */}
            <Section icon={<PrivacyIcon />} color="#ff9800" title="Privacy (The Secret-Keeping Rules)" sectionId="privacy" defaultExpanded={false}>
                <P>Privacy rules make sure the AI doesn't remember specific people or leak their private information.</P>

                <RuleBox 
                    title="PII Detection (The Personal Info Scanner)"
                    idea="Automatically finding and flagging 'secrets' like names, phone numbers, or ID numbers that shouldn't be there."
                    analogy="Like a 'Find and Replace' tool that looks for anything that looks like a secret and puts a warning label on it."
                    example="The scanner finds a column called 'SSN' or 'Customer_Name' and alerts you that this data is too dangerous to use for AI training."
                />

                <RuleBox 
                    title="k-Anonymity (The Crowd Hiding Rule)"
                    idea="Ensuring that every person in the data looks exactly like at least 'k' other people so they can't be singled out."
                    analogy="If you wear a red hat in a crowd of 100 people also wearing red hats, no one can find you. If you are the only one in a red hat (k=1), you are easy to pick out."
                    example="In a medical dataset, we make sure that for any combination of 'Age, Gender, and Zip Code', there are at least 5 similar people in the list."
                />

                <RuleBox 
                    title="l-Diversity (The Variety Rule)"
                    idea="A step beyond hiding in a crowd: making sure the 'crowd' doesn't all have the exact same secret."
                    analogy="If you hide in a room of 10 people (k=10) but EVERYONE in that room has the same flu, then anyone who knows you are in that room knows you have the flu."
                    example="Even if we have 10 people with the same Zip Code, we make sure they don't all have the same 'Medical Diagnosis' column value."
                />

                <RuleBox 
                    title="Differential Privacy (The Static Noise Rule)"
                    idea="Adding a bit of 'fuzz' or random static to the data so you can see the overall trend without seeing individual secrets."
                    analogy="Think of a blurred photo. You can see it's a forest (the trend), but you can't see the individual leaves or insects (the people)."
                    example="Instead of saying 'Exactly 5 people have this disease', the AI says 'Somewhere between 4 and 6 people', which protects the 5 individuals."
                />

                <RuleBox 
                    title="HIPAA Safe Harbor (The Health Privacy Checklist)"
                    idea="A specific list of 18 items (like names, dates, and photos) that MUST be removed from medical data to keep it legal."
                    analogy="Like a 'No-Entry' list for a club. If you have any of these 18 items on you, you aren't allowed into the database."
                    example="The system checks if your dataset still has 'Email Addresses' or 'IP Addresses' and fails the test if it finds even one."
                />
            </Section>

            {/* ── 3. TRANSPARENCY ────────────────────────────── */}
            <Section icon={<TransparencyIcon />} color="#2196f3" title="Transparency (The Honesty Rules)" sectionId="transparency" defaultExpanded={false}>
                <P>Transparency rules open the 'Black Box' of AI so we can understand exactly why it makes a decision.</P>

                <RuleBox 
                    title="SHAP (The Score Card Rule)"
                    idea="A way to give 'points' to every piece of information to see how much it helped or hurt the final result."
                    analogy="If a team wins a game 3-0, SHAP is the report that says: 'Striker A caused 2 goals, Midfielder B caused 1 goal, and the Defender caused 0.'"
                    example="The AI says: 'I rejected this loan because: Low Income (-50 points), High Debt (-30 points), but Good Age (+10 points).'"
                />

                <RuleBox 
                    title="LIME (The Local Spotlight Rule)"
                    idea="Focusing on just one specific person's result to see what mattered most for THEM in that moment."
                    analogy="If a bank rejects 1,000 people, LIME is the specialist who looks ONLY at your file to tell you exactly why you specifically were rejected."
                    example="A doctor uses LIME to see why the AI flagged a specific patient as 'High Risk'. It shows that 'Recent Blood Pressure' was the #1 reason."
                />

                <RuleBox 
                    title="Model Cards (The Nutrition Label)"
                    idea="A standard one-page summary that explains what the AI is, how it was made, and what it's bad at."
                    analogy="Like the label on a box of cereal that tells you the ingredients, the calories, and if it contains nuts (limitations)."
                    example="The Model Card warns: 'This AI was trained mostly on data from young people and might be less accurate for people over 70.'"
                />

                <RuleBox 
                    title="Global Feature Importance (The Big Picture)"
                    idea="Ranking all pieces of information to see what the AI cares about the most overall."
                    analogy="In a kitchen, the 'Global Importance' list would show that Heat and Ingredients are the #1 things for cooking, while the color of the plate is #100."
                    example="The system shows a chart proving that 'Credit History' is the most important thing the AI looks at for all customers."
                />
            </Section>

            {/* ── 4. ACCOUNTABILITY & TRACEABILITY ─────────── */}
            <Section icon={<AccountabilityIcon />} color="#9c27b0" title="Accountability (The Paper Trail)" sectionId="accountability" defaultExpanded={false}>
                <RuleBox 
                    title="Audit Trail (The History Book)"
                    idea="Saving every single test and change so we can prove the AI was checked and who did the checking."
                    analogy="Like a black box on an airplane. It records everything so if something goes wrong, we can go back and see exactly why."
                    example="A year later, a regulator asks: 'Who checked this AI on May 10th?' The system shows the user ID and the exact 100% pass result."
                />
                
                <RuleBox 
                    title="Requirement Traceability (The Map)"
                    idea="Linking a legal rule (like 'GDPR Privacy') directly to the test that proved we followed it."
                    analogy="Like a receipt. It proves that for the 'Fairness' you paid for (required), you actually received the 'Validation' (the result)."
                    example="Clicking on a 'Privacy Failed' result immediately shows you which specific law or requirement is being broken."
                />
            </Section>

            <Divider sx={{ my: 4 }} />
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                End of Knowledge Base – Always consult with a legal or ethics expert for critical compliance decisions.
            </Typography>
        </Container>
    );
}
