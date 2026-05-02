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
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'WordVenueQueue'>;

type QueuePoll = {
  status: 'idle' | 'waiting' | 'matched';
  sessionId?: string;
  position?: number;
};

export default function WordVenueQueueScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    mode,
    difficulty,
    wordCount,
    wordCategory,
    ranked = false,
  } = route.params;
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
    const s = await apiGet<QueuePoll>(`/words/matches/queue/me?${q.toString()}`, token);
    setPoll(s);
    if (s.status === 'matched' && s.sessionId && !navigatedRef.current) {
      navigatedRef.current = true;
      navigation.replace('WordMatchWait', {
        venueId,
        challengeId,
        mode,
        difficulty,
        create: false,
        sessionId: s.sessionId,
        wordCount,
        wordCategory,
        ranked: mode === 'versus' ? ranked : undefined,
      });
    }
  }, [venueId, challengeId, mode, difficulty, wordCount, wordCategory, ranked, navigation]);

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
          '/words/matches/queue/enqueue',
          {
            venueId,
            latitude: coords.lat,
            longitude: coords.lng,
            language: toApiWordLanguage(i18n.language),
            wordCount,
            difficulty,
            mode,
            ...(wordCategory ? { category: wordCategory } : {}),
            ...(mode === 'versus' && ranked ? { ranked: true } : {}),
          },
          token,
        );
        if (cancelled) return;
        await pollOnce();
      } catch (e) {
        enrolledRef.current = false;
        if (!cancelled) setError((e as Error).message || t('wordMatch.queueEnqueueFailed'));
      } finally {
        setEnrolling(false);
      }
    }
    void enroll();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, venueId, wordCount, difficulty, mode, wordCategory, ranked, t, i18n.language, pollOnce]);

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
          await apiPost('/words/matches/queue/leave', { venueId }, token);
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
        <Text style={styles.title}>{t('wordMatch.queueTitle')}</Text>
        <Text style={styles.sub}>{t('wordMatch.queueSubtitle')}</Text>
        {mode === 'versus' && ranked ? (
          <Text style={styles.badge}>{t('wordMatch.rankedBadge')}</Text>
        ) : null}
        {enrolling ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.muted}>{t('wordMatch.queueJoining')}</Text>
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
                ? t('wordMatch.queuePosition', { n: poll.position })
                : t('wordMatch.queueSearching')}
            </Text>
          </View>
        )}
        {!enrolling && !error ? (
          <Pressable style={styles.link} onPress={onLeave}>
            <Text style={styles.linkText}>{t('wordMatch.queueLeave')}</Text>
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
