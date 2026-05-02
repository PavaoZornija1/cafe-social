import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerVenueQueue'>;

type QueuePoll = {
  status: 'idle' | 'waiting' | 'matched';
  sessionId?: string;
  position?: number;
};

export default function BrawlerVenueQueueScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { venueId, ranked = false, brawlerHeroId } = route.params;
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<QueuePoll | null>(null);
  const [enrolling, setEnrolling] = useState(true);
  const enrolledRef = useRef(false);
  const navigatedRef = useRef(false);

  const pollOnce = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const q = new URLSearchParams({ venueId });
    const s = await apiGet<QueuePoll>(`/brawler/queue/me?${q.toString()}`, token);
    setPoll(s);
    if (s.status === 'matched' && s.sessionId && !navigatedRef.current) {
      navigatedRef.current = true;
      navigation.replace('BrawlerArena', {
        heroId: brawlerHeroId,
        venueId,
        sessionId: s.sessionId,
      });
    }
  }, [venueId, brawlerHeroId, navigation]);

  useEffect(() => {
    if (!isLoaded || enrolledRef.current) return;
    enrolledRef.current = true;
    let cancelled = false;
    async function enroll() {
      setEnrolling(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error(t('qr.notAuthenticated'));
        const { venue, coords } = await fetchDetectedVenue();
        if (cancelled) return;
        if (!coords || venue?.id !== venueId) {
          throw new Error(t('wordMatch.needPresenceToCreate'));
        }
        await apiPost<QueuePoll>(
          '/brawler/queue/enqueue',
          {
            venueId,
            latitude: coords.lat,
            longitude: coords.lng,
            brawlerHeroId,
            ...(ranked ? { ranked: true } : {}),
          },
          token,
        );
        if (cancelled) return;
        await pollOnce();
      } catch (e) {
        enrolledRef.current = false;
        if (!cancelled) setError((e as Error).message || t('brawlerMatch.queueEnqueueFailed'));
      } finally {
        if (!cancelled) setEnrolling(false);
      }
    }
    void enroll();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, venueId, brawlerHeroId, ranked, t, pollOnce]);

  useEffect(() => {
    if (enrolling || error || !isLoaded) return;
    const tmr = setInterval(() => {
      void pollOnce();
    }, 2500);
    return () => clearInterval(tmr);
  }, [enrolling, error, isLoaded, pollOnce]);

  const onLeave = () => {
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (token) {
          await apiPost('/brawler/queue/leave', { venueId }, token);
        }
      } catch {
        /* */
      }
      enrolledRef.current = false;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Home');
    })();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navHeader}>
        <Pressable onPress={onLeave} style={styles.navBack}>
          <Text style={styles.navBackText}>{t('common.back')}</Text>
        </Pressable>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>{t('brawlerMatch.queueTitle')}</Text>
        <Text style={styles.sub}>{t('brawlerMatch.queueSubtitle')}</Text>
        {ranked ? <Text style={styles.badge}>{t('brawlerMatch.rankedBadge')}</Text> : null}
        {enrolling ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.muted}>{t('brawlerMatch.queueJoining')}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.btn} onPress={onLeave}>
              <Text style={styles.btnText}>{t('common.back')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.muted}>
              {poll?.status === 'waiting' && poll.position != null
                ? t('brawlerMatch.queuePosition', { n: poll.position })
                : t('brawlerMatch.queueSearching')}
            </Text>
          </View>
        )}
        {!enrolling && !error ? (
          <Pressable style={styles.link} onPress={onLeave}>
            <Text style={styles.linkText}>{t('brawlerMatch.queueLeave')}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    navHeader: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    navBack: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    navBackText: { color: colors.textSecondary, fontWeight: '600' },
    container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: '900' },
    sub: { color: colors.textMuted, marginTop: 8, fontSize: 14, lineHeight: 20 },
    badge: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.honeyMuted,
      color: colors.honeyDark,
      fontWeight: '900',
      fontSize: 12,
    },
    center: { marginTop: 32, alignItems: 'center', gap: 14 },
    muted: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
    error: { color: colors.error, fontWeight: '700', textAlign: 'center' },
    btn: {
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    btnText: { color: colors.text, fontWeight: '800' },
    link: { marginTop: 28, alignItems: 'center' },
    linkText: { color: colors.textMuted, fontWeight: '700' },
  });
}
