import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { getImageUri } from '@/lib/images';

export type HouseStopModalProps = {
  visible: boolean;
  name: string;
  notes?: string | null;
  imagePath?: string | null;
  onClose: () => void;
  onImagePress?: (uri: string) => void;
};

/**
 * In-tree overlay (not RN Modal) to avoid touch-freeze conflicts with MapView.
 */
export function HouseStopModal({
  visible,
  name,
  notes,
  imagePath,
  onClose,
  onImagePress,
}: HouseStopModalProps) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [imagePath, visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.lg,
          zIndex: 1000,
          ...Platform.select({ android: { elevation: 1000 } }),
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        content: {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          width: '100%',
          maxWidth: 360,
          zIndex: 1,
        },
        image: {
          width: '100%',
          aspectRatio: 4 / 3,
          borderRadius: theme.borderRadius.md,
          backgroundColor: theme.colors.border,
          marginBottom: theme.spacing.md,
        },
        imageMissing: {
          justifyContent: 'center',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
        },
        imageMissingText: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          textAlign: 'center',
        },
        title: {
          fontSize: theme.fontSize.lg,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
        },
        notes: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.lg,
        },
        close: {
          marginTop: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          alignItems: 'center',
        },
        closeText: {
          fontSize: theme.fontSize.md,
          color: theme.colors.primary,
          fontWeight: '600',
        },
      }),
    [theme]
  );

  if (!visible) return null;

  const imageUri = imagePath ? getImageUri(imagePath) : null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close house details"
      />
      <View style={styles.content}>
        {imagePath && !imageError ? (
          <Pressable
            onPress={() => {
              if (imageUri && onImagePress) onImagePress(imageUri);
            }}
            disabled={!onImagePress || !imageUri}
            accessibilityRole="button"
            accessibilityLabel="View house photo full size"
          >
            <Image
              source={{ uri: imageUri! }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          </Pressable>
        ) : imagePath && imageError ? (
          <View style={[styles.image, styles.imageMissing]}>
            <FontAwesome name="image" size={28} color={theme.colors.textMuted} />
            <Text style={styles.imageMissingText}>Photo not found on this device</Text>
          </View>
        ) : (
          <View style={styles.image} />
        )}
        <Text style={styles.title}>{name}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
