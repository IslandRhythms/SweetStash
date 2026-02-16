import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, UrlTile } from 'react-native-maps';

import { useTheme } from '@/contexts/ThemeContext';
import { MAPTILER_API_KEY } from '@/lib/constants';

interface SessionMapProps {
  coordinates: { latitude: number; longitude: number }[];
  center?: { latitude: number; longitude: number };
  showCurrentLocation?: boolean;
  style?: object;
}

const TILE_URL = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
  : undefined;

export function SessionMap({
  coordinates,
  center,
  showCurrentLocation = false,
  style,
}: SessionMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (coordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [coordinates.length]);

  const region = center || (coordinates.length > 0 ? coordinates[0] : undefined);
  const defaultRegion = region
    ? {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          overflow: 'hidden',
          borderRadius: theme.borderRadius.md,
        },
        map: { width: '100%', height: '100%', minHeight: 200 },
        webPlaceholder: {
          backgroundColor: theme.colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        webPlaceholderText: { color: theme.colors.textMuted },
      }),
    [theme]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style, styles.webPlaceholder]}>
        <Text style={styles.webPlaceholderText}>
          Map view is available on iOS and Android
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        region={region ? undefined : defaultRegion}
        mapType={Platform.OS === 'android' && TILE_URL ? 'none' : 'standard'}
        showsUserLocation={showCurrentLocation}
      >
        {TILE_URL && (
          <UrlTile
            urlTemplate={TILE_URL}
            shouldReplaceMapContent={Platform.OS === 'ios'}
          />
        )}
        {coordinates.length >= 2 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={theme.colors.primary}
            strokeWidth={4}
            geodesic
          />
        )}
      </MapView>
    </View>
  );
}
