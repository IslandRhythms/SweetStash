import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { useProfile } from '@/contexts/ProfileContext';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { ImagePickerButton } from '@/components/ImagePicker';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addHouseVisit,
  createCandyLog,
  createHouse,
  getActiveSession,
  getCandyLogs,
  getFirstProfile,
  getHouses,
  getProfile,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { CandyLog, House } from '@/types';
import { Image } from 'react-native';

type Mode = 'view' | 'add';
type AddTab = 'candy' | 'house';

export default function LogScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [mode, setMode] = useState<Mode>('view');
  const [tab, setTab] = useState<AddTab>('candy');
  const [ready, setReady] = useState(false);
  const [candyLogs, setCandyLogs] = useState<CandyLog[]>([]);
  const [houses, setHouses] = useState<House[]>([]);

  // Candy form
  const [candyName, setCandyName] = useState('');
  const [candyQty, setCandyQty] = useState('1');
  const [candyImage, setCandyImage] = useState<string | null>(null);
  const [linkToSession, setLinkToSession] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [submittingCandy, setSubmittingCandy] = useState(false);

  // House form
  const [houseName, setHouseName] = useState('');
  const [houseNotes, setHouseNotes] = useState('');
  const [houseImage, setHouseImage] = useState<string | null>(null);
  const [submittingHouse, setSubmittingHouse] = useState(false);

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db]);

  useEffect(() => {
    if (profile) {
      getActiveSession(db, profile.id).then((s) =>
        setActiveSessionId(s?.id ?? null)
      );
    }
  }, [profile, db]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [candy, houseList] = await Promise.all([
      getCandyLogs(db, profile.id),
      getHouses(db, profile.id),
    ]);
    setCandyLogs(candy);
    setHouses(houseList);
  }, [profile, db]);

  useEffect(() => {
    if (profile) loadData();
  }, [profile, loadData]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        center: { justifyContent: 'center', alignItems: 'center' },
        modeTabs: {
          flexDirection: 'row',
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.surface,
        },
        modeTab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
        modeTabActive: { backgroundColor: theme.colors.primary },
        modeTabText: { fontSize: theme.fontSize.md, color: theme.colors.textMuted },
        modeTabTextActive: { color: '#fff', fontWeight: '600' },
        addTabs: {
          flexDirection: 'row',
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.background,
        },
        addTab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
        addTabActive: { backgroundColor: theme.colors.primary },
        addTabText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        addTabTextActive: { color: '#fff', fontWeight: '600' },
        scroll: { flex: 1 },
        scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        sectionTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          marginBottom: theme.spacing.lg,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
        },
        rowThumb: {
          width: 40,
          height: 40,
          borderRadius: theme.borderRadius.sm,
          marginRight: theme.spacing.md,
        },
        rowText: { flex: 1, fontSize: theme.fontSize.md, color: theme.colors.text },
        rowMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
        label: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        input: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        textArea: { minHeight: 80, textAlignVertical: 'top' as const },
        checkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.lg,
        },
        checkLabel: { fontSize: theme.fontSize.md, color: theme.colors.text },
        submitBtn: {
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
        },
        submitBtnDisabled: { opacity: 0.6 },
        submitBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: '#fff',
        },
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

  async function submitCandy() {
    if (!profile) return;
    const name = candyName.trim();
    if (!name) {
      Alert.alert('Oops!', 'Enter a candy name.');
      return;
    }
    const qty = parseInt(candyQty, 10) || 1;
    if (qty < 1) {
      Alert.alert('Oops!', 'Quantity must be at least 1.');
      return;
    }
    setSubmittingCandy(true);
    try {
      const sessionId = linkToSession && activeSessionId ? activeSessionId : null;
      await createCandyLog(db, profile.id, name, qty, {
        sessionId,
        image_path: candyImage,
      });
      setCandyName('');
      setCandyQty('1');
      setCandyImage(null);
      await loadData();
      Alert.alert('Yum!', `Added ${name} to your haul!`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add candy.');
    } finally {
      setSubmittingCandy(false);
    }
  }

  async function submitHouse() {
    if (!profile) return;
    const name = houseName.trim();
    if (!name) {
      Alert.alert('Oops!', 'Enter a house name or address.');
      return;
    }
    setSubmittingHouse(true);
    try {
      const houseId = await createHouse(db, profile.id, name, {
        notes: houseNotes.trim() || null,
        image_path: houseImage,
      });
      if (activeSessionId) {
        await addHouseVisit(db, activeSessionId, houseId);
      }
      setHouseName('');
      setHouseNotes('');
      setHouseImage(null);
      await loadData();
      Alert.alert(
        'Got it!',
        activeSessionId
          ? `Added ${name} to your session!`
          : `Added ${name} to your houses!`
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add house.');
    } finally {
      setSubmittingHouse(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeTabs}>
        <Pressable
          style={[styles.modeTab, mode === 'view' && styles.modeTabActive]}
          onPress={() => setMode('view')}
        >
          <FontAwesome
            name="list"
            size={20}
            color={mode === 'view' ? '#fff' : theme.colors.textMuted}
          />
          <Text style={[styles.modeTabText, mode === 'view' && styles.modeTabTextActive]}>
            See my stash
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeTab, mode === 'add' && styles.modeTabActive]}
          onPress={() => setMode('add')}
        >
          <FontAwesome
            name="plus-circle"
            size={20}
            color={mode === 'add' ? '#fff' : theme.colors.textMuted}
          />
          <Text style={[styles.modeTabText, mode === 'add' && styles.modeTabTextActive]}>
            Add treats
          </Text>
        </Pressable>
      </View>

      {mode === 'view' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>My candy</Text>
          {candyLogs.length === 0 ? (
            <Text style={styles.empty}>No candy logged yet. Tap &quot;Add treats&quot; to add some!</Text>
          ) : (
            candyLogs.slice(0, 30).map((c) => (
              <View key={c.id} style={styles.row}>
                {c.image_path && (
                  <Image
                    source={{ uri: getImageUri(c.image_path)! }}
                    style={styles.rowThumb}
                  />
                )}
                <Text style={styles.rowText}>
                  {c.candy_name} × {c.quantity}
                </Text>
                <Text style={styles.rowMeta}>
                  {new Date(c.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
          {candyLogs.length > 30 && (
            <Text style={styles.rowMeta}>+{candyLogs.length - 30} more</Text>
          )}

          <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
            My houses
          </Text>
          {houses.length === 0 ? (
            <Text style={styles.empty}>No houses yet. Tap &quot;Add treats&quot; to add some!</Text>
          ) : (
            houses.map((h) => (
              <View key={h.id} style={styles.row}>
                {h.image_path ? (
                  <Image
                    source={{ uri: getImageUri(h.image_path)! }}
                    style={styles.rowThumb}
                  />
                ) : (
                  <View style={[styles.rowThumb, { backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                    <FontAwesome name="home" size={20} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{h.name}</Text>
                  {h.notes ? (
                    <Text style={[styles.rowMeta, { marginTop: 2 }]}>{h.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
          <View style={{ height: theme.spacing.xl * 2 }} />
        </ScrollView>
      ) : (
        <>
          <View style={styles.addTabs}>
            <Pressable
              style={[styles.addTab, tab === 'candy' && styles.addTabActive]}
              onPress={() => setTab('candy')}
            >
              <FontAwesome
                name="gift"
                size={18}
                color={tab === 'candy' ? '#fff' : theme.colors.textMuted}
              />
              <Text style={[styles.addTabText, tab === 'candy' && styles.addTabTextActive]}>
                Candy
              </Text>
            </Pressable>
            <Pressable
              style={[styles.addTab, tab === 'house' && styles.addTabActive]}
              onPress={() => setTab('house')}
            >
              <FontAwesome
                name="home"
                size={18}
                color={tab === 'house' ? '#fff' : theme.colors.textMuted}
              />
              <Text style={[styles.addTabText, tab === 'house' && styles.addTabTextActive]}>
                House
              </Text>
            </Pressable>
          </View>

          <DismissKeyboardScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {tab === 'candy' ? (
              <>
                <Text style={styles.label}>Candy name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Snickers, Skittles"
                  placeholderTextColor={theme.colors.textMuted}
                  value={candyName}
                  onChangeText={setCandyName}
                />
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={theme.colors.textMuted}
                  value={candyQty}
                  onChangeText={setCandyQty}
                  keyboardType="number-pad"
                />
                <Text style={styles.label}>Photo (optional)</Text>
                <ImagePickerButton
                  value={candyImage}
                  onChange={setCandyImage}
                  onEdit
                />
                {activeSessionId && (
                  <Pressable
                    style={styles.checkRow}
                    onPress={() => setLinkToSession(!linkToSession)}
                  >
                    <FontAwesome
                      name={linkToSession ? 'check-square' : 'square-o'}
                      size={24}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.checkLabel}>Link to current session</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[
                    styles.submitBtn,
                    submittingCandy && styles.submitBtnDisabled,
                  ]}
                  onPress={submitCandy}
                  disabled={submittingCandy}
                >
                  <Text style={styles.submitBtnText}>
                    {submittingCandy ? 'Adding...' : 'Add candy'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.label}>House name or address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123 Main St, Spooky house"
                  placeholderTextColor={theme.colors.textMuted}
                  value={houseName}
                  onChangeText={setHouseName}
                />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Scary decorations, gave full-size bars..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={houseNotes}
                  onChangeText={setHouseNotes}
                  multiline
                />
                <Text style={styles.label}>Photo (optional)</Text>
                <ImagePickerButton
                  value={houseImage}
                  onChange={setHouseImage}
                  onEdit
                />
                <Pressable
                  style={[
                    styles.submitBtn,
                    submittingHouse && styles.submitBtnDisabled,
                  ]}
                  onPress={submitHouse}
                  disabled={submittingHouse}
                >
                  <Text style={styles.submitBtnText}>
                    {submittingHouse ? 'Adding...' : 'Add house'}
                  </Text>
                </Pressable>
              </>
            )}
          </DismissKeyboardScrollView>
        </>
      )}
    </View>
  );
}
