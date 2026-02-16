import React from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';

/**
 * ScrollView that dismisses keyboard on scroll and when tapping outside inputs.
 * Use keyboardShouldPersistTaps="handled" so buttons work; taps on empty space dismiss keyboard.
 */
export function DismissKeyboardScrollView({
  children,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Wrapper that dismisses keyboard when tapping outside of inputs.
 * Use for screens with TextInputs that aren't in a ScrollView.
 */
export function DismissKeyboardView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Pressable style={[{ flex: 1 }, style]} onPress={Keyboard.dismiss}>
      {children}
    </Pressable>
  );
}
