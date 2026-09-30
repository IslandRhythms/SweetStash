import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getCostumesWithPhotoCounts, getFirstProfile, getProfile } from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { CostumeWithPhotoCount } from '@/types';

export default function CostumesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [costumes, setCostumes] = useState<CostumeWithPhotoCount[]>([]);

  const loadCostumes = useCallback(async () => {
    if (!profile) return;
    const list = await getCostumesWithPhotoCounts(db, profile.id);
    setCostumes(list);
  }, [db, profile]);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db, loadStoredProfile]);

  useEffect(() => {
    if (profile) loadCostumes();
  }, [profile, loadCostumes]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        title: {
          fontSize: theme.fontSize.xl,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        subtitle: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
          lineHeight: 22,
        },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          gap: theme.spacing.md,
          minHeight: theme.minTouchTarget + 16,
        },
        cardPressed: { opacity: 0.92 },
        thumb: {
          width: 64,
          height: 64,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cardBody: { flex: 1, minWidth: 0 },
        cardName: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
        },
        cardMeta: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: 4,
        },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: theme.spacing.xl,
          lineHeight: 24,
        },
      }),
    [theme]
  );

  if (!ready || !profile) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primaryText} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Costumes</Text>
      <Text style={styles.subtitle}>
        One entry per character or outfit. Photos from every Halloween stack here; each
        trick-or-treat session only shows photos you added for that night.
      </Text>

      {costumes.length === 0 ? (
        <Text style={styles.empty}>
          No costumes yet. Start a session and open the Costume section to create one, or add a name
          on the session summary.
        </Text>
      ) : (
        costumes.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/costume/${c.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${c.photo_count} photos`}
          >
            {c.image_path ? (
              <Image
                source={{ uri: getImageUri(c.image_path)! }}
                style={styles.thumb}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumb}>
                <FontAwesome name="user" size={28} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={2}>
                {c.name}
              </Text>
              <Text style={styles.cardMeta}>
                {c.photo_count} photo{c.photo_count !== 1 ? 's' : ''} across all years
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
