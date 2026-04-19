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
import { useWordMatchSocket } from '../lib/useWordMatchSocket';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'WordMatchWait'>;

type MatchState = {
  sessionId: string;
  status: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  venueId?: string | null;
  hostPlayerId: string;
  inviteCode: string | null;
  targetWordCount: number;
  deckLanguage?: string;
  deckCategory?: string | null;
  participants: { playerId: string | null; username: string; isYou: boolean }[];
};

export default function WordMatchWaitScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    mode,
    difficulty,
    create = false,
    sessionId: initialSessionId,
    wordCount = 5,
    wordCategory,
  } = route.params ?? {};
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [mePlayerId, setMePlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(create && !initialSessionId);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const createdRef = useRef(false);
  const navigatedToGameRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      if (!isLoaded) return;
      try {
        const token = await getTokenRef.current();
        if (!token || cancelled) return;
        const s = await apiGet<{ playerId?: string }>('/players/me/summary', token);
        if (!cancelled) setMePlayerId(s.playerId ?? null);
      } catch {
        /* */
      }
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!create || initialSessionId || createdRef.current) return;
    let cancelled = false;
    async function run() {
      if (!isLoaded) return;
      createdRef.current = true;
      try {
        setLoading(true);
        setError(null);
        const token = await getTokenRef.current();
        if (!token) throw new Error(t('qr.notAuthenticated'));
        let latitude: number | undefined;
        let longitude: number | undefined;
        if (venueId) {
          const { venue, coords } = await fetchDetectedVenue();
          if (!coords || venue?.id !== venueId) {
            throw new Error(t('wordMatch.needPresenceToCreate'));
          }
          latitude = coords.lat;
          longitude = coords.lng;
        }
        const body: Record<string, unknown> = {
          venueId,
          latitude,
          longitude,
          language: toApiWordLanguage(i18n.language),
          wordCount,
          difficulty,
          mode,
        };
        if (wordCategory) body.category = wordCategory;
        const res = await apiPost<{
          sessionId: string;
          inviteCode: string | null;
        }>('/words/matches', body, token);
        if (cancelled) return;
        setSessionId(res.sessionId);
        setInviteCode(res.inviteCode);
      } catch (e) {
        createdRef.current = false;
        if (!cancelled) setError((e as Error).message || t('wordMatch.createFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    create,
    initialSessionId,
    isLoaded,
    venueId,
    difficulty,
    mode,
    t,
    i18n.language,
    wordCount,
    wordCategory,
  ]);

  const fetchMatchState = useCallback(async () => {
    const sid = sessionId;
    if (!sid) return;
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const s = await apiGet<MatchState>(
        `/words/matches/${encodeURIComponent(sid)}/state`,
        token,
      );
      setMatchState(s);
      if (s.inviteCode) setInviteCode(s.inviteCode);
    } catch {
      /* */
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !isLoaded) return;
    void fetchMatchState();
  }, [sessionId, isLoaded, fetchMatchState]);

  const { socketStatus } = useWordMatchSocket({
    sessionId,
    enabled: !!sessionId && isLoaded,
    getToken: async () => (await getTokenRef.current?.()) ?? null,
    onRefresh: fetchMatchState,
    fallbackPollMs: 30000,
  });

  useEffect(() => {
    if (navigatedToGameRef.current) return;
    if (!sessionId || matchState?.status !== 'ACTIVE') return;
    navigatedToGameRef.current = true;
    navigation.replace('WordGame', {
      venueId,
      challengeId,
      difficulty: (matchState.difficulty as 'easy' | 'normal' | 'hard') ?? difficulty,
      mode: matchState.mode,
      matchSessionId: sessionId,
      sessionWordsCount: matchState.targetWordCount,
    });
  }, [
    matchState?.status,
    matchState?.difficulty,
    matchState?.mode,
    matchState?.targetWordCount,
    sessionId,
    venueId,
    challengeId,
    difficulty,
    navigation,
  ]);

  const isHost = useMemo(
    () => !!matchState?.hostPlayerId && matchState.hostPlayerId === mePlayerId,
    [matchState?.hostPlayerId, mePlayerId],
  );

  const humanCount = matchState?.participants.filter((p) => p.playerId).length ?? 0;
  const canStart =
    isHost && matchState?.status === 'PENDING' && humanCount >= 2;

  const onStart = async () => {
    if (!sessionId) return;
    try {
      setStarting(true);
      const token = await getTokenRef.current();
      if (!token) throw new Error(t('qr.notAuthenticated'));
      await apiPost(`/words/matches/${encodeURIComponent(sessionId)}/start`, {}, token);
      const s = await apiGet<MatchState>(
        `/words/matches/${encodeURIComponent(sessionId)}/state`,
        token,
      );
      setMatchState(s);
    } catch (e) {
      setError((e as Error).message || t('wordMatch.startFailed'));
    } finally {
      setStarting(false);
    }
  };

  const leaveWait = () => {
    void (async () => {
      if (sessionId && (!matchState || matchState.status === 'PENDING')) {
        try {
          const token = await getTokenRef.current();
          if (token) {
            await apiPost(`/words/matches/${encodeURIComponent(sessionId)}/leave`, {}, token);
          }
        } catch {
          /* still navigate away */
        }
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('Home');
      }
    })();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable onPress={leaveWait} style={styles.navBack}>
            <Text style={styles.navBackText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.sub}>{t('wordMatch.creating')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !sessionId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable onPress={leaveWait} style={styles.navBack}>
            <Text style={styles.navBackText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.btn} onPress={leaveWait}>
            <Text style={styles.btnText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const code = inviteCode ?? '…';
  const deckLangCode = (matchState?.deckLanguage ?? 'en').toLowerCase();
  const deckLangLabel = t(`wordMatch.lang.${deckLangCode}`, {
    defaultValue: deckLangCode.toUpperCase(),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navHeader}>
        <Pressable onPress={leaveWait} style={styles.navBack}>
          <Text style={styles.navBackText}>{t('common.back')}</Text>
        </Pressable>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>{t('wordMatch.waitTitle')}</Text>
        <Text style={styles.sub}>
          {mode === 'coop' ? t('wordMatch.waitCoop') : t('wordMatch.waitVersus')}
        </Text>
        {matchState ? (
          <>
            <Text style={styles.deckLang}>
              {t('wordMatch.deckLanguage', { lang: deckLangLabel })}
            </Text>
            <Text style={styles.deckMeta}>
              {t('wordMatch.deckWords', { n: matchState.targetWordCount })}
              {matchState.deckCategory
                ? ` · ${t(`categories.${matchState.deckCategory}`, { defaultValue: matchState.deckCategory })}`
                : ` · ${t('wordLobby.categoryAll')}`}
            </Text>
          </>
        ) : null}
        {sessionId && (socketStatus === 'reconnecting' || socketStatus === 'connecting') ? (
          <Text style={styles.socketBanner}>{t('wordMatch.socketReconnecting')}</Text>
        ) : null}

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{t('wordMatch.roomCode')}</Text>
          <Text style={styles.code}>{code}</Text>
        </View>

        <Text style={styles.players}>
          {t('wordMatch.playersJoined', { count: humanCount })}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {canStart ? (
          <Pressable
            style={[styles.btnPrimary, starting && styles.btnDisabled]}
            onPress={() => void onStart()}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t('wordMatch.startMatch')}</Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.hint}>
            {isHost
              ? t('wordMatch.waitForFriend')
              : t('wordMatch.waitHostStarts')}
          </Text>
        )}

        <Pressable style={styles.link} onPress={() => leaveWait()}>
          <Text style={styles.linkText}>{t('wordMatch.cancelToHome')}</Text>
        </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.textMuted, marginTop: 8, fontSize: 14, lineHeight: 20 },
  deckLang: { color: colors.textMuted, marginTop: 6, fontSize: 12, fontWeight: '700' },
  deckMeta: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  socketBanner: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
    color: colors.honeyDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    overflow: 'hidden',
  },
  codeBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  codeLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  code: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 8,
  },
  players: { color: colors.textSecondary, marginTop: 16, fontWeight: '800' },
  hint: { color: colors.honeyDark, marginTop: 20, fontSize: 13, lineHeight: 18 },
  error: { color: colors.error, marginTop: 12, fontWeight: '700' },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnText: { color: colors.text, fontWeight: '800' },
  btnPrimary: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
  btnDisabled: { opacity: 0.7 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontWeight: '700' },

    });
}
