import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { SessionMap } from '@/components/SessionMap';
import { useProfile } from '@/contexts/ProfileContext';
import { theme } from '@/constants/theme';
import {
  addHouseVisit,
  addLocationPoint,
  createCostume,
  createSession,
  endSession,
  getActiveSession,
  getCostumes,
  getFirstProfile,
  getHouseVisits,
  getHouses,
  getLocationPoints,
  getProfile,
} from '@/lib/db';
import type { LocationPoint, Session } from '@/types';
import * as Location from 'expo-location';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { profile, loadStoredProfile } = useProfile();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [costumes, setCostumes] = useState<{ id: number; name: string }[]>([]);
  const [houses, setHouses] = useState<{ id: number; name: string }[]>([]);
  const [visitedHouseIds, setVisitedHouseIds] = useState<Set<number>>(new Set());
  const [selectedCostumeId, setSelectedCostumeId] = useState<number | null>(null);
  const [newCostumeName, setNewCostumeName] = useState('');
  const [addingCostume, setAddingCostume] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const subRef = useRef<{ remove: () => void } | null>(null);

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
          getCostumes(db, profile.id).then((c) =>
            setCostumes(c.map((x) => ({ id: x.id, name: x.name })))
          );
          getHouses(db, profile.id).then((h) =>
            setHouses(h.map((x) => ({ id: x.id, name: x.name })))
          );
        } else {
          getCostumes(db, profile.id).then((c) =>
            setCostumes(c.map((x) => ({ id: x.id, name: x.name })))
          );
          getHouses(db, profile.id).then((h) =>
            setHouses(h.map((x) => ({ id: x.id, name: x.name })))
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
      const id = await createSession(db, profile.id, selectedCostumeId);
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

    return (
      <View style={styles.container}>
        <View style={styles.mapWrap}>
          <SessionMap
            coordinates={coords}
            showCurrentLocation
            style={styles.map}
          />
        </View>
        <View style={styles.actions}>
          <Text style={styles.status}>
            Tracking your route... {points.length} points
          </Text>
          {houses.length > 0 && (
            <View style={styles.houseVisits}>
              <Text style={styles.houseVisitsLabel}>Mark house visit:</Text>
              <View style={styles.houseChips}>
                {houses
                  .filter((h) => !visitedHouseIds.has(h.id))
                  .map((h) => (
                    <Pressable
                      key={h.id}
                      style={({ pressed }) => [
                        styles.houseChip,
                        pressed && styles.houseChipPressed,
                      ]}
                      onPress={async () => {
                        await addHouseVisit(db, session.id, h.id);
                        setVisitedHouseIds((prev) => new Set([...prev, h.id]));
                      }}
                    >
                      <Text style={styles.houseChipText}>{h.name}</Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={() => router.push('/(tabs)/log')}
            >
              <FontAwesome name="plus-square" size={24} color="#fff" />
              <Text style={styles.btnText}>Log candy</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={handleEndSession}
              disabled={ending}
            >
              <FontAwesome name="stop" size={24} color="#fff" />
              <Text style={styles.btnText}>{ending ? 'Ending...' : 'End session'}</Text>
            </Pressable>
          </View>
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  costumeChipActive: {
    backgroundColor: theme.colors.primary,
  },
  costumeChipText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  costumeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
  },
  startBtnDisabled: {
    opacity: 0.7,
  },
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
  map: {
    flex: 1,
  },
  actions: {
    paddingVertical: theme.spacing.md,
  },
  status: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  houseVisits: {
    marginBottom: theme.spacing.md,
  },
  houseVisitsLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  houseChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  houseChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
  },
  houseChipPressed: {
    opacity: 0.8,
  },
  houseChipText: {
    fontSize: theme.fontSize.sm,
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
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
  addCostumeBtnDisabled: {
    opacity: 0.5,
  },
  addCostumeBtnText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});
