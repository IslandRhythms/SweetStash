import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useSQLiteContext } from 'expo-sqlite';
import { DismissKeyboardScrollView } from '@/components/DismissKeyboard';
import { useProfile } from '@/contexts/ProfileContext';
import { useTheme, useThemePreference } from '@/contexts/ThemeContext';
import { createProfile, getFirstProfile, getProfile, getProfiles } from '@/lib/db';
import { runSeed } from '@/lib/runSeed';
import type { Profile } from '@/types';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const { profile, setProfile } = useProfile();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    const list = await getProfiles(db);
    setProfiles(list);
    setLoading(false);
  }

  async function handleSelect(p: Profile) {
    await setProfile(p);
  }

  async function handleSeed() {
    if (seeding) return;
    setSeeding(true);
    try {
      await runSeed(db);
      await loadProfiles();
      const first = await getFirstProfile(db);
      if (first) await setProfile(first);
      setShowAdd(false);
      setNewName('');
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
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

      <Text style={styles.sectionTitle}>Profile</Text>
      <Text style={styles.sectionSubtitle}>
        Who&apos;s tracking candy? Tap to switch.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.addBtn,
          pressed && styles.addBtnPressed,
          { marginBottom: theme.spacing.lg, backgroundColor: theme.colors.secondary },
        ]}
        onPress={handleSeed}
        disabled={seeding}
      >
        <FontAwesome name="database" size={24} color="#fff" />
        <Text style={styles.addBtnText}>
          {seeding ? 'Seeding...' : 'Seed test data'}
        </Text>
      </Pressable>

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

      <View style={styles.spacer} />
    </DismissKeyboardScrollView>
  );
}
