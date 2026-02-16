import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  getCandyLogs,
  getFirstProfile,
  getProfile,
  getSessionStats,
  getSessions,
} from '@/lib/db';
import type { CandyLog, Session } from '@/types';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<(Session & { candyCount?: number; houseCount?: number })[]>([]);
  const [standaloneCandy, setStandaloneCandy] = useState<CandyLog[]>([]);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db]);

  useEffect(() => {
    if (profile) {
      (async () => {
        const list = await getSessions(db, profile.id);
        const withStats = await Promise.all(
          list.map(async (s) => {
            const st = await getSessionStats(db, s.id);
            return { ...s, candyCount: st.candyCount, houseCount: st.houseCount };
          })
        );
        setSessions(withStats);

        const allCandy = await getCandyLogs(db, profile.id);
        const standalone = allCandy.filter((c) => c.session_id == null);
        setStandaloneCandy(standalone);
      })();
    }
  }, [profile, db]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg },
        center: { justifyContent: 'center', alignItems: 'center' },
        title: {
          fontSize: theme.fontSize.xl,
          fontWeight: 'bold',
          color: theme.colors.text,
          marginBottom: theme.spacing.lg,
        },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: theme.spacing.xl,
        },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.md,
          minHeight: theme.minTouchTarget,
        },
        cardPressed: { opacity: 0.9 },
        cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
        cardInfo: { marginLeft: theme.spacing.md },
        cardDate: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
        },
        cardMeta: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: 2,
        },
        sectionTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
          marginTop: theme.spacing.xl,
          marginBottom: theme.spacing.md,
        },
        candyRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        candyText: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.text },
        candyDate: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        more: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
      }),
    [theme]
  );

  if (!ready || !profile) {
    return (
      <View style={[styles.center, styles.container]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Past trick-or-treat sessions</Text>

      {sessions.length === 0 && standaloneCandy.length === 0 ? (
        <Text style={styles.empty}>
          No sessions yet. Start trick-or-treating to see your history here!
        </Text>
      ) : (
        <>
          {sessions.map((s) => {
            const started = new Date(s.started_at);
            return (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/session/summary/${s.id}`)}
              >
                <View style={styles.cardLeft}>
                  <FontAwesome name="map" size={28} color={theme.colors.primary} />
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardDate}>
                      {started.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {s.candyCount ?? 0} candy · {s.houseCount ?? 0} houses
                    </Text>
                  </View>
                </View>
                <FontAwesome name="chevron-right" size={20} color={theme.colors.textMuted} />
              </Pressable>
            );
          })}

          {standaloneCandy.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Logged without session</Text>
              {standaloneCandy.slice(0, 10).map((c) => (
                <View key={c.id} style={styles.candyRow}>
                  <FontAwesome name="gift" size={20} color={theme.colors.textMuted} />
                  <Text style={styles.candyText}>
                    {c.candy_name} × {c.quantity}
                  </Text>
                  <Text style={styles.candyDate}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}
              {standaloneCandy.length > 10 && (
                <Text style={styles.more}>
                  +{standaloneCandy.length - 10} more
                </Text>
              )}
            </>
          )}
        </>
      )}
      <View style={{ height: theme.spacing.xl * 2 }} />
    </ScrollView>
  );
}
