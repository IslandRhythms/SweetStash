import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { SessionMap } from '@/components/SessionMap';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getCandyLogs,
  getCostume,
  getHouseVisits,
  getLocationPoints,
  getSession,
  getSessionStats,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { CandyLog, LocationPoint, Session } from '@/types';
import { Image } from 'react-native';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [candy, setCandy] = useState<CandyLog[]>([]);
  const [houseVisits, setHouseVisits] = useState<
    { house?: { name: string } }[]
  >([]);
  const [stats, setStats] = useState({ candyCount: 0, houseCount: 0 });
  const [costumeName, setCostumeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return;

    (async () => {
      setLoading(true);
      const s = await getSession(db, numId);
      setSession(s ?? null);
      if (s) {
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
      }
      setLoading(false);
    })();
  }, [id, db]);

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
        houseItem: {
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
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
        <SessionMap coordinates={coords} style={styles.map} />
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

      {candy.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your haul</Text>
          {candy.map((c) => (
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
        </>
      )}

      {houseVisits.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Houses</Text>
          {houseVisits.map((v, i) => (
            <Text key={i} style={styles.houseItem}>
              • {v.house?.name ?? 'House'}
            </Text>
          ))}
        </>
      )}

      <View style={{ height: theme.spacing.xl * 2 }} />
    </ScrollView>
  );
}
