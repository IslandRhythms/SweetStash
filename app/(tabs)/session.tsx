import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { AddCandyForm } from '@/components/AddCandyForm';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { pickImageFromCamera, pickImageFromLibrary } from '@/components/ImagePicker';
import { SessionMap } from '@/components/SessionMap';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addHouseVisit,
  addLocationPoint,
  createCandy,
  createCandyLog,
  createCostume,
  createHouse,
  createSession,
  endSession,
  getActiveSession,
  getCandies,
  getCostumes,
  getFirstProfile,
  getCandyLogs,
  getHouseVisits,
  getHouses,
  getLocationPoints,
  getProfile,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { Candy, LocationPoint, Session } from '@/types';
import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [costumes, setCostumes] = useState<{ id: number; name: string }[]>([]);
  const [houses, setHouses] = useState<{ id: number; name: string; latitude: number | null; longitude: number | null }[]>([]);
  const [visitedHouseIds, setVisitedHouseIds] = useState<Set<number>>(new Set());
  const [selectedCostumeId, setSelectedCostumeId] = useState<number | null>(null);
  const [newCostumeName, setNewCostumeName] = useState('');
  const [addingCostume, setAddingCostume] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showCandyModal, setShowCandyModal] = useState(false);
  const [showHouseModal, setShowHouseModal] = useState(false);
  const [candyHouseId, setCandyHouseId] = useState<number | null>(null);
  const [houseName, setHouseName] = useState('');
  const [houseNotes, setHouseNotes] = useState('');
  const [houseImage, setHouseImage] = useState<string | null>(null);
  const [addingHousePhoto, setAddingHousePhoto] = useState(false);
  const [submittingHouse, setSubmittingHouse] = useState(false);
  /** Add-house flow: photo → name/notes → candy → then create house + add to map */
  const [pendingHouse, setPendingHouse] = useState<{ imagePath: string; name: string; notes: string } | null>(null);
  const [pendingCandy, setPendingCandy] = useState<{ candyName: string; quantity: number }[]>([]);
  const [sessionCandyCount, setSessionCandyCount] = useState(0);
  const [candies, setCandies] = useState<Candy[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const subRef = useRef<{ remove: () => void } | null>(null);
  /** Separate modal for adding new candy to catalog (avoids nested form inside candy modal) */
  const [showAddCandyModal, setShowAddCandyModal] = useState(false);
  const [savingNewCandy, setSavingNewCandy] = useState(false);

  useEffect(() => {
    getCandies(db).then(setCandies);
  }, [db]);

  const existingCategories = useMemo(
    () => Array.from(new Set(candies.map((c) => c.category))).sort(),
    [candies]
  );

  const candiesByCategory = useMemo(() => {
    const byCategory = new Map<string, Candy[]>();
    for (const c of candies) {
      const list = byCategory.get(c.category) ?? [];
      list.push(c);
      byCategory.set(c.category, list);
    }
    return Array.from(byCategory.entries()).sort(
      (a, b) => (a[1][0]?.sort_order ?? 0) - (b[1][0]?.sort_order ?? 0)
    );
  }, [candies]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  useEffect(() => {
    loadStoredProfile({
      getProfile: (id) => getProfile(db, id),
      getDefaultProfile: () => getFirstProfile(db),
    }).then(() => setReady(true));
  }, [db]);

  useEffect(() => {
    if (profile) {
      getActiveSession(db, profile.id).then((s) => {
        setSession(s ?? null);
        if (s) {
          getLocationPoints(db, s.id).then(setPoints);
          getHouseVisits(db, s.id).then((visits) =>
            setVisitedHouseIds(new Set(visits.map((v) => v.house_id)))
          );
          getCandyLogs(db, profile.id, s.id).then((logs) =>
            setSessionCandyCount(logs.reduce((sum, l) => sum + l.quantity, 0))
          );
          getCostumes(db, profile.id).then((c) =>
            setCostumes(c.map((x) => ({ id: x.id, name: x.name })))
          );
          getHouses(db, profile.id).then((h) =>
            setHouses(h.map((x) => ({ id: x.id, name: x.name, latitude: x.latitude, longitude: x.longitude })))
          );
        } else {
          getCostumes(db, profile.id).then((c) =>
            setCostumes(c.map((x) => ({ id: x.id, name: x.name })))
          );
          getHouses(db, profile.id).then((h) =>
            setHouses(h.map((x) => ({ id: x.id, name: x.name, latitude: x.latitude, longitude: x.longitude })))
          );
        }
      });
    }
  }, [profile, db]);

  useEffect(() => {
    if (!session) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Allow location to track your trick-or-treat route.'
        );
        return;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 15000,
        },
        async (loc) => {
          await addLocationPoint(
            db,
            session.id,
            loc.coords.latitude,
            loc.coords.longitude
          );
          const updated = await getLocationPoints(db, session.id);
          setPoints(updated);
        }
      );
      subRef.current = sub;
    })();

    return () => {
      subRef.current?.remove();
    };
  }, [session?.id, db]);

  async function startSession() {
    if (!profile) return;
    setStarting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location needed',
          'Allow location to track your trick-or-treat route.'
        );
        setStarting(false);
        return;
      }
      const id = await createSession(db, profile.id, selectedCostumeId, {
        sessionType: 'trick_or_treat',
      });
      const s = await db.getFirstAsync<Session>(
        'SELECT * FROM sessions WHERE id = ?',
        id
      );
      if (s) setSession(s);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not start session.');
    } finally {
      setStarting(false);
    }
  }

  async function addCandyFromPicker(candyName: string) {
    if (!session || !profile) return;
    try {
      await createCandyLog(db, profile.id, candyName, 1, {
        sessionId: session.id,
        houseId: candyHouseId,
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add candy.');
    }
  }

  function startAddHouseWithPhoto() {
    Alert.alert(
      'Add a house',
      'Take a photo of the house or choose one from your gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take photo',
          onPress: async () => {
            setAddingHousePhoto(true);
            const path = await pickImageFromCamera();
            setAddingHousePhoto(false);
            if (path) {
              setHouseImage(path);
              setHouseName('');
              setHouseNotes('');
              setPendingHouse({ imagePath: path, name: '', notes: '' });
              setPendingCandy([]);
              setShowHouseModal(true);
            }
          },
        },
        {
          text: 'From gallery',
          onPress: async () => {
            setAddingHousePhoto(true);
            const path = await pickImageFromLibrary();
            setAddingHousePhoto(false);
            if (path) {
              setHouseImage(path);
              setHouseName('');
              setHouseNotes('');
              setPendingHouse({ imagePath: path, name: '', notes: '' });
              setPendingCandy([]);
              setShowHouseModal(true);
            }
          },
        },
      ]
    );
  }

  const addFlowActive = pendingHouse !== null;

  function addPendingCandy(candyName: string) {
    setPendingCandy((prev) => {
      const i = prev.findIndex((p) => p.candyName === candyName);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { candyName, quantity: 1 }];
    });
  }

  async function completeAddHouseFlow() {
    if (!session || !profile || !pendingHouse) return;
    const name = pendingHouse.name.trim();
    if (!name) {
      Alert.alert('Oops!', 'Give this house a name or address.');
      return;
    }
    setSubmittingHouse(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (points.length > 0) {
        lat = points[points.length - 1].latitude;
        lng = points[points.length - 1].longitude;
      } else {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {
          // leave null
        }
      }
      const houseId = await createHouse(db, profile.id, name, {
        notes: pendingHouse.notes.trim() || null,
        image_path: pendingHouse.imagePath,
        latitude: lat,
        longitude: lng,
      });
      const id = Number(houseId);
      await addHouseVisit(db, session.id, id);
      for (const p of pendingCandy) {
        if (p.quantity > 0) {
          await createCandyLog(db, profile.id, p.candyName, p.quantity, {
            sessionId: session.id,
            houseId: id,
          });
        }
      }
      setHouses((prev) => [...prev, { id, name, latitude: lat, longitude: lng }]);
      setVisitedHouseIds((prev) => new Set([...prev, id]));
      setPendingHouse(null);
      setPendingCandy([]);
      setHouseName('');
      setHouseNotes('');
      setHouseImage(null);
      setShowCandyModal(false);
      setShowHouseModal(false);
      getCandyLogs(db, profile.id, session.id).then((logs) =>
        setSessionCandyCount(logs.reduce((sum, l) => sum + l.quantity, 0))
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add house.');
    } finally {
      setSubmittingHouse(false);
    }
  }

  async function handleEndSession() {
    if (!session) return;
    Alert.alert(
      'End session?',
      'Your route and haul will be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          onPress: async () => {
            setEnding(true);
            try {
              subRef.current?.remove();
              await endSession(db, session.id);
              router.replace(`/session/summary/${session.id}`);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Could not end session.');
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 },
        center: { justifyContent: 'center', alignItems: 'center' },
        title: {
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
        label: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        costumeList: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xl,
        },
        costumeChip: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.border,
        },
        costumeChipActive: { backgroundColor: theme.colors.primary },
        costumeChipText: { fontSize: theme.fontSize.md, color: theme.colors.text },
        costumeChipTextActive: { color: '#fff', fontWeight: '600' },
        startBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.md,
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.xl,
          borderRadius: theme.borderRadius.lg,
        },
        startBtnDisabled: { opacity: 0.7 },
        startBtnText: {
          fontSize: theme.fontSize.xl,
          fontWeight: '600',
          color: '#fff',
        },
        mapWrap: {
          height: 300,
          marginBottom: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        },
        mapFull: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        mapShrink: {
          height: 260,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          overflow: 'hidden',
        },
        map: { flex: 1 },
        sessionOverlay: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.xs,
        },
        sessionStatus: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
        },
        endSessionBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          backgroundColor: theme.colors.secondary,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
        },
        endSessionBtnText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: '#fff' },
        sessionSummaryCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
        },
        sessionSummaryTitle: {
          fontSize: theme.fontSize.md,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        sessionSummaryLine: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xs,
        },
        sessionSummaryHouses: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.xs,
        },
        addHouseBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.primary,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
          paddingVertical: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        },
        actions: { paddingVertical: theme.spacing.md },
        status: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.md,
        },
        houseVisits: { marginBottom: theme.spacing.md },
        houseVisitsLabel: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xs,
        },
        houseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
        houseChip: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.md,
        },
        houseChipPressed: { opacity: 0.8 },
        houseChipText: { fontSize: theme.fontSize.sm, color: '#fff' },
        row: { flexDirection: 'row', gap: theme.spacing.md },
        btn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        },
        btnEnd: { backgroundColor: theme.colors.secondary, marginTop: theme.spacing.sm },
        btnPressed: { opacity: 0.9 },
        btnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: '#fff' },
        categoryRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xs,
        },
        categoryRowText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
        candyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
        candyChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.primary,
          minHeight: 36,
          justifyContent: 'center',
        },
        candyChipPressed: { opacity: 0.85 },
        candyChipText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: '#fff' },
        candyChipEmoji: { fontSize: theme.fontSize.md },
        candyThumbSmall: { width: 24, height: 24, borderRadius: theme.borderRadius.sm },
        modalCandyScroll: { maxHeight: 280 },
        addNewCandyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 2,
        },
        addNewCandyBtnText: { fontSize: theme.fontSize.md, fontWeight: '600' },
        addCostumeRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          marginBottom: theme.spacing.xl,
        },
        costumeInput: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
        },
        addCostumeBtn: {
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.md,
        },
        addCostumeBtnDisabled: { opacity: 0.5 },
        addCostumeBtnText: {
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
          maxWidth: 400,
          maxHeight: '80%',
        },
        modalTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: theme.spacing.lg,
        },
        modalLabel: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        modalInput: {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        modalTextArea: { minHeight: 60, textAlignVertical: 'top' as const },
        houseModalImage: {
          width: '100%',
          height: 160,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          backgroundColor: theme.colors.border,
        },
        modalRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
        modalBtn: {
          flex: 1,
          padding: theme.spacing.lg,
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (session) {
    const coords = points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    const visitedHouses = houses.filter((h) => visitedHouseIds.has(h.id));
    const housesWithCoords = houses.filter(
      (h): h is { id: number; name: string; latitude: number; longitude: number } =>
        h.latitude != null && h.longitude != null
    );

    return (
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sessionOverlay}>
            <Text style={styles.sessionStatus}>
              Tracking route · {points.length} point{points.length !== 1 ? 's' : ''}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.endSessionBtn, pressed && styles.btnPressed]}
              onPress={handleEndSession}
              disabled={ending}
            >
              <FontAwesome name="stop" size={18} color="#fff" />
              <Text style={styles.endSessionBtnText}>{ending ? 'Ending...' : 'End session'}</Text>
            </Pressable>
          </View>

          <View style={styles.mapShrink}>
            <SessionMap
              coordinates={coords}
              houses={housesWithCoords.map((h) => ({ id: h.id, name: h.name, latitude: h.latitude, longitude: h.longitude }))}
              showCurrentLocation
              style={styles.map}
            />
          </View>

          <View style={styles.sessionSummaryCard}>
            <Text style={styles.sessionSummaryTitle}>Session so far</Text>
            <Text style={styles.sessionSummaryLine}>
              {points.length} route point{points.length !== 1 ? 's' : ''} (GPS breadcrumb trail)
            </Text>
            <Text style={styles.sessionSummaryLine}>
              {sessionCandyCount} piece{sessionCandyCount !== 1 ? 's' : ''} of candy
            </Text>
            {visitedHouses.length > 0 && (
              <Text style={styles.sessionSummaryHouses}>
                Houses: {visitedHouses.map((h) => h.name).join(', ')}
              </Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addHouseBtn,
              (addingHousePhoto || pressed) && { opacity: 0.85 },
            ]}
            onPress={startAddHouseWithPhoto}
            disabled={addingHousePhoto}
          >
            <FontAwesome name="plus" size={22} color="#fff" />
            <Text style={styles.btnText}>{addingHousePhoto ? 'Loading...' : 'Add house'}</Text>
          </Pressable>
        </ScrollView>

        <Modal
          visible={showCandyModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (addFlowActive) {
              setPendingHouse(null);
              setPendingCandy([]);
            }
            setShowAddCandyModal(false);
            setShowCandyModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (addFlowActive) {
                  setPendingHouse(null);
                  setPendingCandy([]);
                }
                setShowAddCandyModal(false);
                setShowCandyModal(false);
              }}
            />
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>
                {addFlowActive ? `Candy from ${pendingHouse?.name ?? 'this house'}` : 'Log candy'}
              </Text>
              {addFlowActive && pendingCandy.length > 0 && (
                <View style={[styles.houseChips, { marginBottom: theme.spacing.md }]}>
                  <Text style={[styles.modalLabel, { marginRight: theme.spacing.sm }]}>Added: </Text>
                  {pendingCandy.map((p) => (
                    <View key={p.candyName} style={styles.houseChip}>
                      <Text style={styles.houseChipText}>
                        {p.quantity}× {p.candyName}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {!addFlowActive && (
                <>
                  <Text style={styles.modalLabel}>From which house?</Text>
                  <View style={styles.houseChips}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.houseChip,
                        candyHouseId === null && { backgroundColor: theme.colors.primary },
                        pressed && styles.houseChipPressed,
                      ]}
                      onPress={() => setCandyHouseId(null)}
                    >
                      <Text style={[styles.houseChipText, candyHouseId === null && { color: '#fff' }]}>
                        Other
                      </Text>
                    </Pressable>
                    {visitedHouses.map((h) => (
                      <Pressable
                        key={h.id}
                        style={({ pressed }) => [
                          styles.houseChip,
                          candyHouseId === h.id && { backgroundColor: theme.colors.primary },
                          pressed && styles.houseChipPressed,
                        ]}
                        onPress={() => setCandyHouseId(candyHouseId === h.id ? null : h.id)}
                      >
                        <Text style={[styles.houseChipText, candyHouseId === h.id && { color: '#fff' }]}>
                          {h.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.addNewCandyBtn,
                  { borderColor: theme.colors.primary, marginBottom: theme.spacing.md },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  setShowCandyModal(false);
                  setShowAddCandyModal(true);
                }}
              >
                <FontAwesome name="plus-circle" size={18} color={theme.colors.primary} />
                <Text style={[styles.addNewCandyBtnText, { color: theme.colors.primary }]}>
                  Add new candy to catalog
                </Text>
              </Pressable>

              <Text style={[styles.modalLabel, { marginTop: theme.spacing.sm }]}>Tap candy to add</Text>
              <ScrollView style={styles.modalCandyScroll} showsVerticalScrollIndicator>
                {candiesByCategory.length === 0 ? (
                  <Text style={[styles.status, { marginTop: theme.spacing.sm }]}>
                    No candies in catalog yet. Add one above or in Settings.
                  </Text>
                ) : (
                candiesByCategory.map(([category, list]) => {
                  const isExpanded = expandedCategories.has(category);
                  return (
                    <View key={category}>
                      <Pressable
                        style={styles.categoryRow}
                        onPress={() => toggleCategory(category)}
                      >
                        <Text style={styles.categoryRowText}>{category}</Text>
                        <FontAwesome
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      </Pressable>
                      {isExpanded && (
                        <View style={styles.candyChips}>
                          {list.map((candy) => (
                            <Pressable
                              key={candy.id}
                              style={({ pressed }) => [styles.candyChip, pressed && styles.candyChipPressed]}
                              onPress={() =>
                                addFlowActive ? addPendingCandy(candy.name) : addCandyFromPicker(candy.name)
                              }
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
                      )}
                    </View>
                  );
                })
                )}
              </ScrollView>
              <View style={styles.modalRow}>
                {addFlowActive ? (
                  <>
                    <Pressable
                      style={[styles.modalBtn, styles.modalBtnSecondary]}
                      onPress={() => {
                        setPendingHouse(null);
                        setPendingCandy([]);
                        setShowAddCandyModal(false);
                        setShowCandyModal(false);
                      }}
                    >
                      <Text style={styles.modalBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.modalBtn,
                        styles.modalBtnPrimary,
                        submittingHouse && { opacity: 0.7 },
                      ]}
                      onPress={completeAddHouseFlow}
                      disabled={submittingHouse}
                    >
                      <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                        {submittingHouse ? 'Adding...' : 'Done'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnSecondary, { flex: 1 }]}
                    onPress={() => setShowCandyModal(false)}
                  >
                    <Text style={styles.modalBtnText}>Done</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showAddCandyModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAddCandyModal(false);
            setShowCandyModal(true);
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setShowAddCandyModal(false);
                setShowCandyModal(true);
              }}
            />
            <DismissKeyboardScrollView
              style={styles.modalContent}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              onStartShouldSetResponder={() => true}
            >
              <AddCandyForm
                existingCategories={existingCategories}
                saveLabel={addFlowActive ? 'Save & add' : 'Save'}
                saving={savingNewCandy}
                onCancel={() => {
                  setShowAddCandyModal(false);
                  setShowCandyModal(true);
                }}
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
                    if (addFlowActive) addPendingCandy(data.name);
                    setShowAddCandyModal(false);
                    setShowCandyModal(true);
                  } catch (e) {
                    console.error(e);
                    Alert.alert('Error', 'Could not add candy.');
                  } finally {
                    setSavingNewCandy(false);
                  }
                }}
              />
            </DismissKeyboardScrollView>
          </View>
        </Modal>

        <Modal
          visible={showHouseModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowHouseModal(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHouseModal(false)} />
            <DismissKeyboardScrollView
              style={styles.modalContent}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>Add house</Text>
              <Text style={[styles.sessionStatus, { marginBottom: theme.spacing.md }]}>
                Step 1: Name and notes. Next you’ll add candy from this house.
              </Text>
              {houseImage ? (
                <Image
                  source={{ uri: getImageUri(houseImage)! }}
                  style={styles.houseModalImage}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={styles.modalLabel}>House name or address</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 123 Main St, Spooky house"
                placeholderTextColor={theme.colors.textMuted}
                value={houseName}
                onChangeText={setHouseName}
              />
              <Text style={styles.modalLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Great decorations, full-size bars..."
                placeholderTextColor={theme.colors.textMuted}
                value={houseNotes}
                onChangeText={setHouseNotes}
                multiline
              />
              <View style={styles.modalRow}>
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                  onPress={() => {
                    setShowHouseModal(false);
                    setHouseImage(null);
                    setHouseName('');
                    setHouseNotes('');
                    setPendingHouse(null);
                    setPendingCandy([]);
                  }}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalBtn,
                    styles.modalBtnPrimary,
                    submittingHouse && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    const name = houseName.trim();
                    if (!name) {
                      Alert.alert('Oops!', 'Give this house a name or address.');
                      return;
                    }
                    setPendingHouse((prev) =>
                      prev ? { ...prev, name, notes: houseNotes.trim() } : null
                    );
                    setShowHouseModal(false);
                    setShowCandyModal(true);
                  }}
                  disabled={submittingHouse || !houseName.trim()}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                    Next: Add candy
                  </Text>
                </Pressable>
              </View>
            </DismissKeyboardScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <DismissKeyboardScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Start trick-or-treating!</Text>
      <Text style={styles.subtitle}>
        Your route will be tracked on the map
      </Text>

      <Text style={styles.label}>Wearing a costume? (optional)</Text>
      <View style={styles.costumeList}>
        <Pressable
          style={[
            styles.costumeChip,
            selectedCostumeId === null && styles.costumeChipActive,
          ]}
          onPress={() => setSelectedCostumeId(null)}
        >
          <Text
            style={[
              styles.costumeChipText,
              selectedCostumeId === null && styles.costumeChipTextActive,
            ]}
          >
            None
          </Text>
        </Pressable>
        {costumes.map((c) => (
          <Pressable
            key={c.id}
            style={[
              styles.costumeChip,
              selectedCostumeId === c.id && styles.costumeChipActive,
            ]}
            onPress={() => setSelectedCostumeId(c.id)}
          >
            <Text
              style={[
                styles.costumeChipText,
                selectedCostumeId === c.id && styles.costumeChipTextActive,
              ]}
            >
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.addCostumeRow}>
        <TextInput
          style={styles.costumeInput}
          placeholder="Add new costume"
          placeholderTextColor={theme.colors.textMuted}
          value={newCostumeName}
          onChangeText={setNewCostumeName}
        />
        <Pressable
          style={[
            styles.addCostumeBtn,
            (!newCostumeName.trim() || addingCostume) && styles.addCostumeBtnDisabled,
          ]}
          onPress={async () => {
            const name = newCostumeName.trim();
            if (!name || !profile || addingCostume) return;
            setAddingCostume(true);
            try {
              const id = await createCostume(db, profile.id, name);
              setCostumes((prev) => [...prev, { id: Number(id), name }]);
              setSelectedCostumeId(Number(id));
              setNewCostumeName('');
            } finally {
              setAddingCostume(false);
            }
          }}
          disabled={!newCostumeName.trim() || addingCostume}
        >
          <Text style={styles.addCostumeBtnText}>Add</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.startBtn,
          (starting || pressed) && styles.startBtnDisabled,
        ]}
        onPress={startSession}
        disabled={starting}
      >
        <FontAwesome name="play" size={28} color="#fff" />
        <Text style={styles.startBtnText}>
          {starting ? 'Starting...' : 'Start session'}
        </Text>
      </Pressable>
    </DismissKeyboardScrollView>
  );
}
