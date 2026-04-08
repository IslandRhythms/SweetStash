import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pickImageFromCamera, pickImageFromLibrary } from '@/components/ImagePicker';
import { useTheme } from '@/contexts/ThemeContext';
import { getImageUri } from '@/lib/images';

export interface AddCandyFormData {
  name: string;
  category: string;
  emoji?: string | null;
  image_path?: string | null;
}

export interface AddCandyFormProps {
  existingCategories: string[];
  onSave: (data: AddCandyFormData) => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
  saveLabel?: string;
  title?: string;
}

export function AddCandyForm({
  existingCategories,
  onSave,
  onCancel,
  saving = false,
  saveLabel = 'Save',
  title = 'New candy (saved to catalog)',
}: AddCandyFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [emoji, setEmoji] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return existingCategories;
    return existingCategories.filter((cat) => cat.toLowerCase().includes(q));
  }, [existingCategories, categorySearch]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        form: {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        label: {
          fontSize: theme.fontSize.md,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        input: {
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          marginBottom: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
        chip: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.secondary,
          borderRadius: theme.borderRadius.md,
        },
        chipActive: { backgroundColor: theme.colors.primary },
        chipPressed: { opacity: 0.8 },
        chipText: { fontSize: theme.fontSize.sm, color: '#fff' },
        imageSection: { marginBottom: theme.spacing.md },
        imagePreview: {
          width: 80,
          height: 80,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
          backgroundColor: theme.colors.border,
        },
        imagePlaceholder: {
          width: 80,
          height: 80,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.sm,
          backgroundColor: theme.colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        pickRow: { flexDirection: 'row', gap: theme.spacing.sm },
        pickBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
        },
        pickBtnPressed: { opacity: 0.8 },
        pickBtnText: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.text },
        row: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
        btn: {
          flex: 1,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          alignItems: 'center',
        },
        btnSecondary: { backgroundColor: theme.colors.border },
        btnPrimary: { backgroundColor: theme.colors.primary },
        btnDisabled: { opacity: 0.7 },
        btnText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text },
        btnTextPrimary: { color: '#fff' },
        categorySearchHint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.sm,
        },
      }),
    [theme]
  );

  async function handlePickImage(fromCamera: boolean) {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const path = fromCamera ? await pickImageFromCamera() : await pickImageFromLibrary();
      if (path) setImagePath(path);
    } finally {
      setPickingImage(false);
    }
  }

  async function handleSave() {
    const nameTrim = name.trim();
    const categoryTrim = category.trim();
    if (!nameTrim || !categoryTrim) {
      Alert.alert('Oops!', 'Name and category are required.');
      return;
    }
    await onSave({
      name: nameTrim,
      category: categoryTrim,
      emoji: emoji.trim() || null,
      image_path: imagePath || null,
    });
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{title}</Text>
      <TextInput
        style={styles.input}
        placeholder="Candy name"
        placeholderTextColor={theme.colors.textMuted}
        value={name}
        onChangeText={setName}
      />
      <Text style={styles.label}>Category (pick below or type a new one)</Text>
      <TextInput
        style={styles.input}
        placeholder="Search categories"
        placeholderTextColor={theme.colors.textMuted}
        value={categorySearch}
        onChangeText={setCategorySearch}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search categories"
        clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
      />
      {existingCategories.length > 0 && filteredCategories.length === 0 ? (
        <Text style={styles.categorySearchHint}>No categories match your search.</Text>
      ) : (
        <View style={styles.chips}>
          {filteredCategories.map((cat) => (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                styles.chip,
                category === cat && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setCategory(category === cat ? '' : cat)}
            >
              <Text style={[styles.chipText, category === cat && { color: '#fff' }]}>{cat}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <TextInput
        style={styles.input}
        placeholder="Or type new category e.g. Seasonal"
        placeholderTextColor={theme.colors.textMuted}
        value={category}
        onChangeText={setCategory}
      />
      <Text style={styles.label}>Emoji (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 🍫"
        placeholderTextColor={theme.colors.textMuted}
        value={emoji}
        onChangeText={setEmoji}
      />
      <View style={styles.imageSection}>
        <Text style={styles.label}>Image (optional)</Text>
        {imagePath ? (
          <Image
            source={{ uri: getImageUri(imagePath)! }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <FontAwesome name="picture-o" size={28} color={theme.colors.textMuted} />
          </View>
        )}
        <View style={styles.pickRow}>
          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && styles.pickBtnPressed]}
            onPress={() => handlePickImage(true)}
            disabled={pickingImage}
          >
            <FontAwesome name="camera" size={18} color={theme.colors.text} />
            <Text style={styles.pickBtnText}>{pickingImage ? '...' : 'Take photo'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed && styles.pickBtnPressed]}
            onPress={() => handlePickImage(false)}
            disabled={pickingImage}
          >
            <FontAwesome name="photo" size={18} color={theme.colors.text} />
            <Text style={styles.pickBtnText}>{pickingImage ? '...' : 'From gallery'}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancel}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.btn,
            styles.btnPrimary,
            (saving || !name.trim() || !category.trim()) && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={saving || !name.trim() || !category.trim()}
        >
          <Text style={[styles.btnText, styles.btnTextPrimary]}>
            {saving ? 'Saving...' : saveLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
