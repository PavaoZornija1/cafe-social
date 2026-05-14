import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Challenges'>;

type Venue = { id: string; name: string; isPremium: boolean };

type VenueChallenge = {
  id: string;
  title: string;
  description: string | null;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  targetCount: number;
  progressCount: number;
  isCompleted: boolean;
  resetsWeekly?: boolean;
  rewardPerkId: string | null;
  rewardTitle: string | null;
};

export default function ChallengesScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const routeVenueId = route.params?.venueId;
  const routeVenueName = route.params?.venueName;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<VenueChallenge[]>([]);
  const [progressingId, setProgressingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        if (!isLoaded) return;

        if (routeVenueId) {
          setVenue({
            id: routeVenueId,
            name: routeVenueName?.trim() || routeVenueId,
            isPremium: false,
          });
          const token = await getTokenRef.current();
          if (!token) throw new Error('Not authenticated');
          const list = await apiGet<VenueChallenge[]>(
            `/venue-context/${encodeURIComponent(routeVenueId)}/challenges`,
            token,
          );
          if (cancelled) return;
          setChallenges(list);
          return;
        }

        const { venue } = await fetchDetectedVenue();
        if (cancelled) return;
        setVenue(venue);

        if (!venue) {
          setChallenges([]);
          return;
        }

        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const list = await apiGet<VenueChallenge[]>(
          `/venue-context/${encodeURIComponent(venue.id)}/challenges`,
          token,
        );
        if (cancelled) return;
        setChallenges(list);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || tRef.current('challenges.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, routeVenueId, routeVenueName]);

  const increment = async (challengeId: string) => {
    if (!venue) return;
    if (!isLoaded) return;

    setProgressingId(challengeId);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const ch = challenges.find((x) => x.id === challengeId);
      const needHigh = Boolean(ch?.locationRequired || ch?.rewardVenueSpecific);
      const { coords } = await fetchDetectedVenue({
        locationAccuracy: needHigh ? 'high' : 'balanced',
      });

      await apiPost<void>(
        `/venue-context/${encodeURIComponent(venue.id)}/challenges/${encodeURIComponent(challengeId)}/progress`,
        { increment: 1, latitude: coords?.lat, longitude: coords?.lng },
        token,
      );

      const list = await apiGet<VenueChallenge[]>(
        `/venue-context/${encodeURIComponent(venue.id)}/challenges`,
        token,
      );
      setChallenges(list);
    } catch (e) {
      setError((e as Error).message || 'Failed to progress challenge');
    } finally {
      setProgressingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('challenges.title')}</Text>
      </View>
      <View style={styles.container}>
        {venue ? <Text style={styles.venueName}>{venue.name}</Text> : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.placeholder}>{t('challenges.loading')}</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : challenges.length === 0 ? (
          <Text style={styles.placeholder}>{t('challenges.empty')}</Text>
        ) : (
          challenges.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardBadge}>
                  {c.isCompleted ? t('challenges.done') : t('challenges.inProgress')}
                </Text>
              </View>
              {c.description ? <Text style={styles.cardDesc}>{c.description}</Text> : null}
              <Text style={styles.cardProgress}>
                {t('challenges.progress', { current: c.progressCount, target: c.targetCount })}
              </Text>
              <Text style={styles.cardHint}>
                {c.locationRequired || c.rewardVenueSpecific
                  ? t('challenges.requiresAtCafe')
                  : t('challenges.worksFromHome')}
              </Text>
              {c.resetsWeekly ? <Text style={styles.cardWeekly}>{t('challenges.weekly')}</Text> : null}
              {c.rewardTitle ? (
                <Text style={styles.cardReward}>{t('challenges.rewardLine', { title: c.rewardTitle })}</Text>
              ) : null}

              <Pressable
                disabled={!!progressingId && progressingId !== c.id}
                onPress={() => increment(c.id)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Text style={styles.actionText}>
                  {progressingId === c.id ? t('challenges.updating') : t('challenges.progressCta')}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 4,
    },
    back: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    backText: { color: colors.textSecondary, fontWeight: '600' },
    headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
    container: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
    venueName: { color: colors.textMuted, marginTop: 8, fontSize: 14, fontWeight: '600' },
    placeholder: {
      color: colors.textMuted,
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    error: { color: colors.error, marginTop: 10, fontSize: 14, lineHeight: 20 },
    center: { alignItems: 'center', marginTop: 16, gap: 10 },
    card: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900', flex: 1, paddingRight: 10 },
    cardBadge: {
      color: colors.honey,
      fontWeight: '900',
      backgroundColor: colors.surface,
      borderColor: '#182238',
      borderWidth: 1,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      fontSize: 12,
      marginTop: 2,
    },
    cardDesc: { color: colors.textMuted, marginTop: 8, fontSize: 13, lineHeight: 18 },
    cardProgress: { color: colors.textSecondary, marginTop: 10, fontSize: 14, fontWeight: '800' },
    cardHint: { color: colors.honeyDark, marginTop: 6, fontSize: 13, fontWeight: '700' },
    cardWeekly: { color: '#fbbf24', marginTop: 6, fontSize: 12, fontWeight: '700' },
    cardReward: { color: colors.textSecondary, marginTop: 8, fontSize: 13, fontWeight: '700', lineHeight: 18 },
    actionBtn: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: '#182238',
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
    },
    actionBtnPressed: { opacity: 0.9 },
    actionText: { color: colors.textMuted, fontWeight: '900' },
  });
}
