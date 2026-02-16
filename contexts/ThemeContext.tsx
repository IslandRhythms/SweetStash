import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type Theme } from '@/constants/theme';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return getTheme('light');
  }
  return ctx;
}
