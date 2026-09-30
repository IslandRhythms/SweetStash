import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type KeyboardAwareOverlayProps = {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  children: React.ReactNode;
};

/**
 * Modal backdrop that lifts its centered content above the keyboard.
 * Avoids KeyboardAvoidingView, whose LayoutAnimation breaks content inside RN Modals on iOS.
 */
export function KeyboardAwareOverlay({ style, pointerEvents, children }: KeyboardAwareOverlayProps) {
  const keyboardHeight = useRef(new Animated.Value(Keyboard.metrics()?.height ?? 0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    function animateTo(toValue: number, duration: number | undefined) {
      Animated.timing(keyboardHeight, {
        toValue,
        duration: duration || 250,
        useNativeDriver: false,
      }).start();
    }

    const showSub = Keyboard.addListener(showEvent, (e) =>
      animateTo(e.endCoordinates.height, e.duration)
    );
    const hideSub = Keyboard.addListener(hideEvent, (e) => animateTo(0, e.duration));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  return (
    <Animated.View style={[style, { paddingBottom: keyboardHeight }]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
