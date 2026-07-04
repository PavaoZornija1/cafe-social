import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '../components/ScreenHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { apiGet, apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useWordMatchSocket } from '../lib/useWordMatchSocket';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordMatchWait'>;

type MatchState = {
  sessionId: string;
  status: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  ranked?: boolean;
  venueId?: string | null;
  hostPlayerId: string;
  inviteCode: string | null;
  targetWordCount: number;
  deckLanguage?: string;
  deckCategory?: string | null;
  participants: { playerId: string | null; username: string; isYou: boolean }[];
  snapshotRev?: number | null;
};

const AVATAR_COLORS = ['#FBBF24', '#F87171', '#34D399', '#60A5FA', '#A78BFA'];

function initial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export default function WordMatchWaitScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    partyId,
    mode,
    difficulty,
    create = false,
    sessionId: initialSessionId,
    wordCount = 5,
    wordCategory,
    ranked: rankedParam,
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
  const lobbyReadyFiredRef = useRef(false);
  const lobbyCountInitializedRef = useRef(false);
  const prevHumanCountRef = useRef(0);

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
        if (mode === 'versus' && rankedParam) body.ranked = true;
        if (partyId) body.partyId = partyId;
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
    rankedParam,
    partyId,
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
    navigation.replace('GameLaunch', {
      kind: 'word',
      players: (matchState.participants ?? []).map((p) => ({
        username: p.username,
        isYou: p.isYou,
      })),
      word: {
        venueId,
        challengeId,
        difficulty: (matchState.difficulty as 'easy' | 'normal' | 'hard') ?? difficulty,
        mode: matchState.mode,
        matchSessionId: sessionId,
        sessionWordsCount: matchState.targetWordCount,
        ranked: matchState.mode === 'versus' && matchState.ranked ? true : undefined,
      },
    });
  }, [
    matchState?.status,
    matchState?.difficulty,
    matchState?.mode,
    matchState?.ranked,
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
  const canStart = isHost && matchState?.status === 'PENDING' && humanCount >= 2;

  useEffect(() => {
    if (!sessionId || !matchState || matchState.status !== 'PENDING') return;
    if (lobbyReadyFiredRef.current) return;
    lobbyReadyFiredRef.current = true;
    triggerFeedback('lobbyReady');
  }, [sessionId, matchState?.status, matchState]);

  useEffect(() => {
    if (!matchState || matchState.status !== 'PENDING') return;
    if (!lobbyCountInitializedRef.current) {
      lobbyCountInitializedRef.current = true;
      prevHumanCountRef.current = humanCount;
      return;
    }
    if (humanCount > prevHumanCountRef.current) {
      triggerFeedback('lobbyJoined');
    } else if (humanCount < prevHumanCountRef.current) {
      triggerFeedback('lobbyLeft');
    }
    prevHumanCountRef.current = humanCount;
  }, [humanCount, matchState]);

  const onStart = async () => {
    if (!sessionId) return;
    try {
      setStarting(true);
      const token = await getTokenRef.current();
      if (!token) throw new Error(t('qr.notAuthenticated'));
      await apiPost(
        `/words/matches/${encodeURIComponent(sessionId)}/start`,
        typeof matchState?.snapshotRev === 'number'
          ? { ifSnapshotRev: matchState.snapshotRev }
          : {},
        token,
      );
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
            await apiPost(
              `/words/matches/${encodeURIComponent(sessionId)}/leave`,
              typeof matchState?.snapshotRev === 'number'
                ? { ifSnapshotRev: matchState.snapshotRev }
                : {},
              token,
            );
          }
        } catch {
          /* still navigate away */
        }
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs');
      }
    })();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('wordMatch.waitTitle')}
          onBack={leaveWait}
          backLabel={t('common.back')}
        />
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.mutedCenter}>{t('wordMatch.creating')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !sessionId) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('wordMatch.waitTitle')}
          onBack={leaveWait}
          backLabel={t('common.back')}
        />
        <View style={styles.centerBlock}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
          <Text style={styles.errorCenter}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={leaveWait}
          >
            <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
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
  const modeLabel =
    mode === 'coop' ? t('wordLobby.modeCoop') : t('wordLobby.modeVersus');
  const waitSubtitle = mode === 'coop' ? t('wordMatch.waitCoop') : t('wordMatch.waitVersus');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('wordMatch.waitTitle')}
        onBack={leaveWait}
        backLabel={t('common.back')}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="people-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('wordMatch.waitHeroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{waitSubtitle}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{modeLabel}</Text>
            </View>
            {mode === 'versus' && (matchState?.ranked ?? rankedParam) ? (
              <View style={[styles.heroPill, styles.heroPillRanked]}>
                <Ionicons name="ribbon-outline" size={12} color={colors.xp} />
                <Text style={[styles.heroPillText, styles.heroPillTextRanked]}>
                  {t('wordMatch.rankedBadge')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {matchState ? (
          <View style={styles.deckMetaCard}>
            <Text style={styles.deckMetaLine}>
              {t('wordMatch.deckLanguage', { lang: deckLangLabel })}
            </Text>
            <Text style={styles.deckMetaLine}>
              {t('wordMatch.deckWords', { n: matchState.targetWordCount })}
              {matchState.deckCategory
                ? ` · ${t(`categories.${matchState.deckCategory}`, { defaultValue: matchState.deckCategory })}`
                : ` · ${t('wordLobby.categoryAll')}`}
            </Text>
          </View>
        ) : null}

        {sessionId && (socketStatus === 'reconnecting' || socketStatus === 'connecting') ? (
          <View style={styles.socketBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.honeyDark} />
            <Text style={styles.socketBannerText}>{t('wordMatch.socketReconnecting')}</Text>
          </View>
        ) : null}

        <View style={styles.codeCard}>
          <View style={styles.codeAccent} />
          <Text style={styles.codeKicker}>{t('wordMatch.roomCode')}</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.codeHint}>{t('wordMatch.waitShareCodeHint')}</Text>
        </View>

        <View style={styles.playersCard}>
          <Text style={styles.playersKicker}>
            {t('wordMatch.waitPlayersTitle', { count: humanCount })}
          </Text>
          {(matchState?.participants ?? []).length > 0 ? (
            <View style={styles.playerList}>
              {matchState!.participants.map((p, index) => (
                <View key={p.playerId ?? p.username} style={[styles.playerRow, p.isYou && styles.playerRowYou]}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                    ]}
                  >
                    <Text style={styles.avatarText}>{initial(p.username)}</Text>
                  </View>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {p.username}
                    {p.isYou ? ` · ${t('wordGame.you')}` : ''}
                  </Text>
                  {p.playerId ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  ) : (
                    <View style={styles.pendingDot} />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.playersEmpty}>{t('wordMatch.waitForFriend')}</Text>
          )}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorInline}>{error}</Text>
          </View>
        ) : null}

        {canStart ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              starting && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => void onStart()}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>{t('wordMatch.startMatch')}</Text>
                <Ionicons name="play" size={18} color={colors.textInverse} />
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.statusText}>
              {isHost ? t('wordMatch.waitForFriend') : t('wordMatch.waitHostStarts')}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          onPress={() => leaveWait()}
        >
          <Text style={styles.linkBtnText}>{t('wordMatch.cancelToHome')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    centerBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    mutedCenter: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    errorCenter: {
      color: colors.error,
      fontWeight: '800',
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 22,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
    },
    heroGradient: { ...StyleSheet.absoluteFillObject },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    heroPill: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroPillRanked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    heroPillText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    heroPillTextRanked: { color: colors.honeyDark },
    deckMetaCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 4,
    },
    deckMetaLine: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    socketBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.warningBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
    },
    socketBannerText: {
      flex: 1,
      color: colors.honeyDark,
      fontSize: 12,
      fontWeight: '800',
    },
    codeCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      overflow: 'hidden',
      gap: spacing.xs,
    },
    codeAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
    },
    codeKicker: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    code: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 8,
      fontVariant: ['tabular-nums'],
    },
    codeHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    playersCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    playersKicker: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    playerList: { gap: spacing.xs },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
    },
    playerRowYou: {
      backgroundColor: colors.primaryMuted,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 13,
    },
    playerName: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    pendingDot: {
      width: 10,
      height: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.borderStrong,
    },
    playersEmpty: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    errorInline: {
      flex: 1,
      color: colors.error,
      fontWeight: '700',
      fontSize: 13,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    statusText: {
      flex: 1,
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 16,
    },
    secondaryBtn: {
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryBtnText: { color: colors.textSecondary, fontWeight: '800', fontSize: 14 },
    btnDisabled: { opacity: 0.55 },
    linkBtn: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    linkBtnText: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 14,
    },
    pressed: { opacity: 0.9 },
  });
}
