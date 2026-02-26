import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { SessionMap } from '@/components/SessionMap';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addSessionShare,
  getCandyLogs,
  getCostume,
  getHouseVisits,
  getLocationPoints,
  getProfile,
  getProfiles,
  getSession,
  getSessionSharedWithProfileIds,
  getSessionStats,
  removeSessionShare,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { CandyLog, House, LocationPoint, Profile, Session } from '@/types';
import { Image } from 'react-native';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile } = useProfile();
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [candy, setCandy] = useState<CandyLog[]>([]);
  const [houseVisits, setHouseVisits] = useState<
    { house?: House }[]
  >([]);
  const [stats, setStats] = useState({ candyCount: 0, houseCount: 0 });
  const [costumeName, setCostumeName] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [sharedWithProfiles, setSharedWithProfiles] = useState<Profile[]>([]);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSharedWith = useCallback(
    async (sessionId: number) => {
      const ids = await getSessionSharedWithProfileIds(db, sessionId);
      const profiles = await Promise.all(ids.map((pid) => getProfile(db, pid)));
      setSharedWithProfiles(profiles.filter((p): p is Profile => p != null));
    },
    [db]
  );

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;

    (async () => {
      setLoading(true);
      const s = await getSession(db, numId);
      setSession(s ?? null);
      if (s) {
        const owner = await getProfile(db, s.profile_id);
        setOwnerProfile(owner ?? null);
        const [pts, candyLogs, visits, sessionStats] = await Promise.all([
          getLocationPoints(db, s.id),
          getCandyLogs(db, s.profile_id, s.id),
          getHouseVisits(db, s.id),
          getSessionStats(db, s.id),
        ]);
        setPoints(pts);
        setCandy(candyLogs);
        setHouseVisits(visits);
        setStats(sessionStats);
        if (s.costume_id) {
          const c = await getCostume(db, s.costume_id);
          setCostumeName(c?.name ?? null);
        }
        await loadSharedWith(s.id);
      }
      setLoading(false);
    })();
  }, [id, db, loadSharedWith]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg },
        center: { justifyContent: 'center', alignItems: 'center' },
        title: {
          fontSize: theme.fontSize.xxl,
          fontWeight: 'bold',
          color: theme.colors.primary,
          textAlign: 'center',
          marginBottom: theme.spacing.lg,
        },
        mapWrap: {
          height: 220,
          marginBottom: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        },
        map: { flex: 1 },
        stats: { flexDirection: 'row', gap: theme.spacing.lg, marginBottom: theme.spacing.lg },
        stat: {
          flex: 1,
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        },
        statValue: {
          fontSize: theme.fontSize.xxl,
          fontWeight: 'bold',
          color: theme.colors.text,
        },
        statLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        costume: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xs,
        },
        meta: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
        },
        sectionTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        candyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
        },
        candyThumb: {
          width: 48,
          height: 48,
          borderRadius: theme.borderRadius.sm,
          marginRight: theme.spacing.md,
        },
        candyInfo: { flex: 1 },
        candyName: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
        },
        candyQty: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        houseCandyBlock: { marginBottom: theme.spacing.lg },
        houseCandyLabel: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.secondary,
          marginBottom: theme.spacing.sm,
        },
        houseItem: {
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        doneBtn: {
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
        },
        doneBtnPressed: { opacity: 0.9 },
        doneBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: '#fff',
        },
        shareSection: {
          marginBottom: theme.spacing.lg,
        },
        shareRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xs,
        },
        shareBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.md,
        },
        shareBtnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: '#fff' },
        sharedFrom: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
        unshareBtn: { padding: theme.spacing.xs },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.lg,
        },
        modalContent: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          width: '100%',
          maxWidth: 320,
          maxHeight: '70%',
        },
        modalTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
        profileOption: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
      }),
    [theme]
  );

  if (loading || !session) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const coords = points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const started = new Date(session.started_at);
  const ended = session.ended_at ? new Date(session.ended_at) : null;
  const duration = ended
    ? Math.round((ended.getTime() - started.getTime()) / 60000)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Session complete!</Text>

      <View style={styles.mapWrap}>
        <SessionMap
          coordinates={coords}
          houses={houseVisits
            .filter((v) => v.house?.latitude != null && v.house?.longitude != null)
            .map((v) => ({
              id: v.house!.id,
              name: v.house!.name,
              latitude: v.house!.latitude!,
              longitude: v.house!.longitude!,
            }))}
          style={styles.map}
        />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <FontAwesome name="gift" size={32} color={theme.colors.primary} />
          <Text style={styles.statValue}>{stats.candyCount}</Text>
          <Text style={styles.statLabel}>Pieces of candy</Text>
        </View>
        <View style={styles.stat}>
          <FontAwesome name="home" size={32} color={theme.colors.secondary} />
          <Text style={styles.statValue}>{stats.houseCount}</Text>
          <Text style={styles.statLabel}>Houses visited</Text>
        </View>
      </View>

      {costumeName && (
        <Text style={styles.costume}>Costume: {costumeName}</Text>
      )}
      <Text style={styles.meta}>
        {started.toLocaleDateString()} · {duration} min
      </Text>

      {profile && session && ownerProfile && session.profile_id !== profile.id && (
        <Text style={styles.sharedFrom}>
          Shared from {ownerProfile.name}
        </Text>
      )}

      {profile && session && session.profile_id === profile.id && (
        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Share with other profiles</Text>
          {sharedWithProfiles.map((p) => (
            <View key={p.id} style={styles.shareRow}>
              <Text style={styles.candyName}>{p.name}</Text>
              <Pressable
                style={styles.unshareBtn}
                onPress={async () => {
                  await removeSessionShare(db, session.id, p.id);
                  await loadSharedWith(session.id);
                }}
              >
                <FontAwesome name="times-circle" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}
            onPress={async () => {
              if (!session) return;
              const all = await getProfiles(db);
              const sharedIds = new Set(sharedWithProfiles.map((p) => p.id));
              setAvailableProfiles(
                all.filter((p) => p.id !== session.profile_id && !sharedIds.has(p.id))
              );
              setShareModalVisible(true);
            }}
          >
            <FontAwesome name="user-plus" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Share with another profile</Text>
          </Pressable>
        </View>
      )}

      {candy.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your haul by house</Text>
          {houseVisits.map((v) => {
            const houseCandy = candy.filter((c) => c.house_id === v.house_id);
            if (houseCandy.length === 0) return null;
            return (
              <View key={v.house_id} style={styles.houseCandyBlock}>
                <Text style={styles.houseCandyLabel}>{v.house?.name ?? 'House'}</Text>
                {houseCandy.map((c) => (
                  <View key={c.id} style={styles.candyRow}>
                    {c.image_path && (
                      <Image
                        source={{ uri: getImageUri(c.image_path)! }}
                        style={styles.candyThumb}
                      />
                    )}
                    <View style={styles.candyInfo}>
                      <Text style={styles.candyName}>{c.candy_name}</Text>
                      <Text style={styles.candyQty}>× {c.quantity}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
          {candy.filter((c) => c.house_id == null).length > 0 && (
            <View style={styles.houseCandyBlock}>
              <Text style={styles.houseCandyLabel}>Other</Text>
              {candy
                .filter((c) => c.house_id == null)
                .map((c) => (
                  <View key={c.id} style={styles.candyRow}>
                    {c.image_path && (
                      <Image
                        source={{ uri: getImageUri(c.image_path)! }}
                        style={styles.candyThumb}
                      />
                    )}
                    <View style={styles.candyInfo}>
                      <Text style={styles.candyName}>{c.candy_name}</Text>
                      <Text style={styles.candyQty}>× {c.quantity}</Text>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </>
      )}

      {houseVisits.length > 0 && candy.length === 0 && (
        <>
          <Text style={styles.sectionTitle}>Houses</Text>
          {houseVisits.map((v, i) => (
            <Text key={i} style={styles.houseItem}>
              • {v.house?.name ?? 'House'}
            </Text>
          ))}
        </>
      )}

      <Pressable
        style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>

      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareModalVisible(false)} />
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Share with profile</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator>
              {availableProfiles.length === 0 ? (
                <Text style={styles.meta}>No other profiles to share with.</Text>
              ) : (
                availableProfiles.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.profileOption}
                    onPress={async () => {
                      if (!session) return;
                      await addSessionShare(db, session.id, p.id);
                      await loadSharedWith(session.id);
                      setShareModalVisible(false);
                    }}
                  >
                    <Text style={styles.candyName}>{p.name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: theme.spacing.xl }} />
    </ScrollView>
  );
}
