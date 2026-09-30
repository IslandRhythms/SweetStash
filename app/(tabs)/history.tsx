import { useRouter } from 'expo-router';
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
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getCostume,
  getFirstProfile,
  getProfile,
  getSessionStats,
  getSessions,
  getStashRoundStats,
  getStashRounds,
  updateStashRound,
} from '@/lib/db';
import type { Session, StashRound } from '@/types';

type SessionWithStats = Session & {
  candyCount?: number;
  houseCount?: number;
  ownerName?: string;
  costumeName?: string;
};
type StashRoundWithStats = StashRound & { candyCount?: number };

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [stashRounds, setStashRounds] = useState<StashRoundWithStats[]>([]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [sessionList, stashList] = await Promise.all([
      getSessions(db, profile.id),
      getStashRounds(db, profile.id),
    ]);
    const withSessionStats = await Promise.all(
      sessionList.map(async (s) => {
        const st = await getSessionStats(db, s.id);
        const ownerName =
          s.profile_id !== profile.id
            ? (await getProfile(db, s.profile_id))?.name ?? null
            : null;
        let costumeName: string | undefined;
        if (s.costume_id != null) {
          const costume = await getCostume(db, s.costume_id);
          costumeName = costume?.name;
        }
        return {
          ...s,
          candyCount: st.candyCount,
          houseCount: st.houseCount,
          ownerName: ownerName ?? undefined,
          costumeName,
        };
      })
    );
    const withStashStats = await Promise.all(
      stashList.map(async (r) => {
        const st = await getStashRoundStats(db, r.id);
        return { ...r, candyCount: st.candyCount };
      })
    );
    setSessions(withSessionStats);
    setStashRounds(withStashStats);
  }, [profile, db]);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db]);

  useEffect(() => {
    if (profile) loadData();
  }, [profile, loadData]);

  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkStep, setLinkStep] = useState<'stash' | 'session'>('stash');
  const [selectedStashRoundId, setSelectedStashRoundId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);

  function openLinkModal() {
    setSelectedStashRoundId(null);
    setSelectedSessionId(null);
    setLinkStep('stash');
    setLinkModalVisible(true);
  }

  async function confirmLink() {
    if (selectedStashRoundId == null || selectedSessionId == null || !profile) return;
    setLinking(true);
    try {
      await updateStashRound(db, selectedStashRoundId, {
        linkedSessionId: selectedSessionId === 0 ? null : selectedSessionId,
      });
      await loadData();
      setLinkModalVisible(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLinking(false);
    }
  }

  const sessionById = useMemo(() => {
    const m = new Map<number, Session>();
    sessions.forEach((s) => m.set(s.id, s));
    return m;
  }, [sessions]);

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
          marginBottom: theme.spacing.md,
        },
        sectionTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginTop: theme.spacing.lg,
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
        linkBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.lg,
        },
        linkBtnText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: '#fff',
        },
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
          maxWidth: 360,
          maxHeight: '80%',
        },
        modalTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        modalRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
        },
        modalBtn: {
          flex: 1,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          alignItems: 'center',
        },
        modalBtnSecondary: { backgroundColor: theme.colors.border },
        modalBtnPrimary: { backgroundColor: theme.colors.primary },
        modalBtnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
        modalBtnTextPrimary: { color: '#fff' },
        linkOption: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        linkOptionSelected: { backgroundColor: `${theme.colors.primary}20` },
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
      <Pressable
        style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.9 }]}
        onPress={openLinkModal}
      >
        <FontAwesome name="link" size={20} color="#fff" />
        <Text style={styles.linkBtnText}>Link stash round to session</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Trick-or-treat sessions</Text>
      {sessions.length === 0 ? (
        <Text style={styles.empty}>
          No sessions yet. Start trick-or-treating to see your history here!
        </Text>
      ) : (
        sessions.map((s) => {
          const started = new Date(s.started_at);
          return (
            <Pressable
              key={s.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/session/summary/${s.id}`)}
            >
              <View style={styles.cardLeft}>
                <FontAwesome name="map" size={28} color={theme.colors.primaryText} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardDate}>
                    {started.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {s.candyCount ?? 0} candy · {s.houseCount ?? 0}{' '}
                    {s.houseCount === 1 ? 'house' : 'houses'}
                    {s.costumeName ? ` · ${s.costumeName}` : ''}
                    {s.ownerName ? ` · From: ${s.ownerName}` : ''}
                  </Text>
                </View>
              </View>
              <FontAwesome name="chevron-right" size={20} color={theme.colors.textMuted} />
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Stash rounds</Text>
      {stashRounds.length === 0 ? (
        <Text style={styles.empty}>
          No stash rounds yet. Save a round on My Stash to see it here!
        </Text>
      ) : (
        stashRounds.map((r) => {
          const date = (r.ended_at && new Date(r.ended_at)) || new Date(r.created_at);
          const linkedSession =
            r.linked_session_id != null ? sessionById.get(r.linked_session_id) : null;
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <FontAwesome name="gift" size={28} color={theme.colors.primaryText} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardDate}>
                    {r.name || date.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {r.candyCount ?? 0} candy
                    {linkedSession
                      ? ` · Linked to session ${new Date(linkedSession.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                      : ''}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: theme.spacing.xl * 2 }} />

      <Modal
        visible={linkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLinkModalVisible(false)} />
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              {linkStep === 'stash'
                ? 'Select a stash round to link'
                : 'Select a session to link to'}
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator>
              {linkStep === 'stash' &&
                stashRounds.map((r) => {
                  const date = (r.ended_at && new Date(r.ended_at)) || new Date(r.created_at);
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.linkOption,
                        selectedStashRoundId === r.id && styles.linkOptionSelected,
                      ]}
                      onPress={() => setSelectedStashRoundId(r.id)}
                    >
                      <Text style={styles.cardDate}>
                        {r.name || date.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.cardMeta}>{r.candyCount ?? 0} candy</Text>
                    </Pressable>
                  );
                })}
              {linkStep === 'session' && (
                <>
                  <Pressable
                    style={[
                      styles.linkOption,
                      selectedSessionId === 0 && styles.linkOptionSelected,
                    ]}
                    onPress={() => setSelectedSessionId(0)}
                  >
                    <Text style={styles.cardDate}>None — remove link</Text>
                    <Text style={styles.cardMeta}>Unlink this stash round from any session</Text>
                  </Pressable>
                  {sessions.map((s) => {
                    const started = new Date(s.started_at);
                    return (
                      <Pressable
                        key={s.id}
                        style={[
                          styles.linkOption,
                          selectedSessionId === s.id && styles.linkOptionSelected,
                        ]}
                        onPress={() => setSelectedSessionId(s.id)}
                      >
                        <Text style={styles.cardDate}>
                          {started.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {s.candyCount ?? 0} candy · {s.houseCount ?? 0}{' '}
                          {s.houseCount === 1 ? 'house' : 'houses'}
                          {s.costumeName ? ` · ${s.costumeName}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>
            <View style={styles.modalRow}>
              {linkStep === 'session' ? (
                <>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                    onPress={() => setLinkStep('stash')}
                  >
                    <Text style={styles.modalBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalBtn,
                      styles.modalBtnPrimary,
                      (selectedSessionId == null || linking) && { opacity: 0.6 },
                    ]}
                    onPress={confirmLink}
                    disabled={selectedSessionId == null || linking}
                  >
                    <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                      {linking ? 'Linking...' : 'Link'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    selectedStashRoundId == null && { opacity: 0.6 },
                  ]}
                  onPress={() => selectedStashRoundId != null && setLinkStep('session')}
                  disabled={selectedStashRoundId == null}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Next</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
