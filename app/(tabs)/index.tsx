import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { useProfile } from '@/contexts/ProfileContext';
import { theme } from '@/constants/theme';
import { getFirstProfile, getProfile } from '@/lib/db';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { profile, loadStoredProfile, setProfile } = useProfile();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db]);

  if (!ready || !profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi, {profile?.name ?? 'Trick-or-Treater'}!</Text>
      <Text style={styles.subtitle}>Ready to track your Halloween haul?</Text>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push('/(tabs)/log')}
      >
        <View style={styles.iconWrap}>
          <FontAwesome name="gift" size={40} color={theme.colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Log your haul!</Text>
        <Text style={styles.cardSubtitle}>Add candy and houses you visited</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push('/(tabs)/session')}
      >
        <View style={styles.iconWrap}>
          <FontAwesome name="map" size={40} color={theme.colors.secondary} />
        </View>
        <Text style={styles.cardTitle}>Start trick-or-treating!</Text>
        <Text style={styles.cardSubtitle}>Track your route on the map</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.profileBtn, pressed && styles.btnPressed]}
        onPress={() => router.push('/(tabs)/settings')}
      >
        <FontAwesome name="cog" size={20} color={theme.colors.textMuted} />
        <Text style={styles.profileBtnText}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  greeting: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    minHeight: 100,
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconWrap: {
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
  },
  btnPressed: {
    opacity: 0.7,
  },
  profileBtnText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
});
