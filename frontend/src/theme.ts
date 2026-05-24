import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
    palette: {
        mode,
        primary: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#14b8a6',
            light: '#2dd4bf',
            dark: '#0f766e',
            contrastText: '#ffffff',
        },
        success: {
            main: '#22c55e',
            light: '#4ade80',
            dark: '#15803d',
        },
        error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#b91c1c',
        },
        warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#b45309',
        },
        info: {
            main: '#0ea5e9',
            light: '#38bdf8',
            dark: '#0369a1',
        },
        background: {
            default: mode === 'dark' ? '#0b1220' : '#f8fafc',
            paper: mode === 'dark' ? '#111a2e' : '#ffffff',
        },
        text: {
            primary: mode === 'dark' ? '#f8fafc' : '#0f172a',
            secondary: mode === 'dark' ? '#cbd5e1' : '#475569',
            disabled: '#94a3b8',
        },
        divider: mode === 'dark' ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.15)',
    },
    typography: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        h1: {
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
        },
        h2: {
            fontSize: '2rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
        },
        h3: {
            fontSize: '1.5rem',
            fontWeight: 600,
        },
        h4: {
            fontSize: '1.25rem',
            fontWeight: 600,
        },
        h5: {
            fontSize: '1rem',
            fontWeight: 600,
        },
        h6: {
            fontSize: '0.875rem',
            fontWeight: 600,
        },
        body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
        },
        body2: {
            fontSize: '0.875rem',
            lineHeight: 1.5,
        },
        button: {
            textTransform: 'none',
            fontWeight: 500,
        },
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    padding: '10px 24px',
                    fontWeight: 500,
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                    },
                },
                contained: {
                    background: '#3b82f6',
                    '&:hover': {
                        background: '#2563eb',
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    background: mode === 'dark' ? '#111a2e' : '#ffffff',
                    border: mode === 'dark' ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: 16,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        '& fieldset': {
                            borderColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.3)',
                        },
                        '&:hover fieldset': {
                            borderColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.55)' : 'rgba(148, 163, 184, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                        },
                    },
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: mode === 'dark' ? '#0f172a' : '#ffffff',
                    color: mode === 'dark' ? '#f8fafc' : '#0f172a',
                    borderBottom: mode === 'dark' ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid rgba(148, 163, 184, 0.15)',
                    boxShadow: 'none',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    background: mode === 'dark' ? '#0f172a' : '#ffffff',
                    borderRight: mode === 'dark' ? '1px solid rgba(148, 163, 184, 0.22)' : '1px solid rgba(148, 163, 184, 0.15)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                },
            },
        },
    },
});
