import type { ColorSchemeName } from 'react-native';

const shared = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSize: {
    sm: 14,
    md: 18,
    lg: 22,
    xl: 26,
    xxl: 32,
  },
  minTouchTarget: 44,
} as const;

export const lightTheme = {
  ...shared,
  dark: false as const,
  colors: {
    headerBackground: '#B5562A',
    primary: '#B5562A',
    primaryDark: '#8F4220',
    primaryText: '#B5562A',
    secondary: '#7B2CBF',
    secondaryDark: '#5A189A',
    secondaryText: '#7B2CBF',
    background: '#FFF8F0',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textMuted: '#6B6B6B',
    border: '#E8E0D8',
    success: '#2D8A4E',
    warning: '#E8A317',
  },
} as const;

export const darkTheme = {
  ...shared,
  dark: true as const,
  colors: {
    headerBackground: '#9B4DDF',
    primary: '#C2410C',
    primaryDark: '#FF6B00',
    primaryText: '#FF8533',
    secondary: '#9B4DDF',
    secondaryDark: '#7B2CBF',
    secondaryText: '#C084FC',
    background: '#1A1A1A',
    surface: '#2D2D2D',
    text: '#F5F5F5',
    textMuted: '#A0A0A0',
    border: '#404040',
    success: '#3DA85E',
    warning: '#F5B82E',
  },
} as const;

export type Theme = typeof lightTheme | typeof darkTheme;

export function getTheme(colorScheme: ColorSchemeName): Theme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}

/** @deprecated Use getTheme(useColorScheme()) or useTheme() instead. Kept for gradual migration. */
export const theme = lightTheme;
