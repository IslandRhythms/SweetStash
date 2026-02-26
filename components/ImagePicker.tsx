import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { getImageUri, saveImageFromUri, updateImage } from '@/lib/images';

/**
 * Pick an image from the camera. Returns saved file path or null if cancelled.
 */
export async function pickImageFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to use the camera is needed.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (!result.canceled && result.assets[0]) {
    return saveImageFromUri(result.assets[0].uri);
  }
  return null;
}

/**
 * Pick an image from the library. Returns saved file path or null if cancelled.
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to access photos is needed.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (!result.canceled && result.assets[0]) {
    return saveImageFromUri(result.assets[0].uri);
  }
  return null;
}

interface ImagePickerProps {
  value: string | null;
  onChange: (path: string | null) => void;
  onEdit?: boolean;
}

export function ImagePickerButton({ value, onChange, onEdit }: ImagePickerProps) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);

  async function pickImage() {
    if (picking) return;
    setPicking(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access photos is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const path = value && onEdit
          ? await updateImage(value, uri)
          : await saveImageFromUri(uri);
        onChange(path);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPicking(false);
    }
  }

  function removeImage() {
    onChange(null);
  }

  const displayUri = value ? getImageUri(value) : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { marginVertical: theme.spacing.sm },
        placeholder: {
          height: 120,
          backgroundColor: theme.colors.border,
          borderRadius: theme.borderRadius.md,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: theme.colors.textMuted,
        },
        placeholderPressed: { opacity: 0.8 },
        placeholderText: { fontSize: theme.fontSize.md, color: theme.colors.textMuted },
        previewWrap: {
          position: 'relative',
          borderRadius: theme.borderRadius.md,
          overflow: 'hidden',
        },
        preview: { width: '100%', height: 180, resizeMode: 'cover' as const },
        overlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          gap: theme.spacing.sm,
          padding: theme.spacing.sm,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        btn: {
          flex: 1,
          padding: theme.spacing.sm,
          backgroundColor: theme.colors.primary,
          borderRadius: theme.borderRadius.sm,
          alignItems: 'center',
        },
        btnRemove: { backgroundColor: theme.colors.textMuted },
        btnPressed: { opacity: 0.8 },
        btnText: { color: '#fff', fontSize: theme.fontSize.sm },
      }),
    [theme]
  );

  return (
    <View style={styles.container}>
      {displayUri ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: displayUri }} style={styles.preview} />
          <View style={styles.overlay}>
            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={pickImage}
            >
              <Text style={styles.btnText}>Change</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnRemove, pressed && styles.btnPressed]}
              onPress={removeImage}
            >
              <Text style={styles.btnText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.placeholder, pressed && styles.placeholderPressed]}
          onPress={pickImage}
          disabled={picking}
        >
          <Text style={styles.placeholderText}>
            {picking ? 'Loading...' : 'Add photo'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
