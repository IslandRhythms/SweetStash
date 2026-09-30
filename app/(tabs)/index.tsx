import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AddCandyForm } from '@/components/AddCandyForm';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { KeyboardAwareOverlay } from '@/components/KeyboardAwareOverlay';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  completeStashRound,
  createCandy,
  createCandyLog,
  createStashRound,
  deleteZeroQuantityCandyLogsForStashRound,
  getActiveSession,
  getCandies,
  getCandyLogsForStashRound,
  getCurrentStashRound,
  getFirstProfile,
  getProfile,
  updateCandyLog,
} from '@/lib/db';
import { pickImageFromCamera, pickImageFromLibrary } from '@/components/ImagePicker';
import { getImageUri } from '@/lib/images';
import type { Candy, CandyLog } from '@/types';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'react-native';

export default function MyStashScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [candyExpanded, setCandyExpanded] = useState(true);
  const [ready, setReady] = useState(false);
  const [candies, setCandies] = useState<Candy[]>([]);
  const [candyLogs, setCandyLogs] = useState<CandyLog[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [currentStashRoundId, setCurrentStashRoundId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [savingRestart, setSavingRestart] = useState(false);

  // Save & restart modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [linkToCurrentSession, setLinkToCurrentSession] = useState(false);
  // What's logged this round (tap counter to open)
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingImageForGroup, setEditingImageForGroup] = useState<{ name: string; logs: CandyLog[] } | null>(null);
  const [editingImagePath, setEditingImagePath] = useState('');
  const [showAddCandyModal, setShowAddCandyModal] = useState(false);
  const [savingNewCandy, setSavingNewCandy] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

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
    const round = await getCurrentStashRound(db, profile.id);
    const roundId = round?.id ?? null;
    setCurrentStashRoundId(roundId);
    const logs =
      roundId != null
        ? await getCandyLogsForStashRound(db, profile.id, roundId)
        : [];
    setCandyLogs(logs);
  }, [profile, db]);

  useEffect(() => {
    getCandies(db).then(setCandies);
  }, [db]);

  useEffect(() => {
    if (profile) loadData();
  }, [profile, loadData]);

  const totalPieces = useMemo(
    () => candyLogs.reduce((sum, c) => sum + c.quantity, 0),
    [candyLogs]
  );

  type GroupedLog = { name: string; totalQty: number; logs: CandyLog[] };
  const groupedLogs = useMemo((): GroupedLog[] => {
    const byName = new Map<string, CandyLog[]>();
    for (const c of candyLogs) {
      const list = byName.get(c.candy_name) ?? [];
      list.push(c);
      byName.set(c.candy_name, list);
    }
    return Array.from(byName.entries())
      .map(([name, logs]) => ({
        name,
        totalQty: logs.reduce((s, l) => s + l.quantity, 0),
        logs,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [candyLogs]);

  async function addCandyPiece(candyName: string) {
    if (!profile) return;
    try {
      let stashRoundId = currentStashRoundId;
      if (stashRoundId == null) {
        stashRoundId = await createStashRound(db, profile.id);
        setCurrentStashRoundId(stashRoundId);
      }
      await createCandyLog(db, profile.id, candyName, 1, { stashRoundId });
      await loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Oops!', 'Couldn\'t add that piece.');
    }
  }

  function openSaveModal() {
    if (totalPieces === 0) return;
    setSaveName('');
    setLinkToCurrentSession(!!activeSessionId);
    setShowSaveModal(true);
  }

  async function confirmSaveAndRestart() {
    if (!profile || totalPieces === 0 || savingRestart || currentStashRoundId == null) return;
    setSavingRestart(true);
    try {
      await completeStashRound(db, currentStashRoundId, {
        name: saveName.trim() || null,
        linkedSessionId:
          linkToCurrentSession && activeSessionId ? activeSessionId : null,
      });
      const nextStashRoundId = await createStashRound(db, profile.id);
      setCurrentStashRoundId(nextStashRoundId);
      setShowSaveModal(false);
      setSaveName('');
      await loadData();
      Alert.alert(
        'Saved!',
        `${totalPieces} ${totalPieces === 1 ? 'piece' : 'pieces'} saved. Counter reset.`
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save.');
    } finally {
      setSavingRestart(false);
    }
  }

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const existingCategories = useMemo(
    () => Array.from(new Set(candies.map((c) => c.category))).sort(),
    [candies]
  );

  const otherCandiesByCategory = useMemo(() => {
    const rest = candies.filter((c) => c.is_common !== 1);
    const byCategory = new Map<string, Candy[]>();
    for (const c of rest) {
      const list = byCategory.get(c.category) ?? [];
      list.push(c);
      byCategory.set(c.category, list);
    }
    return Array.from(byCategory.entries()).sort((a, b) => a[1][0].sort_order - b[1][0].sort_order);
  }, [candies]);

  const filteredOtherCandiesByCategory = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return otherCandiesByCategory;
    return otherCandiesByCategory
      .map(([category, list]) => [
        category,
        list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q) ||
            category.toLowerCase().includes(q)
        ),
      ] as [string, Candy[]])
      .filter(([, list]) => list.length > 0);
  }, [otherCandiesByCategory, catalogSearch]);

  const catalogSearching = catalogSearch.trim().length > 0;

  useEffect(() => {
    if (!candyExpanded) setCatalogSearch('');
  }, [candyExpanded]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        center: { justifyContent: 'center', alignItems: 'center' },
        scroll: { flex: 1 },
        scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
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
        candyHero: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing.xl,
          marginBottom: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          borderWidth: 2,
          borderColor: `${theme.colors.primary}40`,
          borderStyle: 'dashed',
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
            android: { elevation: 4 },
          }),
        },
        candyHeroTapHint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xs,
        },
        candyHeroNumber: {
          fontSize: 56,
          fontWeight: '800',
          color: theme.colors.primaryText,
          lineHeight: 64,
        },
        candyHeroLabel: {
          fontSize: theme.fontSize.lg,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xs,
        },
        saveRestartBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.lg,
        },
        saveRestartBtnPressed: { opacity: 0.9 },
        saveRestartBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
          color: '#fff',
        },
        addNewCandyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          marginBottom: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 2,
          borderColor: theme.colors.primaryText,
        },
        addNewCandyBtnText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.primaryText,
        },
        tapLabel: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        catalogSearchInput: {
          backgroundColor: theme.colors.surface,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        catalogSearchEmpty: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.md,
        },
        candyChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        candyChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.primary,
          minHeight: theme.minTouchTarget,
          justifyContent: 'center',
        },
        candyChipPressed: { opacity: 0.85 },
        candyChipText: { fontSize: theme.fontSize.md, fontWeight: '700', color: '#fff' },
        candyChipEmoji: { fontSize: theme.fontSize.lg },
        categoryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.xs,
        },
        categoryRowPressed: { opacity: 0.9 },
        categoryRowText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
        },
        categoryExpandWrap: {
          marginBottom: theme.spacing.lg,
          paddingLeft: theme.spacing.sm,
        },
        addCandyChipsScroll: {
          maxHeight: Dimensions.get('window').height * 0.35,
        },
        addCandyChipsScrollContent: {
          paddingBottom: theme.spacing.sm,
        },
        candyThumbSmall: {
          width: 28,
          height: 28,
          borderRadius: theme.borderRadius.sm,
        },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.md,
        },
        rowThumb: {
          width: 56,
          height: 56,
          borderRadius: theme.borderRadius.md,
          marginRight: theme.spacing.md,
        },
        rowThumbPlaceholderHouse: {
          backgroundColor: `${theme.colors.secondary}18`,
          justifyContent: 'center',
          alignItems: 'center',
        },
        rowContent: { flex: 1, minWidth: 0 },
        rowText: { fontSize: theme.fontSize.lg, fontWeight: '600', color: theme.colors.text },
        rowMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2 },
        favoriteBtn: { padding: theme.spacing.sm },
        favoriteBtnPressed: { opacity: 0.7 },
        housePhotoCta: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.lg,
          minHeight: theme.minTouchTarget * 1.5,
        },
        housePhotoCtaPressed: { opacity: 0.9 },
        housePhotoCtaText: { fontSize: theme.fontSize.lg, fontWeight: '700', color: '#fff' },
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
          maxWidth: 400,
        },
        modalContentSmall: {
          flexGrow: 0,
          zIndex: 1,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
          width: '100%',
          maxWidth: 300,
        },
        modalContentTiny: {
          maxWidth: 300,
          padding: theme.spacing.md,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        saveModalScrollContent: {
          flexGrow: 0,
        },
        saveModalTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
          color: theme.colors.primaryText,
          marginBottom: theme.spacing.sm,
          textAlign: 'center',
        },
        saveModalLabel: {
          fontSize: theme.fontSize.sm,
          fontWeight: '600',
          color: theme.colors.textMuted,
          marginBottom: 4,
        },
        saveModalInput: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          fontSize: theme.fontSize.sm,
          color: theme.colors.text,
          borderRadius: theme.borderRadius.lg,
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
        saveModalCheckWrap: {
          marginTop: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        saveModalCheckRow: {
          marginTop: 0,
          marginBottom: 0,
        },
        saveModalRow: {
          marginTop: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
        saveModalBtn: {
          paddingVertical: 10,
          borderRadius: theme.borderRadius.lg,
          justifyContent: 'center',
          alignItems: 'center',
        },
        saveModalBtnSecondary: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.border,
        },
        saveModalBtnPrimary: {
          backgroundColor: theme.colors.primary,
        },
        modalContentScroll: {
          maxHeight: '65%',
        },
        modalTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.lg,
        },
        modalTitleSmall: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        logRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        logRowLast: { borderBottomWidth: 0 },
        logRowImageWrap: { marginRight: theme.spacing.sm, padding: 2 },
        logRowThumb: { width: 36, height: 36, borderRadius: 8 },
        logRowThumbPlaceholder: {
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        },
        logRowNameWrap: { flex: 1, minWidth: 0, paddingVertical: theme.spacing.xs },
        logRowName: { fontSize: theme.fontSize.md, color: theme.colors.text },
        logRowInput: {
          flex: 1,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        logRowQtyWrap: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          marginLeft: theme.spacing.sm,
        },
        logRowQtyBtn: {
          padding: theme.spacing.xs,
          minWidth: theme.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        },
        logRowQty: {
          fontSize: theme.fontSize.sm,
          fontWeight: '600',
          color: theme.colors.primaryText,
          minWidth: 28,
          textAlign: 'center',
        },
        logEmpty: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          paddingVertical: theme.spacing.md,
          textAlign: 'center',
        },
        checkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.md,
        },
        checkLabel: {
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          flex: 1,
        },
        label: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        input: {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        textArea: { minHeight: 72, textAlignVertical: 'top' as const },
        modalRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
        modalBtn: {
          flex: 1,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          alignItems: 'center',
        },
        modalBtnPrimary: { backgroundColor: theme.colors.primary },
        modalBtnSecondary: { backgroundColor: theme.colors.border },
        modalBtnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
        modalBtnTextPrimary: { color: '#fff' },
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Candy counter */}
        <Pressable
          style={({ pressed }) => [
            styles.sectionHeader,
            { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.borderRadius.lg },
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setCandyExpanded((e) => !e)}
        >
          <View style={styles.sectionHeaderLeft}>
            <FontAwesome name="gift" size={28} color={theme.colors.primaryText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Candy counter</Text>
              <Text style={styles.sectionSubtitle}>Tap what you got!</Text>
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
          <View style={{ marginBottom: theme.spacing.xl }}>
            <Pressable
              style={({ pressed }) => [styles.candyHero, pressed && { opacity: 0.9 }]}
              onPress={() => setShowLogModal(true)}
            >
              <Text style={styles.candyHeroNumber}>{totalPieces}</Text>
              <Text style={styles.candyHeroLabel}>
                {totalPieces === 1 ? 'piece' : 'pieces'} this round
              </Text>
              <Text style={styles.candyHeroTapHint}>Tap to view</Text>
            </Pressable>
            {totalPieces > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.saveRestartBtn,
                  pressed && styles.saveRestartBtnPressed,
                ]}
                onPress={openSaveModal}
              >
                <FontAwesome name="check" size={22} color="#fff" />
                <Text style={styles.saveRestartBtnText}>Save & restart</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.addNewCandyBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setShowAddCandyModal(true)}
            >
              <FontAwesome name="plus-circle" size={18} color={theme.colors.primaryText} />
              <Text style={styles.addNewCandyBtnText}>Add new candy to catalog</Text>
            </Pressable>

            {otherCandiesByCategory.length > 0 && (
              <>
                <Text style={[styles.tapLabel, { marginTop: theme.spacing.md }]}>Add candy</Text>
                <TextInput
                  style={styles.catalogSearchInput}
                  placeholder="Search candy or category"
                  placeholderTextColor={theme.colors.textMuted}
                  value={catalogSearch}
                  onChangeText={setCatalogSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  accessibilityLabel="Search candy catalog"
                  clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                />
                {catalogSearching && filteredOtherCandiesByCategory.length === 0 ? (
                  <Text style={styles.catalogSearchEmpty}>No candies match your search.</Text>
                ) : null}
                {filteredOtherCandiesByCategory.map(([category, list]) => {
                  const isExpanded = catalogSearching || expandedCategories.has(category);
                  return (
                    <View key={category}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.categoryRow,
                          pressed && styles.categoryRowPressed,
                        ]}
                        onPress={() => toggleCategory(category)}
                      >
                        <Text style={styles.categoryRowText}>{category}</Text>
                        <FontAwesome
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.colors.textMuted}
                        />
                      </Pressable>
                      {isExpanded && (
                        <View style={styles.categoryExpandWrap}>
                          <ScrollView
                            style={styles.addCandyChipsScroll}
                            contentContainerStyle={styles.addCandyChipsScrollContent}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled
                          >
                            <View style={styles.candyChips}>
                              {list.map((candy) => (
                                <Pressable
                                  key={candy.id}
                                  style={({ pressed }) => [styles.candyChip, pressed && styles.candyChipPressed]}
                                  onPress={() => addCandyPiece(candy.name)}
                                >
                                  {candy.image_path ? (
                                    <Image
                                      source={{ uri: getImageUri(candy.image_path)! }}
                                      style={styles.candyThumbSmall}
                                    />
                                  ) : candy.emoji ? (
                                    <Text style={styles.candyChipEmoji}>{candy.emoji}</Text>
                                  ) : null}
                                  <Text style={styles.candyChipText} numberOfLines={1}>
                                    {candy.name}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        <View style={{ height: theme.spacing.xl * 2 }} />
      </ScrollView>

      <Modal
        visible={showLogModal}
        transparent
        animationType="fade"
        onRequestClose={async () => {
          if (currentStashRoundId != null) {
            await deleteZeroQuantityCandyLogsForStashRound(db, currentStashRoundId);
            await loadData();
          }
          setShowLogModal(false);
          setEditingGroupName(null);
          setEditingName('');
        }}
      >
        <KeyboardAwareOverlay style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={async () => {
              if (currentStashRoundId != null) {
                await deleteZeroQuantityCandyLogsForStashRound(db, currentStashRoundId);
                await loadData();
              }
              setShowLogModal(false);
              setEditingGroupName(null);
              setEditingName('');
            }}
          />
          <DismissKeyboardScrollView
            style={[styles.modalContentSmall, styles.modalContentScroll]}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitleSmall}>Logged this round</Text>
            {groupedLogs.length === 0 ? (
              <Text style={styles.logEmpty}>Nothing logged yet.</Text>
            ) : (
              <>
            <Text style={[styles.logEmpty, { marginBottom: theme.spacing.sm }]}>
              Tap name to edit; tap 🖼 to set image; − / + for quantity.
            </Text>
              {groupedLogs.map((group, i) => {
                const firstImage = group.logs.find((l) => l.image_path)?.image_path ?? group.logs[0]?.image_path ?? null;
                return (
                <View
                  key={group.name}
                  style={[
                    styles.logRow,
                    i === groupedLogs.length - 1 && styles.logRowLast,
                  ]}
                >
                  <Pressable
                    style={styles.logRowImageWrap}
                    onPress={() => {
                      setEditingImageForGroup({ name: group.name, logs: group.logs });
                      setEditingImagePath(firstImage ?? '');
                    }}
                  >
                    {firstImage ? (
                      <Image source={{ uri: getImageUri(firstImage)! }} style={styles.logRowThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.logRowThumb, styles.logRowThumbPlaceholder]}>
                        <FontAwesome name="picture-o" size={14} color={theme.colors.textMuted} />
                      </View>
                    )}
                  </Pressable>
                  {editingGroupName === group.name ? (
                    <TextInput
                      style={styles.logRowInput}
                      value={editingName}
                      onChangeText={setEditingName}
                      placeholder="Candy name"
                      placeholderTextColor={theme.colors.textMuted}
                      autoFocus
                      onBlur={async () => {
                        const name = editingName.trim();
                        if (name && name !== group.name) {
                          for (const log of group.logs) {
                            await updateCandyLog(db, log.id, { candy_name: name });
                          }
                          await loadData();
                        }
                        setEditingGroupName(null);
                      }}
                      onSubmitEditing={async () => {
                        const name = editingName.trim();
                        if (name && name !== group.name) {
                          for (const log of group.logs) {
                            await updateCandyLog(db, log.id, { candy_name: name });
                          }
                          await loadData();
                        }
                        setEditingGroupName(null);
                      }}
                    />
                  ) : (
                    <Pressable
                      style={styles.logRowNameWrap}
                      onPress={() => {
                        setEditingGroupName(group.name);
                        setEditingName(group.name);
                      }}
                    >
                      <Text style={styles.logRowName} numberOfLines={1}>
                        {group.name}
                      </Text>
                    </Pressable>
                  )}
                  <View style={styles.logRowQtyWrap}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.logRowQtyBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={async () => {
                        if (group.totalQty <= 1) {
                          await updateCandyLog(db, group.logs[0].id, { quantity: 0 });
                        } else {
                          const first = group.logs[0];
                          await updateCandyLog(db, first.id, {
                            quantity: Math.max(0, first.quantity - 1),
                          });
                        }
                        await loadData();
                      }}
                    >
                      <FontAwesome name="minus" size={14} color={theme.colors.primaryText} />
                    </Pressable>
                    <Text style={styles.logRowQty}>×{group.totalQty}</Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.logRowQtyBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={async () => {
                        if (!profile) return;
                        let stashRoundId = currentStashRoundId;
                        if (stashRoundId == null) {
                          stashRoundId = await createStashRound(db, profile.id);
                          setCurrentStashRoundId(stashRoundId);
                        }
                        await createCandyLog(db, profile.id, group.name, 1, { stashRoundId });
                        await loadData();
                      }}
                    >
                      <FontAwesome name="plus" size={14} color={theme.colors.primaryText} />
                    </Pressable>
                  </View>
                </View>
              );
              })}
              </>
            )}
          </DismissKeyboardScrollView>
        </KeyboardAwareOverlay>
      </Modal>

      <Modal
        visible={editingImageForGroup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingImageForGroup(null)}
      >
        <KeyboardAwareOverlay style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingImageForGroup(null)} />
          <DismissKeyboardScrollView
            style={[styles.modalContentSmall, { maxWidth: 280 }]}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitleSmall}>
              Image for {editingImageForGroup?.name ?? ''}
            </Text>
            <Text style={[styles.saveModalLabel, { marginBottom: 4 }]}>Image (from your device)</Text>
            {editingImagePath && getImageUri(editingImagePath) ? (
              <Image
                source={{ uri: getImageUri(editingImagePath)! }}
                style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.border }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' }}>
                <FontAwesome name="picture-o" size={32} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <Pressable
                style={({ pressed }) => [styles.saveModalCheckWrap, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }, pressed && { opacity: 0.8 }]}
                onPress={async () => {
                  const path = await pickImageFromCamera();
                  if (path) setEditingImagePath(path);
                }}
              >
                <FontAwesome name="camera" size={18} color={theme.colors.primaryText} />
                <Text style={styles.checkLabel}>Take photo</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.saveModalCheckWrap, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }, pressed && { opacity: 0.8 }]}
                onPress={async () => {
                  const path = await pickImageFromLibrary();
                  if (path) setEditingImagePath(path);
                }}
              >
                <FontAwesome name="photo" size={18} color={theme.colors.primaryText} />
                <Text style={styles.checkLabel}>Gallery</Text>
              </Pressable>
            </View>
            <View style={[styles.modalRow, styles.saveModalRow]}>
              <Pressable
                style={[styles.modalBtn, styles.saveModalBtn, styles.saveModalBtnSecondary]}
                onPress={() => setEditingImageForGroup(null)}
              >
                <Text style={[styles.modalBtnText, { color: theme.colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.saveModalBtn, styles.saveModalBtnPrimary]}
                onPress={async () => {
                  if (!editingImageForGroup) return;
                  const path = editingImagePath.trim() || null;
                  for (const log of editingImageForGroup.logs) {
                    await updateCandyLog(db, log.id, { image_path: path });
                  }
                  await loadData();
                  setEditingImageForGroup(null);
                }}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Save</Text>
              </Pressable>
            </View>
          </DismissKeyboardScrollView>
        </KeyboardAwareOverlay>
      </Modal>

      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <KeyboardAwareOverlay style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSaveModal(false)} />
          <DismissKeyboardScrollView
            style={[styles.modalContentSmall, styles.modalContentTiny]}
            contentContainerStyle={styles.saveModalScrollContent}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.saveModalTitle}>Name this save</Text>
            <Text style={styles.saveModalLabel}>Name (optional)</Text>
            <TextInput
              style={styles.saveModalInput}
              placeholder="e.g. Halloween round 1"
              placeholderTextColor={theme.colors.textMuted}
              value={saveName}
              onChangeText={setSaveName}
            />
            {activeSessionId ? (
              <Pressable
                style={[styles.saveModalCheckWrap, styles.checkRow, styles.saveModalCheckRow]}
                onPress={() => setLinkToCurrentSession((v) => !v)}
              >
                <FontAwesome
                  name={linkToCurrentSession ? 'check-square' : 'square-o'}
                  size={20}
                  color={theme.colors.primaryText}
                />
                <Text style={[styles.checkLabel, { fontSize: theme.fontSize.sm }]}>
                  Link to current trick-or-treat session
                </Text>
              </Pressable>
            ) : null}
            <View style={[styles.modalRow, styles.saveModalRow]}>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.saveModalBtn,
                  styles.saveModalBtnSecondary,
                ]}
                onPress={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                }}
              >
                <Text style={[styles.modalBtnText, { fontSize: theme.fontSize.sm, color: theme.colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.saveModalBtn,
                  styles.saveModalBtnPrimary,
                  savingRestart && { opacity: 0.6 },
                ]}
                onPress={confirmSaveAndRestart}
                disabled={savingRestart}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary, { fontSize: theme.fontSize.sm }]}>
                  {savingRestart ? 'Saving...' : 'Save & restart'}
                </Text>
              </Pressable>
            </View>
          </DismissKeyboardScrollView>
        </KeyboardAwareOverlay>
      </Modal>

      <Modal
        visible={showAddCandyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCandyModal(false)}
      >
        <KeyboardAwareOverlay style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddCandyModal(false)} />
          <DismissKeyboardScrollView
            style={[styles.modalContentSmall, { maxWidth: 400, maxHeight: '85%' }]}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >
            <AddCandyForm
              existingCategories={existingCategories}
              saveLabel="Save"
              saving={savingNewCandy}
              onCancel={() => setShowAddCandyModal(false)}
              onSave={async (data) => {
                setSavingNewCandy(true);
                try {
                  await createCandy(db, {
                    name: data.name,
                    category: data.category,
                    emoji: data.emoji ?? null,
                    image_path: data.image_path ?? null,
                  });
                  const list = await getCandies(db);
                  setCandies(list);
                  setExpandedCategories((prev) => new Set([...prev, data.category]));
                  setShowAddCandyModal(false);
                } catch (e) {
                  console.error(e);
                  Alert.alert('Error', 'Could not add candy.');
                } finally {
                  setSavingNewCandy(false);
                }
              }}
            />
          </DismissKeyboardScrollView>
        </KeyboardAwareOverlay>
      </Modal>
    </View>
  );
}
