import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

import { useTheme } from '@/contexts/ThemeContext';
import { MAPTILER_API_KEY } from '@/lib/constants';

interface HouseMarker {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface SessionMapProps {
  coordinates: { latitude: number; longitude: number }[];
  houses?: HouseMarker[];
  center?: { latitude: number; longitude: number };
  showCurrentLocation?: boolean;
  style?: object;
}

const TILE_URL = MAPTILER_API_KEY
  ? `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
  : undefined;

export function SessionMap({
  coordinates,
  houses = [],
  center,
  showCurrentLocation = false,
  style,
}: SessionMapProps) {
  const theme = useTheme();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const allCoords = [
      ...coordinates,
      ...houses.map((h) => ({ latitude: h.latitude, longitude: h.longitude })),
    ];
    if (allCoords.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(allCoords, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [coordinates.length, houses.length]);

  const region = center || (coordinates.length > 0 ? coordinates[0] : undefined);
  const defaultRegion = region
    ? {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
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
          borderRadius: theme.borderRadius.lg,
          backgroundColor: theme.colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
            },
            android: { elevation: 4 },
          }),
        },
        map: { width: '100%', height: '100%', minHeight: 200, borderRadius: theme.borderRadius.lg },
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
          <>
            <Polyline
              coordinates={coordinates}
              strokeColor={theme.dark ? '#0a0a0a' : '#ffffff'}
              strokeWidth={10}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
            <Polyline
              coordinates={coordinates}
              strokeColor={theme.colors.primary}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
              geodesic
            />
          </>
        )}
        {coordinates.length >= 1 && (
          <Marker
            coordinate={coordinates[0]}
            title="Start"
            pinColor="green"
          />
        )}
        {coordinates.length >= 2 &&
          (coordinates[0].latitude !== coordinates[coordinates.length - 1].latitude ||
            coordinates[0].longitude !== coordinates[coordinates.length - 1].longitude) && (
          <Marker
            coordinate={coordinates[coordinates.length - 1]}
            title="End"
            pinColor="red"
          />
        )}
        {houses.map((h) => (
          <Marker
            key={h.id}
            coordinate={{ latitude: h.latitude, longitude: h.longitude }}
            title={h.name}
            pinColor="purple"
          />
        ))}
      </MapView>
    </View>
  );
}
