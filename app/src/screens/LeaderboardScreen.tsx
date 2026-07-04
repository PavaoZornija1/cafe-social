import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

type Row = {
  venueXp: number;
  player: { id: string; username: string };
};

type Scope = 'venue' | 'city' | 'country' | 'global';

function rankMedal(index: number): keyof typeof Ionicons.glyphMap | null {
  if (index === 0) return 'medal';
  if (index === 1) return 'medal-outline';
  if (index === 2) return 'ribbon-outline';
  return null;
}

function rankAccentColor(index: number, colors: AppColors): string | null {
  if (index === 0) return colors.xp;
  if (index === 1) return colors.textSecondary;
  if (index === 2) return colors.honey;
  return null;
}

export default function LeaderboardScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const paramVenueId = route.params?.venueId;
  const paramVenueName = route.params?.venueName;
  const paramScope = route.params?.scope;

  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<Scope>(paramScope ?? 'venue');
  const [venueName, setVenueName] = useState<string | null>(paramVenueName ?? null);
  const [venueId, setVenueId] = useState<string | null>(paramVenueId ?? null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (paramScope) setScope(paramScope);
  }, [paramScope]);

  useEffect(() => {
    if (paramVenueId) setVenueId(paramVenueId);
    if (paramVenueName) setVenueName(paramVenueName);
  }, [paramVenueId, paramVenueName]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!isLoaded) return;

      const hasRows = rowsRef.current.length > 0;
      if (mode === 'initial' && !hasLoadedRef.current) {
        setInitializing(true);
      } else if (mode === 'refresh' || (mode === 'initial' && hasLoadedRef.current)) {
        setRefreshing(true);
      }
      setHint(null);

      try {
        const { venue: detected } = await fetchDetectedVenue();
        const activeVenueId = paramVenueId ?? detected?.id ?? null;
        const activeVenueName = paramVenueName ?? detected?.name ?? null;
        setVenueId(activeVenueId);
        setVenueName(activeVenueName);
        setDetectedCity(detected?.city?.trim() || null);
        setDetectedCountry(detected?.country?.trim() || null);

        const token = await getTokenRef.current();
        if (!token) {
          if (!hasRows) {
            setRows([]);
            setMeId(null);
            setHint(tRef.current('leaderboard.signInForRankings'));
          }
          return;
        }

        const summary = await apiGet<{ playerId: string }>('/players/me/summary', token);
        setMeId(summary.playerId);

        let board: Row[] = [];

        switch (scope) {
          case 'venue': {
            if (!activeVenueId) {
              setRows([]);
              setHint(tRef.current('leaderboard.emptyVenue'));
              return;
            }
            board = await apiGet<Row[]>(
              `/venues/${encodeURIComponent(activeVenueId)}/leaderboard/xp`,
              token,
            );
            break;
          }
          case 'global': {
            board = await apiGet<Row[]>('/venues/leaderboard/xp/global', token);
            break;
          }
          case 'country': {
            const cc = detected?.country?.trim();
            if (!cc) {
              setRows([]);
              setHint(tRef.current('leaderboard.needCountry'));
              return;
            }
            board = await apiGet<Row[]>(
              `/venues/leaderboard/xp/country/${encodeURIComponent(cc)}`,
              token,
            );
            break;
          }
          case 'city': {
            const city = detected?.city?.trim();
            const country = detected?.country?.trim();
            if (!city || !country) {
              setRows([]);
              setHint(tRef.current('leaderboard.needCityCountry'));
              return;
            }
            board = await apiGet<Row[]>(
              `/venues/leaderboard/xp/city?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
              token,
            );
            break;
          }
          default: {
            const _exhaustive: never = scope;
            return _exhaustive;
          }
        }

        setRows(Array.isArray(board) ? board : []);
      } catch {
        if (!hasLoadedRef.current) {
          setRows([]);
          setHint(tRef.current('leaderboard.loadError'));
        }
      } finally {
        hasLoadedRef.current = true;
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [isLoaded, paramVenueId, paramVenueName, scope],
  );

  useEffect(() => {
    if (!isLoaded) return;
    void load(hasLoadedRef.current ? 'refresh' : 'initial');
  }, [isLoaded, scope, load]);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) {
        void load('refresh');
      }
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const scopes: { key: Scope; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'venue', label: t('leaderboard.scopeVenue'), icon: 'location-outline' },
    { key: 'city', label: t('leaderboard.scopeCity'), icon: 'business-outline' },
    { key: 'country', label: t('leaderboard.scopeCountry'), icon: 'flag-outline' },
    { key: 'global', label: t('leaderboard.scopeGlobal'), icon: 'earth-outline' },
  ];

  const scopeDescription = useMemo(() => {
    switch (scope) {
      case 'venue':
        return venueName
          ? t('leaderboard.subtitleVenueNamed', { venue: venueName })
          : t('leaderboard.subtitleVenue');
      case 'global':
        return t('leaderboard.subtitleGlobal');
      case 'country':
        return detectedCountry
          ? t('leaderboard.subtitleCountry', { country: detectedCountry })
          : t('leaderboard.subtitleCountryGeneric');
      case 'city':
        return detectedCity && detectedCountry
          ? t('leaderboard.subtitleCity', { city: detectedCity, country: detectedCountry })
          : t('leaderboard.subtitleCityGeneric');
      default: {
        const _exhaustive: never = scope;
        return _exhaustive;
      }
    }
  }, [scope, venueName, detectedCity, detectedCountry, t]);

  const myRankIndex = useMemo(() => {
    if (!meId) return -1;
    return rows.findIndex((r) => r.player.id === meId);
  }, [rows, meId]);

  const showInitialSpinner = initializing && rows.length === 0 && !hint;

  const listHeader = (
    <>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('leaderboard.refreshA11y')}
        >
          {refreshing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="podium-outline" size={28} color={colors.textInverse} />
        </View>
        <Text style={styles.heroTitle}>{t('leaderboard.heroTitle')}</Text>
        <Text style={styles.heroSub}>{scopeDescription}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scopeRow}
        style={styles.scopeScroll}
      >
        {scopes.map(({ key, label, icon }) => {
          const active = scope === key;
          return (
            <Pressable
              key={key}
              onPress={() => setScope(key)}
              style={({ pressed }) => [
                styles.scopeChip,
                active && styles.scopeChipActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={icon}
                size={14}
                color={active ? colors.primaryDark : colors.textMuted}
              />
              <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {myRankIndex >= 0 ? (
        <View style={styles.myRankBanner}>
          <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.myRankText}>
            {t('leaderboard.yourRank', {
              rank: myRankIndex + 1,
              xp: rows[myRankIndex]?.venueXp ?? 0,
            })}
          </Text>
        </View>
      ) : null}

      {hint && !showInitialSpinner ? <Text style={styles.hint}>{hint}</Text> : null}

      {showInitialSpinner ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={showInitialSpinner ? [] : rows}
        keyExtractor={(item) => item.player.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !showInitialSpinner && !hint ? (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('leaderboard.emptyBoard')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const isMe = meId != null && item.player.id === meId;
          const canReport =
            scope === 'venue' && Boolean(venueId) && meId != null && !isMe;
          const medal = rankMedal(index);
          const accent = rankAccentColor(index, colors);

          return (
            <View style={[styles.row, isMe && styles.rowMe, accent != null && styles.rowTop]}>
              <View style={styles.rankCol}>
                {medal ? (
                  <Ionicons name={medal} size={20} color={accent ?? colors.textMuted} />
                ) : (
                  <Text style={styles.rankNum}>#{index + 1}</Text>
                )}
              </View>
              <View style={styles.rowMid}>
                <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
                  {item.player.username}
                  {isMe ? ` · ${t('leaderboard.you')}` : ''}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.xp}>
                  {t('venueHub.leaderboardXp', { xp: item.venueXp })}
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
                    style={({ pressed }) => [styles.reportTap, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t('leaderboard.report')}
                  >
                    <Text style={styles.reportTapText}>{t('leaderboard.report')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    pressed: { opacity: 0.88 },
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    scopeScroll: {
      marginHorizontal: -spacing.xl,
      marginBottom: spacing.md,
    },
    scopeRow: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      flexDirection: 'row',
    },
    scopeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    scopeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    scopeChipText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 13,
    },
    scopeChipTextActive: {
      color: colors.primaryDark,
    },
    myRankBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    myRankText: {
      flex: 1,
      color: colors.primaryDark,
      fontWeight: '800',
      fontSize: 14,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    centerBlock: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    rowTop: {
      borderColor: colors.border,
    },
    rowMe: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    rankCol: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankNum: {
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 13,
    },
    rowMid: { flex: 1, minWidth: 0 },
    name: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    nameMe: {
      color: colors.primaryDark,
    },
    rowRight: {
      alignItems: 'flex-end',
      gap: spacing.xs,
      maxWidth: '40%',
    },
    xp: {
      color: colors.xp,
      fontWeight: '800',
      fontSize: 13,
      textAlign: 'right',
    },
    reportTap: {
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
    },
    reportTapText: {
      color: colors.warning,
      fontWeight: '800',
      fontSize: 11,
    },
  });
}
