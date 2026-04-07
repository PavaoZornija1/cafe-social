import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import {
  fetchDiscoveryVenuePins,
  type DiscoveryMapFilters,
  type DiscoveryVenuePin,
} from '../lib/venueDiscoveryClient';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerVenuesMap'>;

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

function regionFromVenues(venues: DiscoveryVenuePin[]): Region {
  if (venues.length === 0) {
    return {
      latitude: 43.8563,
      longitude: 18.4131,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    };
  }
  let minLat = venues[0].latitude;
  let maxLat = venues[0].latitude;
  let minLng = venues[0].longitude;
  let maxLng = venues[0].longitude;
  for (const v of venues) {
    minLat = Math.min(minLat, v.latitude);
    maxLat = Math.max(maxLat, v.latitude);
    minLng = Math.min(minLng, v.longitude);
    maxLng = Math.max(maxLng, v.longitude);
  }
  const pad = 0.04;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + pad, 0.06),
    longitudeDelta: Math.max(maxLng - minLng + pad, 0.06),
  };
}

function openMapsApp(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(`${lat},${lng}(${label})`);
  const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
  void Linking.openURL(url);
}

function formatAddress(v: DiscoveryVenuePin): string {
  const parts = [v.address, v.city, v.country].filter(Boolean) as string[];
  return parts.join(', ');
}

function buildFilters(params: {
  typeCodesRaw: string;
  radiusKmRaw: string;
  hasOfferOnly: boolean;
  nearMe: boolean;
}): Promise<{ filters?: DiscoveryMapFilters; locDenied?: boolean }> {
  const codes = params.typeCodesRaw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const base: DiscoveryMapFilters = {
    venueTypeCodes: codes.length ? codes : undefined,
    hasActiveOffer: params.hasOfferOnly ? true : undefined,
  };
  const hasAny =
    (base.venueTypeCodes?.length ?? 0) > 0 ||
    base.hasActiveOffer ||
    params.nearMe;
  if (!params.nearMe) {
    return Promise.resolve({
      filters: hasAny ? { ...base } : undefined,
    });
  }
  return (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { locDenied: true };
    }
    const pos = await Location.getCurrentPositionAsync({});
    let rKm = Number.parseFloat(params.radiusKmRaw);
    if (!Number.isFinite(rKm) || rKm <= 0) rKm = 25;
    return {
      filters: {
        ...base,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm: rKm,
      },
    };
  })();
}

const Maps = Platform.OS === 'web' ? null : require('react-native-maps');
const MapView = Maps?.default;
const Marker = Maps?.Marker;

export default function PartnerVenuesMapScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const mapRef = useRef<InstanceType<NonNullable<typeof MapView>> | null>(null);
  const [venues, setVenues] = useState<DiscoveryVenuePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DiscoveryVenuePin | null>(null);
  const [typeCodesRaw, setTypeCodesRaw] = useState('');
  const [radiusKmRaw, setRadiusKmRaw] = useState('25');
  const [hasOfferOnly, setHasOfferOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const built = await buildFilters({
        typeCodesRaw,
        radiusKmRaw,
        hasOfferOnly,
        nearMe,
      });
      if (built.locDenied) {
        setError(t('partnerMap.locationDenied'));
        setVenues([]);
        setSelected(null);
        return;
      }
      const list = await fetchDiscoveryVenuePins(built.filters);
      setVenues(list);
      setSelected(list.length === 1 ? (list[0] ?? null) : null);
    } catch (e) {
      setError((e as Error).message ?? t('partnerMap.loadError'));
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }, [t, typeCodesRaw, radiusKmRaw, hasOfferOnly, nearMe]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (Platform.OS === 'web' || venues.length === 0 || !mapRef.current) return;
    const coords = venues.map((v) => ({
      latitude: v.latitude,
      longitude: v.longitude,
    }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 72, right: 32, bottom: 220, left: 32 },
      animated: false,
    });
  }, [venues]);

  const initialRegion = useMemo(() => regionFromVenues(venues), [venues]);

  const renderWebRow = useCallback(
    ({ item }: { item: DiscoveryVenuePin }) => (
      <Pressable
        style={({ pressed }) => [styles.webRow, pressed && styles.webRowPressed]}
        onPress={() => setSelected(item)}
      >
        <Text style={styles.webRowTitle}>
          {item.name}
          {item.isPremium ? t('home.premiumSuffix') : ''}
          {item.hasActiveOffer ? ' · ✨' : ''}
        </Text>
        {formatAddress(item) ? (
          <Text style={styles.webRowSub}>{formatAddress(item)}</Text>
        ) : null}
      </Pressable>
    ),
    [t],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('partnerMap.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('partnerMap.subtitle')}</Text>

      <View style={styles.filters}>
        <Text style={styles.filtersTitle}>{t('partnerMap.filtersTitle')}</Text>
        <TextInput
          value={typeCodesRaw}
          onChangeText={setTypeCodesRaw}
          placeholder={t('partnerMap.venueTypesPlaceholder')}
          placeholderTextColor="#64748b"
          style={styles.filterInput}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('partnerMap.nearMe')}</Text>
          <Switch
            value={nearMe}
            onValueChange={setNearMe}
            trackColor={{ false: '#334155', true: '#4338ca' }}
            thumbColor="#e2e8f0"
          />
        </View>
        {nearMe ? (
          <TextInput
            value={radiusKmRaw}
            onChangeText={setRadiusKmRaw}
            placeholder={t('partnerMap.radiusKm')}
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
            style={styles.filterInput}
          />
        ) : null}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t('partnerMap.activeOfferOnly')}</Text>
          <Switch
            value={hasOfferOnly}
            onValueChange={setHasOfferOnly}
            trackColor={{ false: '#334155', true: '#4338ca' }}
            thumbColor="#e2e8f0"
          />
        </View>
        <Pressable style={styles.applyBtn} onPress={() => void load()}>
          <Text style={styles.applyBtnText}>{t('partnerMap.applyFilters')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.muted}>{t('partnerMap.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : venues.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('partnerMap.empty')}</Text>
        </View>
      ) : Platform.OS === 'web' || !MapView ? (
        <FlatList
          style={styles.listFlex}
          data={venues}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.list}
          renderItem={renderWebRow}
          ListHeaderComponent={
            <Text style={styles.webHint}>{t('partnerMap.webListHint')}</Text>
          }
        />
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={venues.length ? initialRegion : undefined}
            showsUserLocation
            showsMyLocationButton={Platform.OS === 'android'}
          >
            {venues.map((v) => (
              <Marker
                key={v.id}
                coordinate={{ latitude: v.latitude, longitude: v.longitude }}
                title={v.name}
                description={formatAddress(v) || undefined}
                onPress={() => setSelected(v)}
              />
            ))}
          </MapView>
        </View>
      )}

      {selected ? (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            {selected.name}
            {selected.isPremium ? t('home.premiumSuffix') : ''}
            {selected.hasActiveOffer ? ' · offer' : ''}
          </Text>
          {formatAddress(selected) ? (
            <Text style={styles.sheetAddr}>{formatAddress(selected)}</Text>
          ) : null}
          <Text style={styles.sheetHint}>{t('partnerMap.hintAtVenue')}</Text>
          <View style={styles.sheetActions}>
            <Pressable
              style={({ pressed }) => [styles.sheetBtn, pressed && styles.sheetBtnPressed]}
              onPress={() => openMapsApp(selected.latitude, selected.longitude, selected.name)}
            >
              <Text style={styles.sheetBtnText}>{t('partnerMap.openInMaps')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetBtnSecondary, pressed && styles.sheetBtnPressed]}
              onPress={() =>
                navigation.navigate('QrScan', {
                  venueId: selected.id,
                })
              }
            >
              <Text style={styles.sheetBtnSecondaryText}>{t('partnerMap.checkInQr')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  subtitle: {
    color: '#94a3b8',
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  filters: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  filtersTitle: { color: '#e2e8f0', fontWeight: '700', fontSize: 13 },
  filterInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filterLabel: { color: '#94a3b8', fontSize: 14, flex: 1 },
  applyBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  muted: { color: '#64748b', textAlign: 'center' },
  errorText: { color: '#fca5a5', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#e0e7ff', fontWeight: '700' },
  mapWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 },
  sheet: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetAddr: { color: '#94a3b8', marginTop: 6, fontSize: 14 },
  sheetHint: { color: '#64748b', marginTop: 10, fontSize: 13, lineHeight: 18 },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  sheetBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetBtnSecondary: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sheetBtnPressed: { opacity: 0.85 },
  sheetBtnText: { color: '#fff', fontWeight: '700' },
  sheetBtnSecondaryText: { color: '#cbd5e1', fontWeight: '700' },
  listFlex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  webHint: { color: '#64748b', marginBottom: 12, fontSize: 13 },
  webRow: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  webRowPressed: { opacity: 0.9 },
  webRowTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  webRowSub: { color: '#94a3b8', marginTop: 4, fontSize: 14 },
});
