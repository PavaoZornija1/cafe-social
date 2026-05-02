import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiGet, apiPost } from '../lib/api';
import { BRUISER_ARENA_HERO_ID } from '../brawler/bruiserSpritesheet';
import type { BrawlerArenaHeroStats, RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerLobby'>;

type BrawlerHero = {
  id: string;
  name: string;
  archetype?: string | null;
  baseHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  attackDamage: number;
  attackKnockback: number;
};

type CreateSessionResponse = {
  id: string;
  participants: Array<{
    id: string;
    isBot: boolean;
    botName?: string | null;
    playerId?: string | null;
    displayNameSnapshot?: string | null;
    brawlerHeroId?: string | null;
  }>;
};

export default function BrawlerLobbyScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const venueId = route.params?.venueId;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loadingHeroes, setLoadingHeroes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [heroes, setHeroes] = useState<BrawlerHero[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  const [soloSetupOpen, setSoloSetupOpen] = useState(false);
  const [soloOpponentCount, setSoloOpponentCount] = useState(1);
  const [soloDifficulty, setSoloDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  /** Venue queue: casual (false) vs ranked (true). */
  const [queueRanked, setQueueRanked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isLoaded) return;
      setLoadingHeroes(true);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const rows = await apiGet<BrawlerHero[]>('/brawler/heroes', token);
        if (cancelled) return;
        setHeroes(rows);
        setSelectedHeroId(rows[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        Alert.alert(t('common.error'), (e as Error).message || t('brawlerLobby.loadHeroesFailed'));
      } finally {
        if (!cancelled) setLoadingHeroes(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const selectedHero = useMemo(
    () => heroes.find((h) => h.id === selectedHeroId) ?? null,
    [heroes, selectedHeroId],
  );

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('ChooseGame', { venueId });
  };

  const onStartPracticeVsBot = async () => {
    if (!selectedHeroId) return;
    if (!isLoaded) return;

    if (selectedHeroId !== BRUISER_ARENA_HERO_ID) {
      Alert.alert(
        t('brawlerLobby.heroGateTitle'),
        t('brawlerLobby.heroGateBody'),
      );
      return;
    }

    setCreating(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const created = await apiPost<CreateSessionResponse>(
        '/brawler/sessions',
        {
          venueId,
          participants: [
            { isBot: false, brawlerHeroId: selectedHeroId },
            { isBot: true, botName: 'Chaos Bot', brawlerHeroId: selectedHeroId },
          ],
        },
        token,
      );

      await apiPost(`/brawler/sessions/${encodeURIComponent(created.id)}/start`, {}, token);

      const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
        ? {
            baseHp: selectedHero.baseHp,
            moveSpeed: selectedHero.moveSpeed,
            dashCooldownMs: selectedHero.dashCooldownMs,
            attackDamage: selectedHero.attackDamage,
            attackKnockback: selectedHero.attackKnockback,
          }
        : undefined;

      navigation.navigate('BrawlerArena', {
        heroId: selectedHeroId,
        venueId,
        heroStats,
        sessionId: created.id,
      });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message || t('brawlerLobby.startSessionFailed'));
    } finally {
      setCreating(false);
    }
  };

  const onQueueAtVenue = () => {
    if (!venueId || !selectedHeroId) return;
    if (selectedHeroId !== BRUISER_ARENA_HERO_ID) {
      Alert.alert(t('brawlerLobby.heroGateTitle'), t('brawlerLobby.heroGateBody'));
      return;
    }
    navigation.navigate('BrawlerVenueQueue', {
      venueId,
      brawlerHeroId: selectedHeroId,
      ranked: queueRanked ? true : undefined,
    });
  };

  const onStartSolo = () => {
    if (!selectedHeroId) return;
    if (selectedHeroId !== BRUISER_ARENA_HERO_ID) {
      Alert.alert(t('brawlerLobby.heroGateTitle'), t('brawlerLobby.heroGateBody'));
      return;
    }

    setSoloSetupOpen(true);
  };

  const startSoloMatch = () => {
    if (!selectedHeroId) return;
    const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
      ? {
          baseHp: selectedHero.baseHp,
          moveSpeed: selectedHero.moveSpeed,
          dashCooldownMs: selectedHero.dashCooldownMs,
          attackDamage: selectedHero.attackDamage,
          attackKnockback: selectedHero.attackKnockback,
        }
      : undefined;

    navigation.navigate('BrawlerArena', {
      heroId: selectedHeroId,
      venueId,
      heroStats,
      soloOptions: {
        opponentCount: soloOpponentCount,
        difficulty: soloDifficulty,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('brawlerLobby.title')}</Text>
        <Text style={styles.subtitle}>{t('brawlerLobby.subtitle')}</Text>
        <Text style={styles.meta}>
          {venueId ? t('brawlerLobby.venueLine', { venueId }) : t('brawlerLobby.noVenueLine')}
        </Text>

        {loadingHeroes ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.loadingText}>{t('brawlerLobby.loadingHeroes')}</Text>
          </View>
        ) : (
          <View style={styles.heroList}>
            {heroes.map((hero) => {
              const selected = hero.id === selectedHeroId;
              return (
                <Pressable
                  key={hero.id}
                  onPress={() => setSelectedHeroId(hero.id)}
                  style={({ pressed }) => [
                    styles.heroCard,
                    selected && styles.heroCardSelected,
                    pressed && styles.heroCardPressed,
                  ]}
                >
                  <Text style={styles.heroName}>{hero.name}</Text>
                  <Text style={styles.heroArchetype}>{hero.archetype ?? 'All-Rounder'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedHero && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Selected Hero Stats</Text>
            <Text style={styles.statsText}>HP: {selectedHero.baseHp}</Text>
            <Text style={styles.statsText}>Move Speed: {selectedHero.moveSpeed}</Text>
            <Text style={styles.statsText}>Dash Cooldown: {selectedHero.dashCooldownMs}ms</Text>
            <Text style={styles.statsText}>Attack Damage: {selectedHero.attackDamage}</Text>
            <Text style={styles.statsText}>
              Knockback: {selectedHero.attackKnockback}
            </Text>
          </View>
        )}

        {venueId ? (
          <View style={styles.rankCard}>
            <Text style={styles.rankTitle}>{t('brawlerLobby.queueRankTitle')}</Text>
            <View style={styles.rankRow}>
              <Pressable
                onPress={() => setQueueRanked(false)}
                style={({ pressed }) => [
                  styles.rankPill,
                  !queueRanked && styles.rankPillOn,
                  pressed && styles.rankPillPressed,
                ]}
              >
                <Text style={[styles.rankPillText, !queueRanked && styles.rankPillTextOn]}>
                  {t('brawlerLobby.queueCasual')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setQueueRanked(true)}
                style={({ pressed }) => [
                  styles.rankPill,
                  queueRanked && styles.rankPillOn,
                  pressed && styles.rankPillPressed,
                ]}
              >
                <Text style={[styles.rankPillText, queueRanked && styles.rankPillTextOn]}>
                  {t('brawlerLobby.queueRanked')}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.rankHint}>{t('brawlerLobby.queueRankedHint')}</Text>
            <Pressable
              onPress={onQueueAtVenue}
              disabled={!selectedHeroId || creating || loadingHeroes}
              style={({ pressed }) => [
                styles.queueCta,
                pressed && styles.startButtonPressed,
                (!selectedHeroId || creating || loadingHeroes) && styles.startButtonDisabled,
              ]}
            >
              <Text style={styles.queueCtaText}>{t('brawlerLobby.queueAtVenue')}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.venueHint}>{t('brawlerLobby.venueRequiredQueue')}</Text>
        )}

        <View style={styles.rosterCard}>
          <Text style={styles.rosterTitle}>{t('brawlerLobby.practiceRosterTitle')}</Text>
          <Text style={styles.rosterLine}>{t('brawlerLobby.practiceRosterYou')}</Text>
          <Text style={styles.rosterLine}>{t('brawlerLobby.practiceRosterBot')}</Text>
        </View>

        <View style={styles.startRow}>
          <Pressable
            onPress={onStartSolo}
            disabled={!selectedHeroId || creating || loadingHeroes}
            style={({ pressed }) => [
              styles.startButton,
              styles.startButtonSolo,
              pressed && styles.startButtonPressed,
              (!selectedHeroId || creating || loadingHeroes) && styles.startButtonDisabled,
            ]}
          >
            <Text style={styles.startButtonTextDark}>{t('brawlerLobby.soloMode')}</Text>
            <Text style={styles.startButtonSubText}>{t('brawlerLobby.soloModeSub')}</Text>
          </Pressable>

          <Pressable
            onPress={onStartPracticeVsBot}
            disabled={!selectedHeroId || creating || loadingHeroes}
            style={({ pressed }) => [
              styles.startButton,
              styles.startButtonMulti,
              pressed && styles.startButtonPressed,
              (!selectedHeroId || creating || loadingHeroes) && styles.startButtonDisabled,
            ]}
          >
            <Text style={styles.startButtonText}>
              {creating ? t('brawlerLobby.creating') : t('brawlerLobby.practiceVsBot')}
            </Text>
            <Text style={styles.startButtonSubTextInverse}>{t('brawlerLobby.practiceVsBotSub')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {soloSetupOpen ? (
        <View style={styles.soloOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.soloBackdrop}
            onPress={() => setSoloSetupOpen(false)}
          />
          <View style={styles.soloSheet}>
            <Text style={styles.soloTitle}>{t('brawlerLobby.soloSetupTitle')}</Text>
            <Text style={styles.soloHint}>{t('brawlerLobby.soloSetupHint')}</Text>

            <View style={styles.soloRow}>
              <Text style={styles.soloLabel}>{t('brawlerLobby.soloOpponents')}</Text>
              <View style={styles.soloStepper}>
                <Pressable
                  onPress={() => setSoloOpponentCount((n) => Math.max(0, n - 1))}
                  style={({ pressed }) => [
                    styles.soloStepBtn,
                    pressed && styles.soloStepBtnPressed,
                  ]}
                >
                  <Text style={styles.soloStepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.soloValue}>{soloOpponentCount}</Text>
                <Pressable
                  onPress={() => setSoloOpponentCount((n) => Math.min(6, n + 1))}
                  style={({ pressed }) => [
                    styles.soloStepBtn,
                    pressed && styles.soloStepBtnPressed,
                  ]}
                >
                  <Text style={styles.soloStepBtnText}>＋</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.soloRow}>
              <Text style={styles.soloLabel}>{t('brawlerLobby.soloDifficulty')}</Text>
              <View style={styles.soloPills}>
                {(['easy', 'normal', 'hard'] as const).map((d) => {
                  const on = d === soloDifficulty;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSoloDifficulty(d)}
                      style={({ pressed }) => [
                        styles.soloPill,
                        on && styles.soloPillOn,
                        pressed && styles.soloPillPressed,
                      ]}
                    >
                      <Text style={[styles.soloPillText, on && styles.soloPillTextOn]}>
                        {d.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.soloActions}>
              <Pressable
                onPress={() => setSoloSetupOpen(false)}
                style={({ pressed }) => [
                  styles.soloBtn,
                  styles.soloBtnSecondary,
                  pressed && styles.soloBtnPressed,
                ]}
              >
                <Text style={styles.soloBtnSecondaryText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSoloSetupOpen(false);
                  startSoloMatch();
                }}
                style={({ pressed }) => [
                  styles.soloBtn,
                  styles.soloBtnPrimary,
                  pressed && styles.soloBtnPressed,
                ]}
              >
                <Text style={styles.soloBtnPrimaryText}>{t('brawlerLobby.soloStartBtn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    marginBottom: 2,
  },
  backText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  meta: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  heroList: { gap: 8, marginTop: 4 },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroCardSelected: {
    borderColor: colors.honey,
    backgroundColor: '#1f1638',
  },
  heroCardPressed: { opacity: 0.88 },
  heroName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  heroArchetype: { color: '#93c5fd', fontSize: 12, marginTop: 4 },
  statsCard: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  statsTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  statsText: { color: colors.textSecondary, fontSize: 13 },
  startRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  startButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonSolo: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  startButtonMulti: {
    backgroundColor: colors.primary,
  },
  startButtonPressed: { opacity: 0.9 },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
  startButtonTextDark: { color: colors.text, fontSize: 15, fontWeight: '900' },
  startButtonSubText: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  startButtonSubTextInverse: {
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 11,
    fontWeight: '800',
  },
  rosterCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  rosterTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  rosterLine: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },

  rankCard: {
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 10,
  },
  rankTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  rankRow: { flexDirection: 'row', gap: 8 },
  rankPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  rankPillOn: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(167, 139, 250, 0.55)',
  },
  rankPillPressed: { opacity: 0.9 },
  rankPillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '900' },
  rankPillTextOn: { color: colors.textInverse },
  rankHint: { color: colors.textMuted, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  queueCta: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.honeyMuted,
    borderWidth: 1,
    borderColor: colors.honey,
  },
  queueCtaText: { color: colors.honeyDark, fontSize: 14, fontWeight: '900' },
  venueHint: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },

  soloOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'flex-end',
  },
  soloBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  soloSheet: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    gap: 12,
  },
  soloTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  soloHint: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  soloRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soloLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '900' },
  soloStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soloStepBtn: {
    width: 36,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soloStepBtnPressed: { opacity: 0.85 },
  soloStepBtnText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  soloValue: {
    width: 24,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  soloPills: { flexDirection: 'row', gap: 8 },
  soloPill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  soloPillOn: {
    backgroundColor: colors.primary,
    borderColor: 'rgba(167, 139, 250, 0.55)',
  },
  soloPillPressed: { opacity: 0.9 },
  soloPillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
  soloPillTextOn: { color: colors.textInverse },
  soloActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  soloBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  soloBtnPrimary: {
    backgroundColor: colors.primary,
  },
  soloBtnSecondary: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  soloBtnPressed: { opacity: 0.9 },
  soloBtnPrimaryText: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
  soloBtnSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },

    });
}
