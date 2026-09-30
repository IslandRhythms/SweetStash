import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import { useSQLiteContext } from 'expo-sqlite';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getCostume, getCostumePhotosWithSessionMeta, getFirstProfile, getProfile } from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { Costume, CostumePhotoWithSession } from '@/types';

function formatSessionLabel(startedAt: string | null): string {
  if (!startedAt) return 'Added outside a session';
  try {
    const d = new Date(startedAt);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Session';
  }
}

export default function CostumeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [costume, setCostume] = useState<Costume | null>(null);
  const [photos, setPhotos] = useState<CostumePhotoWithSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

  const numId = id ? parseInt(id, 10) : NaN;

  const load = useCallback(async () => {
    if (!profile || isNaN(numId)) return;
    setLoading(true);
    const c = await getCostume(db, numId);
    if (!c || c.profile_id !== profile.id) {
      setCostume(null);
      setPhotos([]);
      setLoading(false);
      return;
    }
    setCostume(c);
    const list = await getCostumePhotosWithSessionMeta(db, numId);
    setPhotos(list);
    setLoading(false);
  }, [db, numId, profile]);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (pid) => getProfile(db, pid),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db, loadStoredProfile]);

  useEffect(() => {
    if (ready && profile) load();
  }, [ready, profile, load]);

  useLayoutEffect(() => {
    if (costume?.name) {
      navigation.setOptions({ title: costume.name });
    }
  }, [costume?.name, navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        title: {
          fontSize: theme.fontSize.xxl,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        meta: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
          lineHeight: 22,
        },
        photoCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
          marginBottom: theme.spacing.lg,
        },
        photo: {
          width: '100%',
          aspectRatio: 3 / 4,
          backgroundColor: theme.colors.border,
        },
        caption: {
          padding: theme.spacing.md,
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
        },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: theme.spacing.lg,
        },
        forbidden: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
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

  if (isNaN(numId)) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.forbidden}>Invalid costume.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primaryText} />
      </View>
    );
  }

  if (!costume) {
    return (
      <View style={[styles.center, styles.container]}>
        <Text style={styles.forbidden}>Costume not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{costume.name}</Text>
        <Text style={styles.meta}>
          All photos for this character, newest first. Trick-or-treat sessions only list shots from
          that night; this screen is the full archive.
        </Text>

        {photos.length === 0 ? (
          <Text style={styles.empty}>No photos in the pool yet. Add some from a session or summary.</Text>
        ) : (
          photos.map((ph) => (
            <View key={ph.id} style={styles.photoCard}>
              <Pressable
                onPress={() => setImagePreviewUri(getImageUri(ph.image_path) ?? null)}
                accessibilityRole="button"
                accessibilityLabel="View photo full size"
              >
                <Image
                  source={{ uri: getImageUri(ph.image_path)! }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              </Pressable>
              <Text style={styles.caption}>{formatSessionLabel(ph.session_started_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <ImagePreviewModal
        visible={imagePreviewUri != null}
        imageUri={imagePreviewUri}
        onClose={() => setImagePreviewUri(null)}
      />
    </>
  );
}
