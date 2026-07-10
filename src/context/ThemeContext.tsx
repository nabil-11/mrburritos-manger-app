import { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: true, toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem('mr_theme') !== 'light'; } catch { return true; }
  });

  // Drive Ionic's dark palette so overlays (action-sheet, alert, toast) match the UI
  useEffect(() => {
    document.documentElement.classList.toggle('ion-palette-dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      try { localStorage.setItem('mr_theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
