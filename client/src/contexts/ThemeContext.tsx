import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const darkThemeVariables: Record<string, string> = {
  '--background': 'oklch(0.17 0.018 285)',
  '--foreground': 'oklch(0.96 0.008 90)',
  '--card': 'oklch(0.22 0.024 285)',
  '--card-foreground': 'oklch(0.96 0.008 90)',
  '--popover': 'oklch(0.25 0.028 285)',
  '--popover-foreground': 'oklch(0.96 0.008 90)',
  '--muted': 'oklch(0.28 0.026 285)',
  '--muted-foreground': 'oklch(0.77 0.02 285)',
  '--accent': 'oklch(0.74 0.14 295)',
  '--accent-foreground': 'oklch(0.18 0.018 285)',
  '--border': 'oklch(0.36 0.025 285)',
  '--input': 'oklch(0.36 0.025 285)',
  '--ring': 'oklch(0.74 0.14 295)',
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      Object.entries(darkThemeVariables).forEach(([name, value]) => root.style.setProperty(name, value));
    } else {
      root.classList.remove("dark");
      Object.keys(darkThemeVariables).forEach(name => root.style.removeProperty(name));
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
