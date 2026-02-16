import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { theme } from '@/constants/theme';
import {
  addHouseVisit,
  createCandyLog,
  createHouse,
  getActiveSession,
  getFirstProfile,
  getProfile,
} from '@/lib/db';

type Tab = 'candy' | 'house';

export default function LogScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { profile, loadStoredProfile } = useProfile();
  const [tab, setTab] = useState<Tab>('candy');
  const [ready, setReady] = useState(false);

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
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'candy' && styles.tabActive]}
          onPress={() => setTab('candy')}
        >
          <FontAwesome
            name="gift"
            size={20}
            color={tab === 'candy' ? '#fff' : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, tab === 'candy' && styles.tabTextActive]}>
            Candy
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'house' && styles.tabActive]}
          onPress={() => setTab('house')}
        >
          <FontAwesome
            name="home"
            size={20}
            color={tab === 'house' ? '#fff' : theme.colors.textMuted}
          />
          <Text style={[styles.tabText, tab === 'house' && styles.tabTextActive]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  checkLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: '#fff',
  },
});
