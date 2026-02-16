import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type ErrorBoundaryProps } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getTheme } from '@/constants/theme';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FontAwesome
        name="exclamation-triangle"
        size={48}
        color={theme.colors.warning}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Oops! Something went wrong.
      </Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
