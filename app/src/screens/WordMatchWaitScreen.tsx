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
  participants: { playerId: string | null; username: string; isYou: boolean }[];
};

export default function WordMatchWaitScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    mode,
    difficulty,
    create = false,
    sessionId: initialSessionId,
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
        const res = await apiPost<{
          sessionId: string;
          inviteCode: string | null;
        }>(
          '/words/matches',
          {
            venueId,
            latitude,
            longitude,
            language: toApiWordLanguage(i18n.language),
            wordCount: 5,
            difficulty,
            mode,
          },
          token,
        );
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
  }, [create, initialSessionId, isLoaded, venueId, difficulty, mode, t, i18n.language]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
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
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
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
      <View style={styles.container}>
        <Text style={styles.title}>{t('wordMatch.waitTitle')}</Text>
        <Text style={styles.sub}>
          {mode === 'coop' ? t('wordMatch.waitCoop') : t('wordMatch.waitVersus')}
        </Text>
        {matchState ? (
          <Text style={styles.deckLang}>
            {t('wordMatch.deckLanguage', { lang: deckLangLabel })}
          </Text>
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
              <ActivityIndicator color="#fff" />
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

        <Pressable style={styles.link} onPress={() => navigation.replace('Home')}>
          <Text style={styles.linkText}>{t('wordMatch.cancelToHome')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#9ca3af', marginTop: 8, fontSize: 14, lineHeight: 20 },
  deckLang: { color: '#6b7280', marginTop: 6, fontSize: 12, fontWeight: '700' },
  socketBanner: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#422006',
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    overflow: 'hidden',
  },
  codeBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  codeLabel: { color: '#9ca3af', fontWeight: '700', fontSize: 12 },
  code: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    marginTop: 8,
  },
  players: { color: '#e5e7eb', marginTop: 16, fontWeight: '800' },
  hint: { color: '#a5b4fc', marginTop: 20, fontSize: 13, lineHeight: 18 },
  error: { color: '#f87171', marginTop: 12, fontWeight: '700' },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  btnText: { color: '#fff', fontWeight: '800' },
  btnPrimary: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  btnDisabled: { opacity: 0.7 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#6b7280', fontWeight: '700' },
});
