import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  setCandyFavorite,
  setHouseFavorite,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { CandyLog, House } from '@/types';
import { Image } from 'react-native';

type Mode = 'view' | 'addCandy' | 'addHouse';

export default function LogScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [mode, setMode] = useState<Mode>('view');
  const [candyExpanded, setCandyExpanded] = useState(true);
  const [housesExpanded, setHousesExpanded] = useState(true);
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
          backgroundColor: theme.colors.background,
        },
        modeTab: {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
        modeTabActive: {
          backgroundColor: theme.colors.primary,
          ...Platform.select({
            ios: {
              shadowOpacity: 0.15,
              shadowRadius: 6,
            },
            android: { elevation: 4 },
          }),
        },
        modeTabText: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: '500' },
        modeTabTextActive: { color: '#fff', fontWeight: '700' },
        scroll: { flex: 1 },
        scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        sectionHeaderPressable: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flex: 1,
        },
        sectionHeaderLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flex: 1,
        },
        chevron: { marginLeft: theme.spacing.sm },
        sectionTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '700',
          color: theme.colors.text,
        },
        sectionSubtitle: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: 2,
        },
        emptyCard: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl * 1.5,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.lg,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
            },
            android: { elevation: 1 },
          }),
        },
        emptyIcon: { marginBottom: theme.spacing.md, opacity: 0.5 },
        empty: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          textAlign: 'center',
          lineHeight: 22,
        },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.md,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
        cardPressed: { opacity: 0.95 },
        rowThumb: {
          width: 56,
          height: 56,
          borderRadius: theme.borderRadius.md,
          marginRight: theme.spacing.md,
        },
        rowThumbPlaceholder: {
          backgroundColor: `${theme.colors.primary}18`,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowThumbPlaceholderHouse: {
          backgroundColor: `${theme.colors.secondary}18`,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowContent: { flex: 1, minWidth: 0 },
        rowText: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text },
        rowMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2 },
        qtyBadge: {
          backgroundColor: theme.colors.primary,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 2,
          borderRadius: theme.borderRadius.sm,
        },
        qtyBadgeText: { fontSize: theme.fontSize.sm, fontWeight: '700', color: '#fff' },
        favoriteBtn: { padding: theme.spacing.sm },
        favoriteBtnPressed: { opacity: 0.7 },
        formCard: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.lg,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
        label: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        input: {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        textArea: { minHeight: 96, textAlignVertical: 'top' as const },
        checkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.lg,
        },
        checkLabel: { fontSize: theme.fontSize.md, color: theme.colors.text, flex: 1 },
        submitBtn: {
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          ...Platform.select({
            ios: {
              shadowColor: theme.colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            },
            android: { elevation: 3 },
          }),
        },
        submitBtnHouse: { backgroundColor: theme.colors.secondary },
        submitBtnDisabled: { opacity: 0.6 },
        submitBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
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
          style={({ pressed }) => [
            styles.modeTab,
            mode === 'view' && styles.modeTabActive,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => setMode('view')}
        >
          <FontAwesome
            name="list-ul"
            size={24}
            color={mode === 'view' ? '#fff' : theme.colors.primary}
          />
          <Text style={[styles.modeTabText, mode === 'view' && styles.modeTabTextActive]}>
            See my stash
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.modeTab,
            mode === 'addCandy' && styles.modeTabActive,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => setMode('addCandy')}
        >
          <FontAwesome
            name="gift"
            size={24}
            color={mode === 'addCandy' ? '#fff' : theme.colors.primary}
          />
          <Text style={[styles.modeTabText, mode === 'addCandy' && styles.modeTabTextActive]}>
            Add candy
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.modeTab,
            mode === 'addHouse' && styles.modeTabActive,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => setMode('addHouse')}
        >
          <FontAwesome
            name="home"
            size={24}
            color={mode === 'addHouse' ? '#fff' : theme.colors.secondary}
          />
          <Text style={[styles.modeTabText, mode === 'addHouse' && styles.modeTabTextActive]}>
            Add house
          </Text>
        </Pressable>
      </View>

      {mode === 'view' ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable
            style={({ pressed }) => [
              styles.sectionHeader,
              { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, marginBottom: 0 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setCandyExpanded((e) => !e)}
          >
            <View style={styles.sectionHeaderLeft}>
              <FontAwesome name="gift" size={28} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>My candy</Text>
                <Text style={styles.sectionSubtitle}>
                  {candyLogs.length} {candyLogs.length === 1 ? 'piece' : 'pieces'} logged
                </Text>
              </View>
            </View>
            <FontAwesome
              name={candyExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={theme.colors.textMuted}
              style={styles.chevron}
            />
          </Pressable>
          {candyExpanded && (
            <View style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          {candyLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <FontAwesome name="gift" size={48} color={theme.colors.primary} style={styles.emptyIcon} />
              <Text style={styles.empty}>No candy logged yet.{'\n'}Tap &quot;Add candy&quot; to add some!</Text>
            </View>
          ) : (
            <>
              {candyLogs.slice(0, 30).map((c) => {
                const isFavorite = Boolean(c.is_favorite);
                return (
                  <View key={c.id} style={styles.card}>
                    {c.image_path ? (
                      <Image
                        source={{ uri: getImageUri(c.image_path)! }}
                        style={styles.rowThumb}
                      />
                    ) : (
                      <View style={[styles.rowThumb, styles.rowThumbPlaceholder]}>
                        <FontAwesome name="gift" size={24} color={theme.colors.primary} />
                      </View>
                    )}
                    <View style={styles.rowContent}>
                      <Text style={styles.rowText}>{c.candy_name}</Text>
                      <Text style={styles.rowMeta}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.favoriteBtn,
                        pressed && styles.favoriteBtnPressed,
                      ]}
                      onPress={async () => {
                        await setCandyFavorite(db, c.id, !isFavorite);
                        loadData();
                      }}
                    >
                      <FontAwesome
                        name={isFavorite ? 'star' : 'star-o'}
                        size={24}
                        color={isFavorite ? theme.colors.warning : theme.colors.textMuted}
                      />
                    </Pressable>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>×{c.quantity}</Text>
                    </View>
                  </View>
                );
              })}
              {candyLogs.length > 30 && (
                <Text style={[styles.rowMeta, { marginBottom: theme.spacing.md }]}>
                  +{candyLogs.length - 30} more
                </Text>
              )}
            </>
          )}
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.sectionHeader,
              { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, marginTop: theme.spacing.xl, marginBottom: 0 },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setHousesExpanded((e) => !e)}
          >
            <View style={styles.sectionHeaderLeft}>
              <FontAwesome name="home" size={28} color={theme.colors.secondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>My houses</Text>
                <Text style={styles.sectionSubtitle}>
                  {houses.length} {houses.length === 1 ? 'house' : 'houses'} visited
                </Text>
              </View>
            </View>
            <FontAwesome
              name={housesExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={theme.colors.textMuted}
              style={styles.chevron}
            />
          </Pressable>
          {housesExpanded && (
            <View style={{ marginTop: theme.spacing.md }}>
          {houses.length === 0 ? (
            <View style={styles.emptyCard}>
              <FontAwesome name="home" size={48} color={theme.colors.secondary} style={styles.emptyIcon} />
              <Text style={styles.empty}>No houses yet.{'\n'}Tap &quot;Add house&quot; to add some!</Text>
            </View>
          ) : (
            houses.map((h) => {
              const isFavorite = Boolean(h.is_favorite);
              return (
                <View key={h.id} style={styles.card}>
                  {h.image_path ? (
                    <Image
                      source={{ uri: getImageUri(h.image_path)! }}
                      style={styles.rowThumb}
                    />
                  ) : (
                    <View style={[styles.rowThumb, styles.rowThumbPlaceholderHouse]}>
                      <FontAwesome name="home" size={24} color={theme.colors.secondary} />
                    </View>
                  )}
                  <View style={styles.rowContent}>
                    <Text style={styles.rowText}>{h.name}</Text>
                    {h.notes ? (
                      <Text style={styles.rowMeta}>{h.notes}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.favoriteBtn,
                      pressed && styles.favoriteBtnPressed,
                    ]}
                    onPress={async () => {
                      await setHouseFavorite(db, h.id, !isFavorite);
                      loadData();
                    }}
                  >
                    <FontAwesome
                      name={isFavorite ? 'star' : 'star-o'}
                      size={24}
                      color={isFavorite ? theme.colors.warning : theme.colors.textMuted}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
            </View>
          )}
          <View style={{ height: theme.spacing.xl * 2 }} />
        </ScrollView>
      ) : (
          <DismissKeyboardScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {mode === 'addCandy' ? (
              <View style={styles.formCard}>
                <View style={[styles.sectionHeader, { marginBottom: theme.spacing.lg }]}>
                  <FontAwesome name="gift" size={28} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>Add candy</Text>
                </View>
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
              </View>
            ) : (
              <View style={styles.formCard}>
                <View style={[styles.sectionHeader, { marginBottom: theme.spacing.lg }]}>
                  <FontAwesome name="home" size={28} color={theme.colors.secondary} />
                  <Text style={styles.sectionTitle}>Add house</Text>
                </View>
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
                    styles.submitBtnHouse,
                    submittingHouse && styles.submitBtnDisabled,
                  ]}
                  onPress={submitHouse}
                  disabled={submittingHouse}
                >
                  <Text style={styles.submitBtnText}>
                    {submittingHouse ? 'Adding...' : 'Add house'}
                  </Text>
                </Pressable>
              </View>
            )}
          </DismissKeyboardScrollView>
      )}
    </View>
  );
}
