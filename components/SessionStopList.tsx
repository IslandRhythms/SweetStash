import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

export type SessionStop = {
  id: number;
  name: string;
};

export type SessionStopListProps = {
  stops: SessionStop[];
  onStopPress: (stopId: number) => void;
  style?: object;
};

/**
 * Scrollable list of map stops so users can open a house when pins overlap.
 */
export function SessionStopList({ stops, onStopPress, style }: SessionStopListProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginBottom: theme.spacing.lg,
        },
        heading: {
          fontSize: theme.fontSize.sm,
          fontWeight: '600',
          color: theme.colors.text,
          marginBottom: theme.spacing.xs,
        },
        hint: {
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
          marginBottom: theme.spacing.sm,
        },
        list: {
          maxHeight: 176,
        },
        listContent: {
          gap: theme.spacing.xs,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.md,
          minHeight: theme.minTouchTarget,
        },
        rowPressed: { opacity: 0.88 },
        indexBadge: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        indexText: {
          fontSize: theme.fontSize.sm,
          fontWeight: '700',
          color: theme.colors.textMuted,
        },
        name: {
          flex: 1,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
        },
      }),
    [theme]
  );

  if (stops.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.heading}>Stops on map</Text>
      {stops.length > 1 ? (
        <Text style={styles.hint}>Tap a stop if pins overlap on the map</Text>
      ) : null}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {stops.map((stop, index) => (
          <Pressable
            key={stop.id}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onStopPress(stop.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open stop ${index + 1}: ${stop.name}`}
          >
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <FontAwesome name="map-marker" size={16} color={theme.colors.secondary} />
            <Text style={styles.name} numberOfLines={2}>
              {stop.name}
            </Text>
            <FontAwesome name="chevron-right" size={14} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
