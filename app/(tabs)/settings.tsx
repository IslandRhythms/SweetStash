import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { pickImageFromCamera, pickImageFromLibrary } from '@/components/ImagePicker';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme, useThemePreference } from '@/contexts/ThemeContext';
import {
  createCandy,
  createProfile,
  getCandies,
  getFirstProfile,
  getHouses,
  getProfile,
  getProfiles,
  updateCandy,
} from '@/lib/db';
import { getImageUri } from '@/lib/images';
import type { Candy, House, Profile } from '@/types';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const { profile, setProfile } = useProfile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [candies, setCandies] = useState<Candy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const [candyModal, setCandyModal] = useState<Candy | null | 'add'>(null);
  const [candyName, setCandyName] = useState('');
  const [candyCategory, setCandyCategory] = useState('');
  const [candyImagePath, setCandyImagePath] = useState('');
  const [savingCandy, setSavingCandy] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);

  const loadCandies = useCallback(async () => {
    const list = await getCandies(db);
    setCandies(list);
  }, [db]);

  const loadHouses = useCallback(async () => {
    if (!profile) {
      setHouses([]);
      return;
    }
    const list = await getHouses(db, profile.id);
    setHouses(list);
  }, [db, profile]);

  useEffect(() => {
    loadProfiles();
    loadCandies();
  }, [loadCandies]);

  useEffect(() => {
    void loadHouses();
  }, [loadHouses]);

  function openCandyForm(candy: Candy | null) {
    setCandyModal(candy ?? 'add');
    setCandyName(candy?.name ?? '');
    setCandyCategory(candy?.category ?? '');
    setCandyImagePath(candy?.image_path ?? '');
  }

  async function handlePickCandyImage(fromCamera: boolean) {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const path = fromCamera ? await pickImageFromCamera() : await pickImageFromLibrary();
      if (path) setCandyImagePath(path);
    } finally {
      setPickingImage(false);
    }
  }

  async function handleSaveCandy() {
    const name = candyName.trim();
    const category = candyCategory.trim();
    if (!name || !category) {
      Alert.alert('Oops!', 'Name and category are required.');
      return;
    }
    setSavingCandy(true);
    try {
      if (candyModal === 'add') {
        await createCandy(db, {
          name,
          category,
          image_path: candyImagePath.trim() || null,
        });
      } else if (candyModal && typeof candyModal === 'object') {
        await updateCandy(db, candyModal.id, {
          name,
          category,
          image_path: candyImagePath.trim() || null,
        });
      }
      await loadCandies();
      setCandyModal(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save candy. Name may already exist.');
    } finally {
      setSavingCandy(false);
    }
  }

  async function loadProfiles() {
    setLoading(true);
    const list = await getProfiles(db);
    setProfiles(list);
    setLoading(false);
  }

  async function handleSelect(p: Profile) {
    await setProfile(p);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const id = await createProfile(db, name);
      await loadProfiles();
      const p = await getProfile(db, Number(id));
      if (p) {
        await setProfile(p);
        setShowAdd(false);
        setNewName('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  }

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.colors.background },
        content: { padding: theme.spacing.lg },
        center: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        },
        sectionTitle: {
          fontSize: theme.fontSize.xl,
          fontWeight: 'bold',
          color: theme.colors.text,
          marginTop: theme.spacing.md,
          marginBottom: theme.spacing.xs,
        },
        sectionSubtitle: {
          fontSize: theme.fontSize.md,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
        },
        list: { gap: theme.spacing.md },
        card: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          minHeight: theme.minTouchTarget,
          borderWidth: 2,
          borderColor: 'transparent',
        },
        cardSelected: { borderColor: theme.colors.primary },
        cardPressed: { opacity: 0.8 },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: `${theme.colors.primary}20`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: theme.spacing.md,
        },
        cardName: {
          flex: 1,
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
        },
        addBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        },
        addBtnPressed: { opacity: 0.9 },
        addBtnText: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: '#fff',
        },
        addForm: { marginTop: theme.spacing.md },
        input: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.lg,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
        },
        addFormRow: { flexDirection: 'row', gap: theme.spacing.md },
        cancelBtn: {
          flex: 1,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
        },
        saveBtn: {
          flex: 1,
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
        },
        saveBtnDisabled: { opacity: 0.5 },
        btnPressed: { opacity: 0.8 },
        cancelBtnText: { fontSize: theme.fontSize.md, color: theme.colors.text },
        saveBtnText: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: '#fff',
        },
        spacer: { height: theme.spacing.xl * 2 },
        candyThumb: { width: 40, height: 40, borderRadius: 8, marginRight: theme.spacing.md },
        candyCard: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
          marginBottom: theme.spacing.sm,
        },
        candyCardPressed: { opacity: 0.8 },
        candyCardName: { flex: 1, fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
        candyCardCategory: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
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
          maxHeight: '85%',
        },
        modalTitle: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
        modalLabel: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 4 },
        modalInput: {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        imagePreview: { width: 80, height: 80, borderRadius: 8, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.border },
        pickImageRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
        pickImageBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
      }),
    [theme]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <DismissKeyboardScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.sectionTitle}>Theme</Text>
      <Text style={styles.sectionSubtitle}>
        Choose light, dark, or follow your device.
      </Text>
      <View style={[styles.list, { marginBottom: theme.spacing.xl }]}>
        {(['light', 'dark', 'system'] as const).map((pref) => (
          <Pressable
            key={pref}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
              themePreference === pref && styles.cardSelected,
            ]}
            onPress={() => setThemePreference(pref)}
          >
            <FontAwesome
              name={pref === 'light' ? 'sun-o' : pref === 'dark' ? 'moon-o' : 'mobile'}
              size={24}
              color={themePreference === pref ? theme.colors.primary : theme.colors.textMuted}
              style={{ marginRight: theme.spacing.md }}
            />
            <Text style={styles.cardName}>
              {pref === 'light' ? 'Light' : pref === 'dark' ? 'Dark' : 'Follow device'}
            </Text>
            {themePreference === pref && (
              <FontAwesome name="check" size={24} color={theme.colors.primary} />
            )}
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Candy catalog</Text>
      <Text style={styles.sectionSubtitle}>
        Add candies or edit name, category, and image (from your device). Used on My Stash and Session.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={() => openCandyForm(null)}
      >
        <FontAwesome name="plus" size={24} color="#fff" />
        <Text style={styles.addBtnText}>Add candy</Text>
      </Pressable>
      <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator>
        {candies.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.candyCard, pressed && styles.candyCardPressed]}
            onPress={() => openCandyForm(c)}
          >
            {c.image_path ? (
              <Image
                source={{ uri: getImageUri(c.image_path)! }}
                style={styles.candyThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.candyThumb, { backgroundColor: `${theme.colors.primary}30`, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 18 }}>{c.emoji ?? '🍬'}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.candyCardName}>{c.name}</Text>
              <Text style={styles.candyCardCategory}>{c.category}</Text>
            </View>
            <FontAwesome name="pencil" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Houses</Text>
      <Text style={styles.sectionSubtitle}>
        {profile
          ? `${houses.length} saved house${houses.length === 1 ? '' : 'es'} (used on the Session map after you visit them).`
          : 'Select a profile to manage houses.'}
      </Text>

      <Text style={styles.sectionTitle}>Profile</Text>
      <Text style={styles.sectionSubtitle}>
        Who&apos;s tracking candy? Tap to switch.
      </Text>

      {!showAdd ? (
        <>
          <View style={styles.list}>
            {profiles.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                  profile?.id === p.id && styles.cardSelected,
                ]}
                onPress={() => handleSelect(p)}
              >
                <View style={styles.avatar}>
                  <FontAwesome name="user" size={32} color={theme.colors.primary} />
                </View>
                <Text style={styles.cardName}>{p.name}</Text>
                {profile?.id === p.id && (
                  <FontAwesome name="check" size={24} color={theme.colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            onPress={() => setShowAdd(true)}
          >
            <FontAwesome name="plus" size={24} color="#fff" />
            <Text style={styles.addBtnText}>Add profile</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            placeholderTextColor={theme.colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <View style={styles.addFormRow}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={() => {
                setShowAdd(false);
                setNewName('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!newName.trim() || adding) && styles.saveBtnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={handleAdd}
              disabled={!newName.trim() || adding}
            >
              <Text style={styles.saveBtnText}>{adding ? 'Adding...' : 'Add'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal
        visible={candyModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCandyModal(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCandyModal(null)} />
          <DismissKeyboardScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>{candyModal === 'add' ? 'Add candy' : 'Edit candy'}</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Snickers"
              placeholderTextColor={theme.colors.textMuted}
              value={candyName}
              onChangeText={setCandyName}
            />
            <Text style={styles.modalLabel}>Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Chocolate, Fruity"
              placeholderTextColor={theme.colors.textMuted}
              value={candyCategory}
              onChangeText={setCandyCategory}
            />
            <Text style={styles.modalLabel}>Image (from your device)</Text>
            {candyImagePath && getImageUri(candyImagePath) ? (
              <Image
                source={{ uri: getImageUri(candyImagePath)! }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imagePreview, { justifyContent: 'center', alignItems: 'center' }]}>
                <FontAwesome name="picture-o" size={28} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={styles.pickImageRow}>
              <Pressable
                style={({ pressed }) => [styles.pickImageBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handlePickCandyImage(true)}
                disabled={pickingImage}
              >
                <FontAwesome name="camera" size={18} color={theme.colors.text} />
                <Text style={styles.cancelBtnText}>{pickingImage ? '...' : 'Camera'}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.pickImageBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handlePickCandyImage(false)}
                disabled={pickingImage}
              >
                <FontAwesome name="photo" size={18} color={theme.colors.text} />
                <Text style={styles.cancelBtnText}>Gallery</Text>
              </Pressable>
            </View>
            <View style={styles.addFormRow}>
              <Pressable
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                onPress={() => setCandyModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!candyName.trim() || !candyCategory.trim() || savingCandy) && styles.saveBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
                onPress={handleSaveCandy}
                disabled={!candyName.trim() || !candyCategory.trim() || savingCandy}
              >
                <Text style={styles.saveBtnText}>{savingCandy ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </DismissKeyboardScrollView>
        </View>
      </Modal>

      <View style={styles.spacer} />
    </DismissKeyboardScrollView>
  );
}
