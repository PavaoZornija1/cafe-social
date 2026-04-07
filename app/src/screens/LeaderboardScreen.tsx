import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

type Row = {
  venueXp: number;
  player: { id: string; username: string };
};

type Scope = 'venue' | 'city' | 'country' | 'global';

export default function LeaderboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('venue');
  const [venueName, setVenueName] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setHint(null);
    try {
      const { venue: detected } = await fetchDetectedVenue();
      setVenueId(detected?.id ?? null);
      setVenueName(detected?.name ?? null);
      setDetectedCity(detected?.city?.trim() || null);
      setDetectedCountry(detected?.country?.trim() || null);

      const token = await getTokenRef.current();
      if (!token) {
        setRows([]);
        setMeId(null);
        setHint(t('leaderboard.signInForRankings'));
        return;
      }

      const summary = await apiGet<{ playerId: string }>('/players/me/summary', token);
      setMeId(summary.playerId);

      if (scope === 'venue') {
        if (!detected?.id) {
          setRows([]);
          setHint(t('leaderboard.emptyVenue'));
          return;
        }
        const board = await apiGet<Row[]>(
          `/venues/${encodeURIComponent(detected.id)}/leaderboard/xp`,
          token,
        );
        setRows(board);
        return;
      }

      if (scope === 'global') {
        const board = await apiGet<Row[]>('/venues/leaderboard/xp/global', token);
        setRows(board);
        return;
      }

      if (scope === 'country') {
        const cc = detected?.country?.trim();
        if (!cc) {
          setRows([]);
          setHint(t('leaderboard.needCountry'));
          return;
        }
        const board = await apiGet<Row[]>(
          `/venues/leaderboard/xp/country/${encodeURIComponent(cc)}`,
          token,
        );
        setRows(board);
        return;
      }

      const city = detected?.city?.trim();
      const country = detected?.country?.trim();
      if (!city || !country) {
        setRows([]);
        setHint(t('leaderboard.needCityCountry'));
        return;
      }
      const board = await apiGet<Row[]>(
        `/venues/leaderboard/xp/city?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
        token,
      );
      setRows(board);
    } catch {
      setRows([]);
      setHint(t('leaderboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [isLoaded, scope, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const scopes: { key: Scope; label: string }[] = [
    { key: 'venue', label: t('leaderboard.scopeVenue') },
    { key: 'city', label: t('leaderboard.scopeCity') },
    { key: 'country', label: t('leaderboard.scopeCountry') },
    { key: 'global', label: t('leaderboard.scopeGlobal') },
  ];

  const scopeDescription = () => {
    if (scope === 'venue') return t('leaderboard.subtitleVenue');
    if (scope === 'global') return t('leaderboard.subtitleGlobal');
    if (scope === 'country') {
      return detectedCountry
        ? t('leaderboard.subtitleCountry', { country: detectedCountry })
        : t('leaderboard.subtitleCountryGeneric');
    }
    if (detectedCity && detectedCountry) {
      return t('leaderboard.subtitleCity', { city: detectedCity, country: detectedCountry });
    }
    return t('leaderboard.subtitleCityGeneric');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
      </View>

      <Text style={styles.subtitle}>{scopeDescription()}</Text>

      <View style={styles.tabs}>
        {scopes.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setScope(key)}
            style={[styles.tab, scope === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, scope === key && styles.tabTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {scope === 'venue' && venueId ? (
        <Text style={styles.venueLine}>{venueName ?? venueId}</Text>
      ) : null}

      {hint && !loading ? <Text style={styles.placeholder}>{hint}</Text> : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : !hint || rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.player.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !hint ? (
              <Text style={styles.placeholder}>{t('leaderboard.emptyBoard')}</Text>
            ) : null
          }
          renderItem={({ item, index }) => {
            const isMe = meId != null && item.player.id === meId;
            const canReport =
              scope === 'venue' &&
              Boolean(venueId) &&
              meId != null &&
              !isMe;
            return (
              <View style={[styles.row, isMe && styles.rowMe]}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <View style={styles.rowMid}>
                  <Text style={styles.name}>
                    {item.player.username}
                    {isMe ? ` (${t('leaderboard.you')})` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.xp}>
                    {item.venueXp} {t('leaderboard.xp')}
                  </Text>
                  {canReport ? (
                    <Pressable
                      onPress={() =>
                        navigation.navigate('ReportPlayer', {
                          venueId: venueId!,
                          venueName: venueName ?? undefined,
                          reportedPlayerId: item.player.id,
                          reportedUsername: item.player.username,
                        })
                      }
                      style={({ pressed }) => [styles.reportTap, pressed && { opacity: 0.85 }]}
                    >
                      <Text style={styles.reportTapText}>{t('leaderboard.report')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
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
    marginBottom: 8,
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
    color: '#9ca3af',
    paddingHorizontal: 24,
    marginBottom: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  tabActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e1b4b',
  },
  tabText: { color: '#9ca3af', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#e9d5ff' },
  venueLine: {
    color: '#a78bfa',
    fontWeight: '800',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  placeholder: {
    color: '#9ca3af',
    marginTop: 4,
    paddingHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  rowMe: { borderColor: '#6d28d9' },
  rank: { color: '#6b7280', fontWeight: '800', width: 36 },
  rowMid: { flex: 1 },
  name: { color: '#f9fafb', fontWeight: '700' },
  rowRight: { alignItems: 'flex-end', gap: 6, maxWidth: '42%' },
  xp: { color: '#e9d5ff', fontWeight: '800', textAlign: 'right' },
  reportTap: { paddingVertical: 4, paddingHorizontal: 8 },
  reportTapText: { color: '#fdba74', fontWeight: '800', fontSize: 11 },
});
