import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useVenueSession } from '../query';
import {
  getHeroLobbyAvatarSource,
  isArenaSpriteHero,
  isLobbySelectableHero,
} from '../brawler/heroSpritesheets';
import {
  ARENA_MAP_IDS,
  ARENA_MAPS,
  resolveArenaMapId,
  type ArenaMapChoice,
} from '../brawler/arena/arenaMaps';
import { BrawlerPowerupLegend } from '../brawler/components/BrawlerPowerupLegend';
import type { BrawlerPowerupDef } from '../brawler/arena/types';
import type { MeSummaryDto } from '../lib/meSummary';
import type { BrawlerArenaHeroStats, RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

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
  snapshotRev?: number | null;
  participants: Array<{
    id: string;
    isBot: boolean;
    botName?: string | null;
    playerId?: string | null;
    displayNameSnapshot?: string | null;
    brawlerHeroId?: string | null;
  }>;
};

const MAP_CHOICES: ArenaMapChoice[] = ['random', ...ARENA_MAP_IDS];

type PartyMember = {
  playerId: string;
  player: { id: string; username: string };
};

type PartyDetail = {
  id: string;
  leaderId: string;
  members: PartyMember[];
};

export default function BrawlerLobbyScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const venueId = route.params?.venueId;
  const partyId = route.params?.partyId;
  const session = useVenueSession({ routeVenueId: venueId });
  const { canDoVenueActions, subscriptionActive, venueScopedId } = session;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loadingHeroes, setLoadingHeroes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [heroes, setHeroes] = useState<BrawlerHero[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  /** Dev/temp: force a map or roll randomly when starting. */
  const [selectedMapChoice, setSelectedMapChoice] = useState<ArenaMapChoice>('random');

  const [soloSetupOpen, setSoloSetupOpen] = useState(false);
  const [soloOpponentCount, setSoloOpponentCount] = useState(1);
  const [soloDifficulty, setSoloDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  /** Casual vs ranked queue mode for online matchmaking. */
  const [queueRanked, setQueueRanked] = useState(false);
  const [powerups, setPowerups] = useState<BrawlerPowerupDef[]>([]);
  const [partyDetail, setPartyDetail] = useState<PartyDetail | null>(null);
  const [mePlayerId, setMePlayerId] = useState<string | null>(null);

  const resolveMapForMatch = () => resolveArenaMapId(selectedMapChoice);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isLoaded) return;
      setLoadingHeroes(true);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const [rows, powerupRows] = await Promise.all([
          apiGet<BrawlerHero[]>('/brawler/heroes', token),
          apiGet<BrawlerPowerupDef[]>('/brawler/powerups', token),
        ]);
        if (cancelled) return;
        const selectable = rows.filter((h) => isLobbySelectableHero(h.id));
        setHeroes(selectable);
        setPowerups(powerupRows);
        setSelectedHeroId(selectable[0]?.id ?? null);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isLoaded) return;
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const me = await apiGet<MeSummaryDto>('/players/me/summary', token);
        if (!cancelled) setMePlayerId(me.playerId ?? null);
        if (partyId) {
          const party = await apiGet<PartyDetail>(
            `/parties/${encodeURIComponent(partyId)}`,
            token,
          );
          if (!cancelled) setPartyDetail(party);
        } else if (!cancelled) {
          setPartyDetail(null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, partyId]);

  const matchmakingAvailable = canDoVenueActions && Boolean(venueScopedId || subscriptionActive);
  const practiceDisabled = !canDoVenueActions || !selectedHeroId || creating || loadingHeroes;

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
    if (!canDoVenueActions) return;
    if (!selectedHeroId) return;
    if (!isLoaded) return;

    if (!isArenaSpriteHero(selectedHeroId)) {
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
          ...(partyId ? { partyId } : {}),
          participants: [
            { isBot: false, brawlerHeroId: selectedHeroId },
            { isBot: true, botName: 'Chaos Bot', brawlerHeroId: selectedHeroId },
          ],
        },
        token,
      );

      const { coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
      if (!coords) {
        throw new Error(t('brawlerLobby.needLocationForStart'));
      }

      const startBody: { ifSnapshotRev?: number; latitude: number; longitude: number } = {
        latitude: coords.lat,
        longitude: coords.lng,
      };
      if (typeof created.snapshotRev === 'number') {
        startBody.ifSnapshotRev = created.snapshotRev;
      }

      await apiPost(
        `/brawler/sessions/${encodeURIComponent(created.id)}/start`,
        startBody,
        token,
      );

      const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
        ? {
            baseHp: selectedHero.baseHp,
            moveSpeed: selectedHero.moveSpeed,
            dashCooldownMs: selectedHero.dashCooldownMs,
            attackDamage: selectedHero.attackDamage,
            attackKnockback: selectedHero.attackKnockback,
          }
        : undefined;

      navigation.navigate('GameLaunch', {
        kind: 'brawler',
        brawler: {
          heroId: selectedHeroId,
          venueId,
          heroStats,
          sessionId: created.id,
          mapId: resolveMapForMatch(),
        },
      });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message || t('brawlerLobby.startSessionFailed'));
    } finally {
      setCreating(false);
    }
  };

  const isPartyLeader =
    Boolean(partyId && partyDetail && mePlayerId && partyDetail.leaderId === mePlayerId);
  const partyMemberCount = partyDetail?.members.length ?? 0;

  const onStartPartyBrawl = async () => {
    if (!canDoVenueActions || !partyId || !partyDetail || !selectedHeroId || !isPartyLeader) {
      return;
    }
    if (partyMemberCount < 2 || partyMemberCount > 4) {
      Alert.alert(t('common.error'), t('brawlerLobby.partyBrawlSizeError'));
      return;
    }
    if (!isArenaSpriteHero(selectedHeroId)) {
      Alert.alert(t('brawlerLobby.heroGateTitle'), t('brawlerLobby.heroGateBody'));
      return;
    }

    setCreating(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');
      const fallbackHeroId = selectedHeroId;
      const created = await apiPost<CreateSessionResponse>(
        '/brawler/sessions/party',
        {
          partyId,
          ...(venueId ? { venueId } : {}),
          ranked: queueRanked ? true : undefined,
          participants: partyDetail.members.map((m) => ({
            playerId: m.playerId,
            brawlerHeroId:
              m.playerId === mePlayerId ? selectedHeroId : fallbackHeroId,
          })),
        },
        token,
      );

      const { coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
      if (!coords) {
        throw new Error(t('brawlerLobby.needLocationForStart'));
      }

      const startBody: { ifSnapshotRev?: number; latitude: number; longitude: number } = {
        latitude: coords.lat,
        longitude: coords.lng,
      };
      if (typeof created.snapshotRev === 'number') {
        startBody.ifSnapshotRev = created.snapshotRev;
      }

      await apiPost(
        `/brawler/sessions/${encodeURIComponent(created.id)}/start`,
        startBody,
        token,
      );

      const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
        ? {
            baseHp: selectedHero.baseHp,
            moveSpeed: selectedHero.moveSpeed,
            dashCooldownMs: selectedHero.dashCooldownMs,
            attackDamage: selectedHero.attackDamage,
            attackKnockback: selectedHero.attackKnockback,
          }
        : undefined;

      navigation.navigate('GameLaunch', {
        kind: 'brawler',
        players: partyDetail.members.map((m) => ({
          username: m.player.username,
          isYou: m.playerId === mePlayerId,
        })),
        brawler: {
          heroId: selectedHeroId,
          venueId,
          heroStats,
          sessionId: created.id,
          mapId: resolveMapForMatch(),
        },
      });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message || t('brawlerLobby.startSessionFailed'));
    } finally {
      setCreating(false);
    }
  };

  const onFindMatch = () => {
    if (!canDoVenueActions) return;
    if (!selectedHeroId) return;
    if (!isArenaSpriteHero(selectedHeroId)) {
      Alert.alert(t('brawlerLobby.heroGateTitle'), t('brawlerLobby.heroGateBody'));
      return;
    }
    const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
      ? {
          baseHp: selectedHero.baseHp,
          moveSpeed: selectedHero.moveSpeed,
          dashCooldownMs: selectedHero.dashCooldownMs,
          attackDamage: selectedHero.attackDamage,
          attackKnockback: selectedHero.attackKnockback,
        }
      : undefined;
    navigation.navigate('BrawlerVenueQueue', {
      ...(venueId ? { venueId } : {}),
      ...(partyId ? { partyId } : {}),
      brawlerHeroId: selectedHeroId,
      heroName: selectedHero?.name,
      ranked: queueRanked ? true : undefined,
      heroStats,
      mapId: resolveMapForMatch(),
    });
  };

  const onStartSolo = () => {
    if (!canDoVenueActions) return;
    if (!selectedHeroId) return;
    if (!isArenaSpriteHero(selectedHeroId)) {
      Alert.alert(t('brawlerLobby.heroGateTitle'), t('brawlerLobby.heroGateBody'));
      return;
    }

    setSoloSetupOpen(true);
  };

  const startSoloMatch = () => {
    if (!canDoVenueActions) return;
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

    navigation.navigate('GameLaunch', {
      kind: 'brawler',
      brawler: {
        heroId: selectedHeroId,
        venueId,
        heroStats,
        mapId: resolveMapForMatch(),
        soloOptions: {
          opponentCount: soloOpponentCount,
          difficulty: soloDifficulty,
        },
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('brawlerLobby.title')}</Text>
          <View style={styles.iconBtnSpacer} />
        </View>

        <Text style={styles.subtitle}>{t('brawlerLobby.subtitle')}</Text>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="fitness" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t('brawlerLobby.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {venueId ? t('brawlerLobby.heroVenue') : t('brawlerLobby.heroGlobal')}
          </Text>
        </View>

        {loadingHeroes ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t('brawlerLobby.loadingHeroes')}</Text>
          </View>
        ) : (
          <View style={styles.heroList}>
            {heroes.map((hero) => {
              const selected = hero.id === selectedHeroId;
              const avatarSource = getHeroLobbyAvatarSource(hero.id);
              return (
                <Pressable
                  key={hero.id}
                  onPress={() => setSelectedHeroId(hero.id)}
                  style={({ pressed }) => [
                    styles.heroCard,
                    selected && styles.heroCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.heroCardIcon, selected && styles.heroCardIconSelected]}>
                    {avatarSource ? (
                      <Image
                        source={avatarSource}
                        style={styles.heroCardAvatar}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name="person"
                        size={20}
                        color={selected ? colors.textInverse : colors.textSecondary}
                      />
                    )}
                  </View>
                  <View style={styles.heroCardBody}>
                    <Text style={styles.heroName}>{hero.name}</Text>
                    <Text style={styles.heroArchetype}>{hero.archetype ?? 'All-Rounder'}</Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.xp} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedHero ? (
          <View style={styles.statsCard}>
            {getHeroLobbyAvatarSource(selectedHero.id) ? (
              <View style={styles.selectedHeroPreview}>
                <Image
                  source={getHeroLobbyAvatarSource(selectedHero.id)!}
                  style={styles.selectedHeroAvatar}
                  resizeMode="contain"
                />
                <View style={styles.selectedHeroPreviewText}>
                  <Text style={styles.selectedHeroName}>{selectedHero.name}</Text>
                  <Text style={styles.selectedHeroArchetype}>
                    {selectedHero.archetype ?? 'All-Rounder'}
                  </Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>{t('brawlerLobby.selectedHeroStats')}</Text>
            <View style={styles.statsGrid}>
              <Text style={styles.statsText}>
                {t('brawlerLobby.statHp', { value: selectedHero.baseHp })}
              </Text>
              <Text style={styles.statsText}>
                {t('brawlerLobby.statSpeed', { value: selectedHero.moveSpeed })}
              </Text>
              <Text style={styles.statsText}>
                {t('brawlerLobby.statDash', { value: selectedHero.dashCooldownMs })}
              </Text>
              <Text style={styles.statsText}>
                {t('brawlerLobby.statAttack', { value: selectedHero.attackDamage })}
              </Text>
              <Text style={styles.statsText}>
                {t('brawlerLobby.statKnockback', { value: selectedHero.attackKnockback })}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.mapCard}>
          <Text style={styles.sectionLabel}>{t('brawlerLobby.mapTitle')}</Text>
          <Text style={styles.mapHint}>{t('brawlerLobby.mapHint')}</Text>
          <View style={styles.mapRow}>
            {MAP_CHOICES.map((choice) => {
              const selected = choice === selectedMapChoice;
              const label =
                choice === 'random'
                  ? t('brawlerLobby.maps.random')
                  : t(`brawlerLobby.maps.${ARENA_MAPS[choice].nameKey}`);
              return (
                <Pressable
                  key={choice}
                  onPress={() => setSelectedMapChoice(choice)}
                  style={({ pressed }) => [
                    styles.mapPill,
                    selected && styles.mapPillOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.mapPillText, selected && styles.mapPillTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <BrawlerPowerupLegend
          colors={colors}
          title={t('brawlerLobby.powerupLegendTitle')}
          powerups={powerups}
        />

        {partyId && partyMemberCount >= 2 ? (
          <View style={styles.rankCard}>
            <Text style={styles.sectionLabel}>{t('brawlerLobby.partyBrawlTitle')}</Text>
            <Text style={styles.rankHint}>{t('brawlerLobby.partyBrawlHint')}</Text>
            {isPartyLeader ? (
              <Pressable
                onPress={() => void onStartPartyBrawl()}
                disabled={practiceDisabled || creating}
                style={({ pressed }) => [
                  styles.queueCta,
                  pressed && styles.pressed,
                  (practiceDisabled || creating) && styles.ctaDisabled,
                ]}
              >
                <Text style={styles.queueCtaText}>{t('brawlerLobby.partyBrawlCta')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.rankHint}>{t('brawlerLobby.partyBrawlWaitLeader')}</Text>
            )}
          </View>
        ) : null}

        {matchmakingAvailable ? (
          <View style={styles.rankCard}>
            <Text style={styles.sectionLabel}>{t('brawlerLobby.queueRankTitle')}</Text>
            <View style={styles.rankRow}>
              <Pressable
                onPress={() => setQueueRanked(false)}
                style={({ pressed }) => [
                  styles.rankPill,
                  !queueRanked && styles.rankPillOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.rankPillText,
                    !queueRanked && styles.rankPillTextOn,
                  ]}
                >
                  {t('brawlerLobby.queueCasual')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setQueueRanked(true)}
                style={({ pressed }) => [
                  styles.rankPill,
                  queueRanked && styles.rankPillOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.rankPillText,
                    queueRanked && styles.rankPillTextOn,
                  ]}
                >
                  {t('brawlerLobby.queueRanked')}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.rankHint}>
              {queueRanked
                ? t('brawlerLobby.queueRankedHint')
                : t('brawlerLobby.queueCasualHint')}
            </Text>
            <Text style={styles.rankHint}>{t('brawlerLobby.queueGlobalHint')}</Text>
            <Pressable
              onPress={onFindMatch}
              disabled={practiceDisabled}
              style={({ pressed }) => [
                styles.queueCta,
                pressed && styles.pressed,
                practiceDisabled && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.queueCtaText}>{t('brawlerLobby.findMatch')}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.venueHint}>{t('brawlerLobby.venueRequiredQueue')}</Text>
        )}

        {!canDoVenueActions ? (
          <Text style={styles.venueHint}>{t('home.playLockedHint')}</Text>
        ) : null}

        <View style={styles.rosterCard}>
          <Text style={styles.sectionLabel}>{t('brawlerLobby.practiceRosterTitle')}</Text>
          <Text style={styles.rosterLine}>{t('brawlerLobby.practiceRosterYou')}</Text>
          <Text style={styles.rosterLine}>{t('brawlerLobby.practiceRosterBot')}</Text>
        </View>

        <View style={styles.startRow}>
          <Pressable
            onPress={onStartSolo}
            disabled={practiceDisabled}
            style={({ pressed }) => [
              styles.startButton,
              styles.startButtonSolo,
              pressed && styles.pressed,
              practiceDisabled && styles.ctaDisabled,
            ]}
          >
            <Text style={styles.startButtonTextDark}>{t('brawlerLobby.soloMode')}</Text>
            <Text style={styles.startButtonSubText}>{t('brawlerLobby.soloModeSub')}</Text>
          </Pressable>

          <Pressable
            onPress={onStartPracticeVsBot}
            disabled={practiceDisabled}
            style={({ pressed }) => [
              styles.startButton,
              styles.startButtonMulti,
              pressed && styles.pressed,
              practiceDisabled && styles.ctaDisabled,
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
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
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
    iconBtnSpacer: { width: 44, height: 44, flexShrink: 0 },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
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
      fontSize: 22,
      fontWeight: '900',
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    loadingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    loadingText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    heroList: { gap: spacing.sm, marginBottom: spacing.md },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    heroCardSelected: {
      borderColor: colors.xp,
      backgroundColor: colors.primaryMuted,
    },
    heroCardIcon: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    },
    heroCardIconSelected: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.xp,
    },
    heroCardAvatar: {
      width: 44,
      height: 44,
    },
    heroCardBody: { flex: 1, minWidth: 0 },
    heroName: { color: colors.text, fontSize: 16, fontWeight: '800' },
    heroArchetype: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
    statsCard: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    sectionLabel: { color: colors.text, fontSize: 16, fontWeight: '900' },
    selectedHeroPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    selectedHeroAvatar: {
      width: 72,
      height: 72,
    },
    selectedHeroPreviewText: { flex: 1, minWidth: 0 },
    selectedHeroName: { color: colors.text, fontSize: 18, fontWeight: '900' },
    selectedHeroArchetype: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
      fontWeight: '700',
    },
    statsGrid: { gap: spacing.xs },
    statsText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    mapCard: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    mapHint: { color: colors.textMuted, fontSize: 13, fontWeight: '600', lineHeight: 18 },
    mapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    mapPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    mapPillOn: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.xp,
    },
    mapPillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
    mapPillTextOn: { color: colors.text },
    rankCard: {
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    rankRow: { flexDirection: 'row', gap: spacing.sm },
    rankPill: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    rankPillOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    rankPillText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
    rankPillTextOn: { color: colors.textInverse },
    rankHint: { color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 17 },
    queueCta: {
      marginTop: spacing.xs,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      backgroundColor: colors.honeyMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.honey,
    },
    queueCtaText: { color: colors.honeyDark, fontSize: 14, fontWeight: '900' },
    venueHint: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    rosterCard: {
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    rosterLine: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    startRow: { flexDirection: 'row', gap: spacing.sm },
    startButton: {
      flex: 1,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    startButtonSolo: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    startButtonMulti: { backgroundColor: colors.primary },
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
    ctaDisabled: { opacity: 0.5 },
    pressed: { opacity: 0.92 },
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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
    },
    soloTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
    soloHint: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    soloRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    soloLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
    soloStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    soloStepBtn: {
      width: 36,
      height: 32,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
    soloPills: { flexDirection: 'row', gap: spacing.sm },
    soloPill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    soloPillOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    soloPillPressed: { opacity: 0.9 },
    soloPillText: { color: colors.textSecondary, fontSize: 11, fontWeight: '900' },
    soloPillTextOn: { color: colors.textInverse },
    soloActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    soloBtn: {
      flex: 1,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    soloBtnPrimary: { backgroundColor: colors.primary },
    soloBtnSecondary: {
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    soloBtnPressed: { opacity: 0.9 },
    soloBtnPrimaryText: { color: colors.textInverse, fontSize: 15, fontWeight: '900' },
    soloBtnSecondaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  });
}
