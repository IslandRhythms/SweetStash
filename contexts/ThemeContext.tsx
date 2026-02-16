import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { getTheme, type Theme } from '@/constants/theme';

const THEME_PREFERENCE_KEY = '@sweetstash/theme_preference';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  themePreference: ThemePreference | null;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        setThemePreferenceState(value);
      } else {
        setThemePreferenceState('system');
      }
    });
  }, []);

  const setThemePreference = useCallback(async (preference: ThemePreference) => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
    setThemePreferenceState(preference);
  }, []);

  const effectiveScheme =
    themePreference === null
      ? 'light'
      : themePreference === 'system'
        ? systemColorScheme ?? 'light'
        : themePreference;
  const theme = getTheme(effectiveScheme);

  return (
    <ThemeContext.Provider
      value={{ theme, themePreference: themePreference ?? 'system', setThemePreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return getTheme('light');
  }
  return ctx.theme;
}

export function useThemePreference(): {
  themePreference: ThemePreference | null;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
} {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      themePreference: 'system',
      setThemePreference: async () => {},
    };
  }
  return {
    themePreference: ctx.themePreference,
    setThemePreference: ctx.setThemePreference,
  };
}
