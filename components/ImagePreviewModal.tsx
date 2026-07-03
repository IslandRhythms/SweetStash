import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ImagePreviewModalProps = {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
};

/**
 * Full-screen image preview as an in-tree overlay (not RN Modal).
 */
export function ImagePreviewModal({ visible, imageUri, onClose }: ImagePreviewModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const show = visible && imageUri != null && imageUri.length > 0;
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [imageUri, visible]);

  useEffect(() => {
    if (!show) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [show, onClose]);

  const imgW = Math.round(width * 0.96);
  const imgH = Math.round(height * 0.82);

  if (!show) return null;

  return (
    <View
      style={[
        styles.root,
        Platform.OS === 'android' ? { elevation: 1100 } : null,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss image preview"
      />
      <View style={styles.imageFrame} pointerEvents="box-none">
        {loadError ? (
          <View style={styles.missingWrap}>
            <FontAwesome name="image" size={48} color="rgba(255,255,255,0.55)" />
            <Text style={styles.missingTitle}>Photo not found</Text>
            <Text style={styles.missingHint}>
              This photo is no longer available on your device.
            </Text>
          </View>
        ) : imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: imgW, height: imgH }}
            resizeMode="contain"
            onError={() => setLoadError(true)}
          />
        ) : null}
      </View>
      <Pressable
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={onClose}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <FontAwesome name="times-circle" size={40} color="rgba(255,255,255,0.95)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    zIndex: 1100,
  },
  backdrop: {
    zIndex: 0,
  },
  imageFrame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
  },
  missingWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  missingTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  missingHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
