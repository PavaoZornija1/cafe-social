import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import VenueNearbyCard from '../components/venues/VenueNearbyCard';
import VenuesFilterChips, {
  type VenuesFilterKey,
} from '../components/venues/VenuesFilterChips';
import type { FriendAtVenueRow } from '../components/home/types';
import { apiGet } from '../lib/api';
import {
  formatDistanceKm,
  haversineKm,
  walkMinutesFromKm,
} from '../lib/geo';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import {
  fetchDiscoveryVenuePins,
  type DiscoveryMapFilters,
  type DiscoveryVenuePin,
} from '../lib/venueDiscoveryClient';
import type { TabScreenProps } from '../navigation/screenProps';
import { useIsTabRoot } from '../navigation/useIsTabRoot';
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

type Props = TabScreenProps<'VenuesTab'>;

type UserCoords = { lat: number; lng: number };

type VenueEnrichment = {
  offerLabel: string | null;
  friendsHere: FriendAtVenueRow[];
};

type EnrichedVenue = DiscoveryVenuePin & {
  distanceKm: number | null;
  walkMin: number | null;
  area: string | null;
  isHere: boolean;
  offerLabel: string | null;
  friendsHere: FriendAtVenueRow[];
};

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MAP_HEIGHT = 220;
const ENRICH_LIMIT = 12;
const NEAR_ME_RADIUS_KM = 25;

const Maps = Platform.OS === 'web' ? null : require('react-native-maps');
const MapView = Maps?.default;
const Marker = Maps?.Marker;

function regionFromVenues(venues: DiscoveryVenuePin[], userCoords: UserCoords | null): Region {
  const latLngs: { lat: number; lng: number }[] = venues.map((v) => ({
    lat: v.latitude,
    lng: v.longitude,
  }));
  if (userCoords) {
    latLngs.push(userCoords);
  }
  if (latLngs.length === 0) {
    return {
      latitude: 43.8563,
      longitude: 18.4131,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
  }
  let minLat = latLngs[0].lat;
  let maxLat = latLngs[0].lat;
  let minLng = latLngs[0].lng;
  let maxLng = latLngs[0].lng;
  for (const p of latLngs) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const pad = 0.04;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + pad, 0.06),
    longitudeDelta: Math.max(maxLng - minLng + pad, 0.06),
  };
}

async function resolveUserCoords(requestLocation: boolean): Promise<UserCoords | null> {
  if (!requestLocation) return null;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const pos = await Location.getCurrentPositionAsync({});
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

async function fetchVenueEnrichment(
  venueId: string,
  token: string | null,
): Promise<VenueEnrichment> {
  const [card, friendsPayload] = await Promise.all([
    apiGet<{
      offers: { title: string; isFeatured: boolean; globallyExhausted: boolean }[];
      featuredOffer: { title: string | null } | null;
    }>(`/venues/${encodeURIComponent(venueId)}/public-card`).catch(() => null),
    token
      ? apiGet<{ friends: FriendAtVenueRow[] }>(
            `/social/venues/${encodeURIComponent(venueId)}/friends-at-venue`,
            token,
        ).catch(() => ({ friends: [] }))
      : Promise.resolve({ friends: [] }),
  ]);

  let offerLabel: string | null = null;
  if (card) {
    const featured = card.featuredOffer?.title?.trim();
    const firstOffer = card.offers.find((o) => !o.globallyExhausted);
    offerLabel = featured || firstOffer?.title?.trim() || null;
  }

  const friendsHere = Array.isArray(friendsPayload.friends)
    ? friendsPayload.friends.filter((f) => f.hereNow)
    : [];

  return { offerLabel, friendsHere };
}

export default function PartnerVenuesMapScreen({ navigation }: Props) {
  const isTabRoot = useIsTabRoot('VenuesTab');
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const mapRef = useRef<InstanceType<NonNullable<typeof MapView>> | null>(null);
  const [venues, setVenues] = useState<DiscoveryVenuePin[]>([]);
  const [enrichment, setEnrichment] = useState<Record<string, VenueEnrichment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [detectedVenueId, setDetectedVenueId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<VenuesFilterKey, boolean>>({
    nearMe: true,
    hasOffer: false,
    friends: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await resolveUserCoords(filters.nearMe);
      setUserCoords(coords);

      if (filters.nearMe && !coords) {
        setError(t('partnerMap.locationDenied'));
        setVenues([]);
        return;
      }

      const built: DiscoveryMapFilters = {
        hasActiveOffer: filters.hasOffer ? true : undefined,
      };
      if (coords && filters.nearMe) {
        built.lat = coords.lat;
        built.lng = coords.lng;
        built.radiusKm = NEAR_ME_RADIUS_KM;
      }

      const [list, detected] = await Promise.all([
        fetchDiscoveryVenuePins(Object.keys(built).length ? built : undefined),
        fetchDetectedVenue().catch(() => ({ venue: null, coords: null })),
      ]);

      setVenues(list);
      setDetectedVenueId(detected.venue?.id ?? null);
      if (detected.coords && !coords) {
        setUserCoords({ lat: detected.coords.lat, lng: detected.coords.lng });
      }
    } catch (e) {
      setError((e as Error).message ?? t('partnerMap.loadError'));
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, [filters.hasOffer, filters.nearMe, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    async function enrichTopVenues() {
      if (venues.length === 0) {
        setEnrichment({});
        return;
      }

      const token = isLoaded ? await getTokenRef.current() : null;
      const sorted = [...venues].sort((a, b) => {
        if (!userCoords) return a.name.localeCompare(b.name);
        const da = haversineKm(userCoords.lat, userCoords.lng, a.latitude, a.longitude);
        const db = haversineKm(userCoords.lat, userCoords.lng, b.latitude, b.longitude);
        return da - db;
      });

      const targets = sorted.slice(0, ENRICH_LIMIT);
      const entries = await Promise.all(
        targets.map(async (v) => {
          const data = await fetchVenueEnrichment(v.id, token);
          return [v.id, data] as const;
        }),
      );

      if (!cancelled) {
        setEnrichment(Object.fromEntries(entries));
      }
    }

    void enrichTopVenues();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, userCoords, venues]);

  useEffect(() => {
    if (Platform.OS === 'web' || venues.length === 0 || !mapRef.current) return;
    const coords = venues.map((v) => ({
      latitude: v.latitude,
      longitude: v.longitude,
    }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 24, right: 24, bottom: 24, left: 24 },
      animated: true,
    });
  }, [venues]);

  const toggleFilter = (key: VenuesFilterKey) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  };

  const enrichedVenues = useMemo((): EnrichedVenue[] => {
    return venues.map((v) => {
      const distanceKm = userCoords
        ? haversineKm(userCoords.lat, userCoords.lng, v.latitude, v.longitude)
        : null;
      const extra = enrichment[v.id];
      return {
        ...v,
        distanceKm,
        walkMin: distanceKm != null ? walkMinutesFromKm(distanceKm) : null,
        area: v.city?.trim() || v.address?.split(',')[0]?.trim() || null,
        isHere: detectedVenueId === v.id,
        offerLabel: extra?.offerLabel ?? (v.hasActiveOffer ? t('partnerMap.offerFallback') : null),
        friendsHere: extra?.friendsHere ?? [],
      };
    });
  }, [detectedVenueId, enrichment, t, userCoords, venues]);

  const displayedVenues = useMemo(() => {
    let list = enrichedVenues;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => v.name.toLowerCase().includes(q));
    }

    if (filters.friends) {
      list = list.filter((v) => v.friendsHere.length > 0);
    }

    list = [...list].sort((a, b) => {
      if (a.isHere && !b.isHere) return -1;
      if (!a.isHere && b.isHere) return 1;
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [enrichedVenues, filters.friends, searchQuery]);

  const initialRegion = useMemo(
    () => regionFromVenues(venues, userCoords),
    [userCoords, venues],
  );

  const openVenue = useCallback(
    (venue: EnrichedVenue) => {
      setSelectedId(venue.id);
      navigation.navigate('VenueHub', {
        venueId: venue.id,
        venueName: venue.name,
      });
    },
    [navigation],
  );

  const renderListItem = useCallback(
    ({ item }: { item: EnrichedVenue }) => (
      <VenueNearbyCard
        colors={colors}
        name={item.name}
        area={item.area}
        distanceLabel={item.distanceKm != null ? formatDistanceKm(item.distanceKm) : null}
        walkMin={item.walkMin}
        isHere={item.isHere}
        offerLabel={item.isHere ? null : item.offerLabel}
        friendsHere={item.friendsHere}
        selected={selectedId === item.id}
        onPress={() => openVenue(item)}
      />
    ),
    [colors, openVenue, selectedId],
  );

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.headerRow}>
          {!isTabRoot ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}
          <View style={styles.headerSpacer} />
          <Pressable
            onPress={() => navigation.navigate('DiscoverHub')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('home.navDiscoverHub')}
          >
            <Ionicons name="compass-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('partnerMap.refreshA11y')}
          >
            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.title}>{t('partnerMap.title')}</Text>
        <Text style={styles.subtitle}>{t('partnerMap.subtitle')}</Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('partnerMap.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <VenuesFilterChips colors={colors} active={filters} onToggle={toggleFilter} />

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>{t('partnerMap.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBlock}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void load()}>
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : venues.length === 0 ? (
          <View style={styles.centerBlock}>
            <Text style={styles.muted}>{t('partnerMap.empty')}</Text>
          </View>
        ) : Platform.OS === 'web' || !MapView ? (
          <Text style={styles.webHint}>{t('partnerMap.webListHint')}</Text>
        ) : (
          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={initialRegion}
              showsUserLocation
              showsMyLocationButton={Platform.OS === 'android'}
            >
              {venues.map((v) => (
                <Marker
                  key={v.id}
                  coordinate={{ latitude: v.latitude, longitude: v.longitude }}
                  pinColor={v.hasActiveOffer ? colors.xp : colors.primary}
                  onPress={() => setSelectedId(v.id)}
                />
              ))}
            </MapView>
          </View>
        )}

        {!loading && !error && venues.length > 0 ? (
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.listTitle}>{t('partnerMap.nearbyTitle')}</Text>
              <Text style={styles.listCount}>
                {t('partnerMap.nearbyCount', { count: displayedVenues.length })}
              </Text>
            </View>
            <Text style={styles.sortLabel}>{t('partnerMap.sortDistance')}</Text>
          </View>
        ) : null}
      </>
    ),
    [
      colors,
      displayedVenues.length,
      error,
      filters,
      initialRegion,
      isTabRoot,
      load,
      loading,
      navigation,
      searchQuery,
      t,
      toggleFilter,
      venues,
    ],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={loading || error ? [] : displayedVenues}
        keyExtractor={(v) => v.id}
        renderItem={renderListItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.listGap} />}
        ListEmptyComponent={
          !loading && !error && venues.length > 0 ? (
            <Text style={styles.muted}>{t('partnerMap.emptyFiltered')}</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.md,
      marginBottom: spacing.sm,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    iconBtnPlaceholder: { width: 44 },
    headerSpacer: { flex: 1 },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
      paddingVertical: 0,
    },
    mapWrap: {
      height: MAP_HEIGHT,
      borderRadius: radii.lg,
      overflow: 'hidden',
      marginVertical: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
    errorText: { color: colors.error, textAlign: 'center', fontSize: 14 },
    retryBtn: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
    },
    retryBtnText: { color: colors.primaryDark, fontWeight: '700' },
    webHint: {
      color: colors.textMuted,
      fontSize: 13,
      marginVertical: spacing.md,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    listTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    listCount: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    sortLabel: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    listGap: { height: spacing.md },
    pressed: { opacity: 0.85 },
  });
}
