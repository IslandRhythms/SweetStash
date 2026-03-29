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
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://ef8abed9b50ad8fa68de64ef3c3bca7d@o4510904393334784.ingest.us.sentry.io/4510904395300864',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

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
      <Stack.Screen
        name="costume/[id]"
        options={{
          title: 'Costume',
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

export default Sentry.wrap(function RootLayout() {
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
});