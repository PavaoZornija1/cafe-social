import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type MapsModule = typeof import('react-native-maps');
const Maps = Platform.OS === 'web' ? null : (require('react-native-maps') as MapsModule);
const MapView = Maps?.default;
const Marker = Maps?.Marker;

export type MapVenuePin = {
  id: string;
  latitude: number;
  longitude: number;
  isHere: boolean;
};

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  colors: AppColors;
  venues: MapVenuePin[];
  userCoords: { lat: number; lng: number } | null;
  initialRegion: Region;
  mapHeight: number;
  recenterA11y: string;
  selectedMarkerId: string | null;
  onSelectVenue: (venueId: string) => void;
  onMapPress: () => void;
};

function PartnerVenuesMapView({
  colors,
  venues,
  userCoords,
  initialRegion,
  mapHeight,
  recenterA11y,
  selectedMarkerId,
  onSelectVenue,
  onMapPress,
}: Props) {
  const styles = useMemo(() => createStyles(colors, mapHeight), [colors, mapHeight]);
  const mapRef = useRef<InstanceType<NonNullable<typeof MapView>> | null>(null);
  const hasFittedRef = useRef(false);
  const venuesRef = useRef(venues);

  useEffect(() => {
    if (venuesRef.current !== venues) {
      venuesRef.current = venues;
      hasFittedRef.current = false;
    }
  }, [venues]);

  const fitMapToContent = useCallback(() => {
    if (Platform.OS === 'web' || !mapRef.current) return;
    const coords = venues.map((v) => ({
      latitude: v.latitude,
      longitude: v.longitude,
    }));
    if (userCoords) {
      coords.push({ latitude: userCoords.lat, longitude: userCoords.lng });
    }
    if (coords.length === 0) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 56, right: 56, bottom: 140, left: 56 },
      animated: true,
    });
  }, [userCoords, venues]);

  useEffect(() => {
    if (venues.length === 0 || hasFittedRef.current) return;
    hasFittedRef.current = true;
    fitMapToContent();
  }, [fitMapToContent, venues.length]);

  if (Platform.OS === 'web' || !MapView || !Marker) return null;

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle="light"
        onPress={onMapPress}
      >
        {venues.map((venue) => (
          <Marker
            key={venue.id}
            identifier={venue.id}
            coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
            pinColor={venue.isHere ? colors.success : colors.primary}
            selected={selectedMarkerId === venue.id}
            onPress={(e) => {
              e.stopPropagation?.();
              onSelectVenue(venue.id);
            }}
          />
        ))}
      </MapView>

      <Pressable
        style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
        onPress={() => fitMapToContent()}
        accessibilityRole="button"
        accessibilityLabel={recenterA11y}
      >
        <Ionicons name="locate" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export default memo(PartnerVenuesMapView, (prev, next) => {
  return (
    prev.venues === next.venues &&
    prev.userCoords === next.userCoords &&
    prev.initialRegion === next.initialRegion &&
    prev.mapHeight === next.mapHeight &&
    prev.colors === next.colors &&
    prev.recenterA11y === next.recenterA11y &&
    prev.selectedMarkerId === next.selectedMarkerId &&
    prev.onSelectVenue === next.onSelectVenue &&
    prev.onMapPress === next.onMapPress
  );
});

function createStyles(colors: AppColors, mapHeight: number) {
  return StyleSheet.create({
    wrap: {
      height: mapHeight,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginVertical: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    locateBtn: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    pressed: { opacity: 0.85 },
  });
}
