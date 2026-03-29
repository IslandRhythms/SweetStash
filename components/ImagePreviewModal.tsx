import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
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
 * Full-screen image preview (tap backdrop or close to dismiss).
 */
export function ImagePreviewModal({ visible, imageUri, onClose }: ImagePreviewModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const show = visible && imageUri != null && imageUri.length > 0;

  const imgW = Math.round(width * 0.96);
  const imgH = Math.round(height * 0.82);

  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss image preview"
        />
        <View style={styles.imageFrame} pointerEvents="box-none">
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: imgW, height: imgH }}
              resizeMode="contain"
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
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
});
