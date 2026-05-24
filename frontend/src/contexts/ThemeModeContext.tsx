import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeModeContextType {
  mode: ThemeMode;
  toggleThemeMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const toggleThemeMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
    
    // Synchronize global CSS properties on the root HTML element
    const root = document.documentElement;
    if (mode === 'dark') {
      root.style.setProperty('--background-default', '#0b1220');
      root.style.setProperty('--background-paper', '#111a2e');
      root.style.setProperty('--background-elevated', '#1a2740');
      root.style.setProperty('--text-primary', '#f8fafc');
      root.style.setProperty('--text-secondary', '#cbd5e1');
      root.style.setProperty('--border-color', 'rgba(148, 163, 184, 0.22)');
      root.style.setProperty('--gradient-card', 'linear-gradient(145deg, rgba(148, 163, 184, 0.14) 0%, rgba(148, 163, 184, 0.05) 100%)');
      root.style.setProperty('--shadow-sm', '0 2px 4px rgba(0, 0, 0, 0.3)');
      root.style.setProperty('--shadow-md', '0 4px 12px rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--shadow-lg', '0 8px 24px rgba(0, 0, 0, 0.5)');
      root.style.setProperty('--shadow-glow', '0 0 20px rgba(59, 130, 246, 0.25)');
    } else {
      root.style.setProperty('--background-default', '#f8fafc');
      root.style.setProperty('--background-paper', '#ffffff');
      root.style.setProperty('--background-elevated', '#ffffff');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--border-color', 'rgba(148, 163, 184, 0.15)');
      root.style.setProperty('--gradient-card', 'linear-gradient(145deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)');
      root.style.setProperty('--shadow-sm', '0 1px 2px rgba(0, 0, 0, 0.05)');
      root.style.setProperty('--shadow-md', '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--shadow-glow', '0 0 20px rgba(59, 130, 246, 0.12)');
    }
  }, [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}
