import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ExplicitCheckInBanner from '../components/home/ExplicitCheckInBanner';
import ScreenHeader from '../components/ScreenHeader';
import LobbySection from '../components/word/lobby/LobbySection';
import { LobbyChipPicker, LobbyModePicker, LobbySegmentedControl } from '../components/word/lobby/LobbyPickers';
import WordLobbyHero from '../components/word/lobby/WordLobbyHero';
import VenuePlayTimeBar from '../components/VenuePlayTimeBar';

import type { RootStackParamList } from '../navigation/type';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useVenueSession } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordLobby'>;

type Difficulty = 'easy' | 'normal' | 'hard';
type PlayKind = 'solo' | 'coop' | 'versus';

const WORD_COUNT_OPTIONS = [3, 5, 7, 10, 12] as const;

const WORD_CATEGORY_KEYS = [
  'DRINK_FOOD',
  'PLACE_ATMOSPHERE',
  'MUSIC_CULTURE',
  'PEOPLE_ROLES',
  'MOMENTS_ACTIONS',
] as const;

export default function WordLobbyScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { venueId: routeVenueId, challengeId, partyId } = route.params ?? {};
  const session = useVenueSession({ routeVenueId });
  const {
    playVenueId,
    showCheckIn,
    venueLocked,
    venueLockKey,
    canEnterVenueContext,
    subscriptionActive,
    canDoVenueActions,
    venueScopedId,
    isLoading: accessLoading,
  } = session;
  const playAllowed = !accessLoading && canDoVenueActions;
  const activeVenueId = venueScopedId;

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playKind, setPlayKind] = useState<PlayKind>('solo');
  const [versusRanked, setVersusRanked] = useState(false);
  const [wordCount, setWordCount] = useState<number>(5);
  const [wordCategory, setWordCategory] = useState<(typeof WORD_CATEGORY_KEYS)[number] | null>(
    null,
  );

  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const openQrCheckIn = () => {
    if (playVenueId) navigation.navigate('QrScan', { venueId: playVenueId });
  };

  const difficultyLabel = useMemo(() => {
    if (difficulty === 'easy') return t('wordLobby.easyDesc');
    if (difficulty === 'normal') return t('wordLobby.normalDesc');
    return t('wordLobby.hardDesc');
  }, [difficulty, t]);

  const appDeckLang = toApiWordLanguage(i18n.language);
  const appDeckLabel = t('wordLobby.appLanguageDeck', {
    lang: t(`wordMatch.lang.${appDeckLang}`, {
      defaultValue: appDeckLang.toUpperCase(),
    }),
  });

  const playModeOptions = useMemo(
    () =>
      [
        {
          value: 'solo' as const,
          label: t('wordLobby.modeSolo'),
          description: t('wordLobby.modeSoloHint'),
          icon: 'person-outline' as const,
        },
        {
          value: 'coop' as const,
          label: t('wordLobby.modeCoop'),
          description: t('wordLobby.modeCoopHint'),
          icon: 'people-outline' as const,
        },
        {
          value: 'versus' as const,
          label: t('wordLobby.modeVersus'),
          description: t('wordLobby.modeVersusHint'),
          icon: 'trophy-outline' as const,
        },
      ] satisfies {
        value: PlayKind;
        label: string;
        description: string;
        icon: keyof typeof Ionicons.glyphMap;
      }[],
    [t],
  );

  const onPrimary = () => {
    if (!playAllowed) return;
    if (playKind === 'solo') {
      navigation.navigate('GameLaunch', {
        kind: 'word',
        word: {
          ...(activeVenueId ? { venueId: activeVenueId } : {}),
          challengeId,
          difficulty,
          mode: 'solo',
          sessionWordsCount: wordCount,
          wordCategory: wordCategory ?? undefined,
        },
      });
      return;
    }
    navigation.navigate('WordMatchWait', {
      ...(activeVenueId ? { venueId: activeVenueId } : {}),
      challengeId,
      partyId,
      mode: playKind,
      difficulty,
      create: true,
      wordCount,
      wordCategory: wordCategory ?? undefined,
      ranked: playKind === 'versus' && versusRanked ? true : undefined,
    });
  };

  const onFindMatch = () => {
    if (!playAllowed) return;
    if (playKind !== 'coop' && playKind !== 'versus') return;
    navigation.navigate('WordVenueQueue', {
      ...(activeVenueId ? { venueId: activeVenueId } : {}),
      challengeId,
      partyId,
      mode: playKind,
      difficulty,
      wordCount,
      wordCategory: wordCategory ?? undefined,
      ranked: playKind === 'versus' && versusRanked ? true : undefined,
    });
  };

  const heroSubtitle = canEnterVenueContext
    ? t('wordLobby.venueLineShort')
    : subscriptionActive
      ? t('wordLobby.globalLine')
      : t('wordLobby.needVenueCheckIn');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('wordLobby.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WordLobbyHero
          colors={colors}
          title={t('wordLobby.heroKicker')}
          subtitle={heroSubtitle}
          languageLabel={appDeckLabel}
        />

        {showCheckIn ? (
          <View style={styles.checkInWrap}>
            <ExplicitCheckInBanner colors={colors} onScan={openQrCheckIn} />
          </View>
        ) : null}

        {venueLocked && venueLockKey ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={18} color={colors.error} />
            <Text style={styles.lockBannerText}>{t(venueLockKey)}</Text>
          </View>
        ) : null}

        {!playAllowed && !accessLoading ? (
          <View style={styles.lockBanner}>
            <Ionicons name="location-outline" size={18} color={colors.error} />
            <Text style={styles.lockBannerText}>{t('wordLobby.needVenueCheckIn')}</Text>
          </View>
        ) : null}

        {activeVenueId ? (
          <VenuePlayTimeBar
            venueId={activeVenueId}
            getToken={() => getTokenRef.current()}
            subscriptionActive={subscriptionActive}
            variant="compact"
          />
        ) : null}

        <LobbySection colors={colors} title={t('wordLobby.playModeTitle')}>
          <LobbyModePicker
            colors={colors}
            options={playModeOptions}
            value={playKind}
            onChange={setPlayKind}
          />
        </LobbySection>

        {playKind === 'versus' ? (
          <LobbySection
            colors={colors}
            title={t('wordLobby.versusMatchTypeTitle')}
            hint={versusRanked ? t('wordLobby.versusRankedHint') : t('wordLobby.versusCasualHint')}
          >
            <LobbySegmentedControl
              colors={colors}
              options={[
                { value: 'casual', label: t('wordLobby.versusCasual') },
                { value: 'ranked', label: t('wordLobby.versusRanked') },
              ]}
              value={versusRanked ? 'ranked' : 'casual'}
              onChange={(v) => setVersusRanked(v === 'ranked')}
            />
          </LobbySection>
        ) : null}

        <LobbySection
          colors={colors}
          title={t('wordLobby.deckLengthTitle')}
          hint={t('wordLobby.deckLengthHint')}
        >
          <LobbyChipPicker
            colors={colors}
            options={WORD_COUNT_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
            value={wordCount}
            onChange={setWordCount}
          />
        </LobbySection>

        <LobbySection colors={colors} title={t('wordLobby.categoryTitle')}>
          <LobbyChipPicker
            colors={colors}
            options={[
              { value: 'all', label: t('wordLobby.categoryAll') },
              ...WORD_CATEGORY_KEYS.map((key) => ({
                value: key,
                label: t(`categories.${key}`),
              })),
            ]}
            value={wordCategory ?? 'all'}
            onChange={(v) => setWordCategory(v === 'all' ? null : v)}
          />
        </LobbySection>

        <LobbySection colors={colors} title={t('wordLobby.difficultyTitle')}>
          <LobbySegmentedControl
            colors={colors}
            options={[
              { value: 'easy', label: t('wordLobby.easy') },
              { value: 'normal', label: t('wordLobby.normal') },
              { value: 'hard', label: t('wordLobby.hard') },
            ]}
            value={difficulty}
            onChange={setDifficulty}
          />
        </LobbySection>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{difficultyLabel}</Text>
            <Text style={styles.summarySub}>{t('wordLobby.cardSub')}</Text>
          </View>
        </View>

        <Pressable
          onPress={onPrimary}
          disabled={!playAllowed}
          style={({ pressed }) => [
            styles.primaryBtn,
            !playAllowed && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {playKind === 'solo' ? t('wordLobby.startSolo') : t('wordLobby.startRoom')}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
        </Pressable>

        {playAllowed && (activeVenueId || subscriptionActive) && (playKind === 'coop' || playKind === 'versus') ? (
          <>
            <Pressable
              onPress={onFindMatch}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('wordLobby.findMatch')}</Text>
            </Pressable>
            <Text style={styles.queueHint}>{t('wordLobby.queueGlobalHint')}</Text>
          </>
        ) : null}

        <Pressable
          onPress={() => {
            if (!playAllowed) return;
            navigation.navigate('WordMatchJoin', {
              ...(activeVenueId ? { venueId: activeVenueId } : {}),
              challengeId,
            });
          }}
          disabled={!playAllowed}
          style={({ pressed }) => [
            styles.linkBtn,
            !playAllowed && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="key-outline" size={16} color={colors.primary} />
          <Text style={styles.linkBtnText}>{t('wordLobby.joinWithCode')}</Text>
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
    },
    checkInWrap: { marginBottom: spacing.md },
    lockBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.errorMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
    },
    lockBannerText: {
      flex: 1,
      color: colors.error,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    summaryIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    summaryCopy: { flex: 1, gap: spacing.xs },
    summaryTitle: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 14,
      lineHeight: 20,
    },
    summarySub: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
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
      marginBottom: spacing.sm,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 16,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      marginBottom: spacing.sm,
    },
    secondaryBtnText: {
      color: colors.primaryDark,
      fontWeight: '800',
      fontSize: 14,
      textAlign: 'center',
      flexShrink: 1,
    },
    queueHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    linkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
    },
    linkBtnText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.9 },
  });
}
