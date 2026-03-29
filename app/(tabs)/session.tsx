import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';

import { AddCandyForm } from '@/components/AddCandyForm';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import {
  pickImageFromCamera,
  pickImageFromLibrary,
  pickNewCostumePhotoFromCamera,
  pickNewCostumePhotoFromGallery,
} from '@/components/ImagePicker';
import { SessionMap } from '@/components/SessionMap';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  addCostumePhoto,
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
  getCostumePhotosForSession,
  getHouseVisits,
  getHouses,
  getLocationPoints,
  getProfile,
  removeHouseVisitFromSession,
  updateSession,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { Candy, CostumePhoto, LocationPoint, Session } from '@/types';
import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [costumes, setCostumes] = useState<{ id: number; name: string }[]>([]);
  const [houses, setHouses] = useState<{ id: number; name: string; latitude: number | null; longitude: number | null }[]>([]);
  const [visitedHouseIds, setVisitedHouseIds] = useState<Set<number>>(new Set());
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
  const [housePhotoBusy, setHousePhotoBusy] = useState<'camera' | 'gallery' | null>(null);
  const [submittingHouse, setSubmittingHouse] = useState(false);
  /** Add-house flow: photo → name/notes → candy → then create house + add to map (lat/lng captured when Add house is tapped) */
  const [pendingHouse, setPendingHouse] = useState<{
    imagePath: string;
    name: string;
    notes: string;
    latitude: number | null;
    longitude: number | null;
  } | null>(null);
  const [pendingCandy, setPendingCandy] = useState<{ candyName: string; quantity: number }[]>([]);
  const [sessionCandyCount, setSessionCandyCount] = useState(0);
  const [candies, setCandies] = useState<Candy[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const subRef = useRef<{ remove: () => void } | null>(null);
  /** After gallery/camera closes, ignore backdrop presses until interactions settle (avoids ghost dismiss). */
  const houseModalBackdropReadyRef = useRef(true);

  useEffect(() => {
    if (!showHouseModal) {
      houseModalBackdropReadyRef.current = true;
      return;
    }
    houseModalBackdropReadyRef.current = false;
    const t = setTimeout(() => {
      houseModalBackdropReadyRef.current = true;
    }, 500);
    return () => clearTimeout(t);
  }, [showHouseModal]);

  /** Separate modal for adding new candy to catalog (avoids nested form inside candy modal) */
  const [showAddCandyModal, setShowAddCandyModal] = useState(false);
  const [savingNewCandy, setSavingNewCandy] = useState(false);
  const [costumePhotos, setCostumePhotos] = useState<CostumePhoto[]>([]);
  const [costumePhotoBusy, setCostumePhotoBusy] = useState<'camera' | 'gallery' | null>(null);
  const [costumeSectionExpanded, setCostumeSectionExpanded] = useState(false);
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

  useEffect(() => {
    getCandies(db).then(setCandies);
  }, [db]);

  useEffect(() => {
    if (!session?.costume_id) {
      setCostumePhotos([]);
      return;
    }
    getCostumePhotosForSession(db, session.costume_id, session.id).then(setCostumePhotos);
  }, [session?.costume_id, session?.id, db]);

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
    if (!profile) return;
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
      }
      getCostumes(db, profile.id).then((c) =>
        setCostumes(c.map((x) => ({ id: x.id, name: x.name })))
      );
      getHouses(db, profile.id).then((h) =>
        setHouses(h.map((x) => ({ id: x.id, name: x.name, latitude: x.latitude, longitude: x.longitude })))
      );
    });
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
      const id = await createSession(db, profile.id, null, {
        sessionType: 'trick_or_treat',
      });
      const s = await db.getFirstAsync<Session>(
        'SELECT * FROM sessions WHERE id = ?',
        id
      );
      if (s) {
        setSession(s);
        getLocationPoints(db, s.id).then(setPoints);
        getHouseVisits(db, s.id).then((visits) =>
          setVisitedHouseIds(new Set(visits.map((v) => v.house_id)))
        );
        getCandyLogs(db, profile.id, s.id).then((logs) =>
          setSessionCandyCount(logs.reduce((sum, l) => sum + l.quantity, 0))
        );
      }
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

  function beginHousePhotoFlow(
    path: string,
    latitude: number | null,
    longitude: number | null
  ) {
    InteractionManager.runAfterInteractions(() => {
      setHouseImage(path);
      setHouseName('');
      setHouseNotes('');
      setPendingHouse({
        imagePath: path,
        name: '',
        notes: '',
        latitude,
        longitude,
      });
      setPendingCandy([]);
      setShowHouseModal(true);
    });
  }

  async function addHouseFromCamera() {
    setHousePhotoBusy('camera');
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      } catch {
        if (points.length > 0) {
          latitude = points[points.length - 1].latitude;
          longitude = points[points.length - 1].longitude;
        }
      }
      const path = await pickImageFromCamera();
      if (path) beginHousePhotoFlow(path, latitude, longitude);
    } finally {
      setHousePhotoBusy(null);
    }
  }

  async function addHouseFromGallery() {
    setHousePhotoBusy('gallery');
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      } catch {
        if (points.length > 0) {
          latitude = points[points.length - 1].latitude;
          longitude = points[points.length - 1].longitude;
        }
      }
      const path = await pickImageFromLibrary();
      if (path) beginHousePhotoFlow(path, latitude, longitude);
    } finally {
      setHousePhotoBusy(null);
    }
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
      const lat = pendingHouse.latitude;
      const lng = pendingHouse.longitude;
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

  function confirmRemoveHouseFromSession(houseId: number, houseLabel: string) {
    if (!session) return;
    Alert.alert(
      'Remove from this session?',
      `${houseLabel} will no longer count as visited. Candy stays in your haul but won’t be linked to this house.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeHouseVisitFromSession(db, session.id, houseId);
              setVisitedHouseIds((prev) => {
                const next = new Set(prev);
                next.delete(houseId);
                return next;
              });
              setCandyHouseId((id) => (id === houseId ? null : id));
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Could not remove house from session.');
            }
          },
        },
      ]
    );
  }

  async function setSessionCostume(costumeId: number | null) {
    if (!session) return;
    await updateSession(db, session.id, { costumeId });
    const s = await db.getFirstAsync<Session>('SELECT * FROM sessions WHERE id = ?', session.id);
    if (s) setSession(s);
  }

  async function addSessionCostumePhoto(path: string | null) {
    if (!path || !session?.costume_id) return;
    await addCostumePhoto(db, session.costume_id, path, session.id);
    const list = await getCostumePhotosForSession(db, session.costume_id, session.id);
    setCostumePhotos(list);
  }

  async function takeCostumePhotoFromCamera() {
    if (!session?.costume_id) return;
    setCostumePhotoBusy('camera');
    try {
      const path = await pickNewCostumePhotoFromCamera();
      await addSessionCostumePhoto(path);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save costume photo.');
    } finally {
      setCostumePhotoBusy(null);
    }
  }

  async function takeCostumePhotoFromGallery() {
    if (!session?.costume_id) return;
    setCostumePhotoBusy('gallery');
    try {
      const path = await pickNewCostumePhotoFromGallery();
      await addSessionCostumePhoto(path);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save costume photo.');
    } finally {
      setCostumePhotoBusy(null);
    }
  }

  async function confirmEndSession() {
    if (!session) return;
    setEnding(true);
    try {
      subRef.current?.remove();
      await endSession(db, session.id);
      setShowEndSessionModal(false);
      router.replace(`/session/summary/${session.id}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not end session.');
    } finally {
      setEnding(false);
    }
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
          marginBottom: theme.spacing.md,
        },
        stepsBox: {
          marginBottom: theme.spacing.xl,
          gap: theme.spacing.md,
        },
        stepRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.md,
        },
        stepIndexWrap: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        },
        stepIndexText: {
          color: '#fff',
          fontSize: theme.fontSize.sm,
          fontWeight: '700',
        },
        stepBody: {
          flex: 1,
          fontSize: theme.fontSize.sm,
          lineHeight: 22,
          color: theme.colors.textMuted,
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
        sessionStatusBar: {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        },
        sessionStatus: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          textAlign: 'center',
        },
        endSessionFooter: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          paddingTop: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
        endSessionFooterBtn: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.secondary,
          paddingVertical: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        },
        endSessionFooterBtnInner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          width: '100%',
        },
        endSessionFooterBtnText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        },
        endSessionModalCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.xl,
          padding: theme.spacing.xl,
          width: '100%',
          maxWidth: 340,
          zIndex: 1,
          ...Platform.select({ android: { elevation: 10 } }),
        },
        endSessionModalTitle: {
          fontSize: theme.fontSize.lg,
          fontWeight: '700',
          color: theme.colors.text,
          textAlign: 'center',
          marginBottom: theme.spacing.sm,
        },
        endSessionModalMessage: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          lineHeight: 24,
          textAlign: 'center',
        },
        endSessionModalActions: {
          marginTop: theme.spacing.xl,
          gap: theme.spacing.sm,
          width: '100%',
        },
        endSessionModalBtn: {
          width: '100%',
          minHeight: theme.minTouchTarget,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        endSessionModalBtnCancel: {
          backgroundColor: theme.colors.background,
          borderWidth: 2,
          borderColor: theme.colors.border,
        },
        endSessionModalConfirmRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          gap: theme.spacing.sm,
        },
        endSessionModalBtnConfirm: {
          backgroundColor: theme.colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
        endSessionModalBtnCancelText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          textAlign: 'center',
          width: '100%',
        },
        endSessionModalBtnConfirmText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        },
        sessionSummaryCard: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        sessionCostumeCard: {
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.md,
        },
        sessionStatsRow: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
        },
        sessionStatBox: {
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.md,
        },
        sessionStatIconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sessionStatTextCol: {
          flex: 1,
          minWidth: 0,
        },
        sessionStatValue: {
          fontSize: theme.fontSize.xl,
          fontWeight: '700',
          color: theme.colors.text,
        },
        sessionStatLabel: {
          fontSize: 13,
          color: theme.colors.textMuted,
          marginTop: 2,
        },
        sessionSummaryLine: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.xs,
        },
        sessionHousesHeading: {
          fontSize: theme.fontSize.sm,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        sessionHouseRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.xs,
        },
        sessionHouseName: {
          flex: 1,
          fontSize: theme.fontSize.sm,
          color: theme.colors.text,
        },
        sessionHouseRemove: {
          padding: theme.spacing.xs,
        },
        costumeSessionBlock: {
          marginTop: 0,
          padding: theme.spacing.xl,
          backgroundColor: theme.colors.background,
          borderRadius: theme.borderRadius.lg,
        },
        costumeFoldHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
        },
        costumeSectionTitle: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
        },
        costumeFoldHint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginTop: theme.spacing.sm,
        },
        costumeExpandedInner: {
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        costumeSessionChip: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          minHeight: theme.minTouchTarget,
        },
        costumeListInSession: {
          marginBottom: 0,
        },
        costumePhotoStrip: {
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
          maxHeight: 76,
        },
        costumePhotoStripItem: {
          width: 72,
          height: 72,
          borderRadius: theme.borderRadius.md,
          marginRight: theme.spacing.sm,
          backgroundColor: theme.colors.border,
        },
        costumePhotoButtonsRowInCard: {
          flexDirection: 'row',
          gap: theme.spacing.sm,
          alignSelf: 'stretch',
        },
        addHouseButtonsRow: {
          flexDirection: 'row',
          gap: theme.spacing.md,
          marginHorizontal: theme.spacing.lg,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.xl,
        },
        addHouseBtnHalf: {
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.lg,
        },
        addHouseBtnCamera: {
          backgroundColor: theme.colors.primary,
        },
        addHouseBtnGallery: {
          backgroundColor: theme.colors.secondary,
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
        addCostumeRowInSession: {
          marginBottom: theme.spacing.sm,
        },
        costumeInput: {
          flex: 1,
          backgroundColor: theme.colors.surface,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
        },
        addCostumeBtn: {
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          justifyContent: 'center',
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.md,
          minHeight: theme.minTouchTarget,
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
          zIndex: 1,
          ...Platform.select({ android: { elevation: 8 } }),
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
        modalTextArea: { minHeight: 100, maxHeight: 180, textAlignVertical: 'top' as const },
        houseModalImage: {
          width: '100%',
          height: 160,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          backgroundColor: theme.colors.border,
        },
        modalRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
        modalBtn: {
          flex: 1,
          minHeight: 52,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalBtnPrimary: {
          backgroundColor: theme.colors.primary,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
        modalBtnSecondary: {
          backgroundColor: theme.colors.background,
          borderWidth: 2,
          borderColor: theme.colors.border,
        },
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
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sessionStatusBar}>
            <Text style={styles.sessionStatus}>
              Tracking route · {points.length} point{points.length !== 1 ? 's' : ''}
            </Text>
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
            <View style={styles.sessionStatsRow}>
              <View style={styles.sessionStatBox}>
                <View style={styles.sessionStatIconWrap}>
                  <FontAwesome name="map-marker" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.sessionStatTextCol}>
                  <Text style={styles.sessionStatValue}>{points.length}</Text>
                  <Text style={styles.sessionStatLabel}>
                    GPS point{points.length !== 1 ? 's' : ''} on route
                  </Text>
                </View>
              </View>
              <View style={styles.sessionStatBox}>
                <View style={styles.sessionStatIconWrap}>
                  <FontAwesome name="gift" size={18} color={theme.colors.secondary} />
                </View>
                <View style={styles.sessionStatTextCol}>
                  <Text style={styles.sessionStatValue}>{sessionCandyCount}</Text>
                  <Text style={styles.sessionStatLabel}>
                    Candy piece{sessionCandyCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </View>
            {visitedHouses.length > 0 && (
              <>
                <Text style={styles.sessionHousesHeading}>Houses this session</Text>
                {visitedHouses.map((h) => (
                  <View key={h.id} style={styles.sessionHouseRow}>
                    <Text style={styles.sessionHouseName} numberOfLines={2}>
                      {h.name}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Remove ${h.name} from session`}
                      style={({ pressed }) => [
                        styles.sessionHouseRemove,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => confirmRemoveHouseFromSession(h.id, h.name)}
                    >
                      <FontAwesome
                        name="times-circle"
                        size={22}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={styles.sessionCostumeCard}>
            <View style={styles.costumeSessionBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.costumeFoldHeader,
                  pressed && { opacity: 0.92 },
                ]}
                onPress={() => setCostumeSectionExpanded((e) => !e)}
                accessibilityRole="button"
                accessibilityState={{ expanded: costumeSectionExpanded }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.costumeSectionTitle}>Costume</Text>
                  {!costumeSectionExpanded && (
                    <Text style={styles.costumeFoldHint} numberOfLines={2}>
                      {session.costume_id == null
                        ? 'None — tap to choose or add'
                        : `${costumes.find((c) => c.id === session.costume_id)?.name ?? 'Costume'} · ${costumePhotos.length} photo${costumePhotos.length !== 1 ? 's' : ''}`}
                    </Text>
                  )}
                </View>
                <FontAwesome
                  name={costumeSectionExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
              {costumeSectionExpanded && (
                <View style={styles.costumeExpandedInner}>
                  <View style={[styles.costumeList, styles.costumeListInSession]}>
                    <Pressable
                      style={[
                        styles.costumeChip,
                        styles.costumeSessionChip,
                        session.costume_id === null && styles.costumeChipActive,
                      ]}
                      onPress={() => setSessionCostume(null)}
                    >
                      <Text
                        style={[
                          styles.costumeChipText,
                          session.costume_id === null && styles.costumeChipTextActive,
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
                          styles.costumeSessionChip,
                          session.costume_id === c.id && styles.costumeChipActive,
                        ]}
                        onPress={() => setSessionCostume(c.id)}
                      >
                        <Text
                          style={[
                            styles.costumeChipText,
                            session.costume_id === c.id && styles.costumeChipTextActive,
                          ]}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={[styles.addCostumeRow, styles.addCostumeRowInSession]}>
                    <TextInput
                      style={styles.costumeInput}
                      placeholder="New costume name"
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
                        if (!name || !profile || addingCostume || !session) return;
                        setAddingCostume(true);
                        try {
                          const cid = await createCostume(db, profile.id, name);
                          const id = Number(cid);
                          setCostumes((prev) => [...prev, { id, name }]);
                          setNewCostumeName('');
                          await setSessionCostume(id);
                          const list = await getCostumePhotosForSession(db, id, session.id);
                          setCostumePhotos(list);
                        } finally {
                          setAddingCostume(false);
                        }
                      }}
                      disabled={!newCostumeName.trim() || addingCostume}
                    >
                      <Text style={styles.addCostumeBtnText}>Add</Text>
                    </Pressable>
                  </View>
                  {session.costume_id != null && (
                    <>
                      {costumePhotos.length > 0 ? (
                        <ScrollView
                          horizontal
                          nestedScrollEnabled
                          showsHorizontalScrollIndicator={false}
                          style={styles.costumePhotoStrip}
                          contentContainerStyle={{ alignItems: 'center', paddingRight: theme.spacing.sm }}
                        >
                          {costumePhotos.map((p) => (
                            <Pressable
                              key={p.id}
                              onPress={() =>
                                setImagePreviewUri(getImageUri(p.image_path) ?? null)
                              }
                              accessibilityRole="button"
                              accessibilityLabel="View costume photo full size"
                            >
                              <Image
                                source={{ uri: getImageUri(p.image_path)! }}
                                style={styles.costumePhotoStripItem}
                              />
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                      <Text
                        style={[
                          styles.sessionSummaryLine,
                          { marginBottom: theme.spacing.xs },
                        ]}
                      >
                        Photos here are for this run only. The Costumes tab shows every year for this
                        character.
                      </Text>
                      <View style={styles.costumePhotoButtonsRowInCard}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.addHouseBtnHalf,
                            styles.addHouseBtnCamera,
                            (costumePhotoBusy || pressed) && { opacity: 0.85 },
                          ]}
                          onPress={takeCostumePhotoFromCamera}
                          disabled={costumePhotoBusy !== null}
                        >
                          {costumePhotoBusy === 'camera' ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <FontAwesome name="camera" size={18} color="#fff" />
                              <Text style={styles.btnText} numberOfLines={1}>
                                Photo
                              </Text>
                            </>
                          )}
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [
                            styles.addHouseBtnHalf,
                            styles.addHouseBtnGallery,
                            (costumePhotoBusy || pressed) && { opacity: 0.85 },
                          ]}
                          onPress={takeCostumePhotoFromGallery}
                          disabled={costumePhotoBusy !== null}
                        >
                          {costumePhotoBusy === 'gallery' ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <FontAwesome name="image" size={18} color="#fff" />
                              <Text style={styles.btnText} numberOfLines={1}>
                                Gallery
                              </Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={styles.addHouseButtonsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.addHouseBtnHalf,
                styles.addHouseBtnCamera,
                (housePhotoBusy || pressed) && { opacity: 0.85 },
              ]}
              onPress={addHouseFromCamera}
              disabled={housePhotoBusy !== null}
            >
              {housePhotoBusy === 'camera' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FontAwesome name="camera" size={20} color="#fff" />
                  <Text style={styles.btnText} numberOfLines={1}>
                    Take photo
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.addHouseBtnHalf,
                styles.addHouseBtnGallery,
                (housePhotoBusy || pressed) && { opacity: 0.85 },
              ]}
              onPress={addHouseFromGallery}
              disabled={housePhotoBusy !== null}
            >
              {housePhotoBusy === 'gallery' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FontAwesome name="image" size={20} color="#fff" />
                  <Text style={styles.btnText} numberOfLines={1}>
                    Gallery
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>

        <View
          style={[
            styles.endSessionFooter,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.endSessionFooterBtn,
              (pressed || ending) && { opacity: 0.9 },
            ]}
            onPress={() => setShowEndSessionModal(true)}
            disabled={ending}
            accessibilityRole="button"
            accessibilityLabel="End session"
          >
            <View style={styles.endSessionFooterBtnInner}>
              <FontAwesome name="stop" size={20} color="#fff" />
              <Text style={styles.endSessionFooterBtnText}>End session</Text>
            </View>
          </Pressable>
        </View>

        <Modal
          visible={showEndSessionModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!ending) setShowEndSessionModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!ending) setShowEndSessionModal(false);
              }}
            />
            <View style={styles.endSessionModalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.endSessionModalTitle}>End session?</Text>
              <Text style={styles.endSessionModalMessage}>
                Your route and candy haul will be saved. You can review everything on the next
                screen.
              </Text>
              <View style={styles.endSessionModalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.endSessionModalBtn,
                    styles.endSessionModalBtnCancel,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => setShowEndSessionModal(false)}
                  disabled={ending}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel, keep session running"
                >
                  <Text style={styles.endSessionModalBtnCancelText}>Keep trick-or-treating</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.endSessionModalBtn,
                    styles.endSessionModalBtnConfirm,
                    (ending || pressed) && { opacity: 0.88 },
                  ]}
                  onPress={() => void confirmEndSession()}
                  disabled={ending}
                  accessibilityRole="button"
                  accessibilityLabel="End session and save"
                >
                  {ending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.endSessionModalConfirmRow}>
                      <FontAwesome name="stop" size={18} color="#fff" />
                      <Text style={styles.endSessionModalBtnConfirmText}>End session</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <ImagePreviewModal
          visible={imagePreviewUri != null}
          imageUri={imagePreviewUri}
          onClose={() => setImagePreviewUri(null)}
        />

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
                                <Pressable
                                  onPress={() =>
                                    setImagePreviewUri(getImageUri(candy.image_path) ?? null)
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`View ${candy.name} photo full size`}
                                >
                                  <Image
                                    source={{ uri: getImageUri(candy.image_path)! }}
                                    style={styles.candyThumbSmall}
                                  />
                                </Pressable>
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
          <View style={styles.modalOverlay} pointerEvents="box-none">
            <TouchableWithoutFeedback
              onPress={() => {
                if (!houseModalBackdropReadyRef.current) return;
                setShowHouseModal(false);
              }}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} />
            </TouchableWithoutFeedback>
            <DismissKeyboardScrollView
              style={styles.modalContent}
              contentContainerStyle={{
                paddingBottom: theme.spacing.xl,
              }}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator
              automaticallyAdjustKeyboardInsets
              nestedScrollEnabled
            >
                <Text style={styles.modalTitle}>Add house</Text>
                <Text style={[styles.sessionStatus, { marginBottom: theme.spacing.md }]}>
                  Step 1: Name and notes. Then log candy from this house.
                </Text>
                {houseImage ? (
                  <Pressable
                    onPress={() => setImagePreviewUri(getImageUri(houseImage) ?? null)}
                    accessibilityRole="button"
                    accessibilityLabel="View house photo full size"
                  >
                    <Image
                      source={{ uri: getImageUri(houseImage)! }}
                      style={styles.houseModalImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ) : null}
                <Text style={styles.modalLabel}>House name or address</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 123 Main St, Spooky house"
                  placeholderTextColor={theme.colors.textMuted}
                  value={houseName}
                  onChangeText={setHouseName}
                  returnKeyType="next"
                />
                <Text style={styles.modalLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Great decorations, full-size bars..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={houseNotes}
                  onChangeText={setHouseNotes}
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                />
                <View style={styles.modalRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalBtn,
                      styles.modalBtnSecondary,
                      pressed && { opacity: 0.88 },
                    ]}
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
                    style={({ pressed }) => [
                      styles.modalBtn,
                      styles.modalBtnPrimary,
                      submittingHouse && { opacity: 0.7 },
                      pressed && !submittingHouse && houseName.trim() && { opacity: 0.92 },
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
                      Add candy
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
      <View style={styles.stepsBox}>
        <View style={styles.stepRow}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>1</Text>
          </View>
          <Text style={styles.stepBody}>Tap Start session and allow location when prompted.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>2</Text>
          </View>
          <Text style={styles.stepBody}>Your path appears on the map as you walk.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>3</Text>
          </View>
          <Text style={styles.stepBody}>Log stops and candy with the photo buttons below the map.</Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>4</Text>
          </View>
          <Text style={styles.stepBody}>
            Expand Costume to pick a character and add photos for this run; full history is in the
            Costumes tab.
          </Text>
        </View>
        <View style={styles.stepRow}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>5</Text>
          </View>
          <Text style={styles.stepBody}>
            Use End session at the bottom of the screen to save and open your summary.
          </Text>
        </View>
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
