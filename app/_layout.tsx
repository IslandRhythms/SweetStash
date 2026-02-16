import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ProfileProvider } from '@/contexts/ProfileContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { migrateDb } from '@/lib/db';

function AppStack() {
  const theme = useTheme();
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="session/summary/[id]"
        options={{
          title: 'Session summary',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: theme.colors.headerBackground },
          headerTintColor: '#fff',
        }}
      />
    </Stack>
  );
}

function NavThemeBridge({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const navTheme = {
    dark: theme.dark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.secondary,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  };
  return <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>;
}

function StackWrapper() {
  return (
    <NavThemeBridge>
      <AppStack />
    </NavThemeBridge>
  );
}

export { ErrorBoundary } from '@/components/ErrorBoundary';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SQLiteProvider
      databaseName="sweetstash.db"
      onInit={migrateDb}
      onError={(e) => console.error('SQLite error:', e)}
    >
      <ThemeProvider>
        <ProfileProvider>
          <StackWrapper />
        </ProfileProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
