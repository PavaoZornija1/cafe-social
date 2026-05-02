import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

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
  const { venueId, challengeId } = route.params ?? {};
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playKind, setPlayKind] = useState<PlayKind>('solo');
  /** Versus only: ranked affects rating (casual does not). */
  const [versusRanked, setVersusRanked] = useState(false);
  const [wordCount, setWordCount] = useState<number>(5);
  const [wordCategory, setWordCategory] = useState<(typeof WORD_CATEGORY_KEYS)[number] | null>(
    null,
  );

  const difficultyLabel = useMemo(() => {
    if (difficulty === 'easy') return t('wordLobby.easyDesc');
    if (difficulty === 'normal') return t('wordLobby.normalDesc');
    return t('wordLobby.hardDesc');
  }, [difficulty, t]);

  const appDeckLang = toApiWordLanguage(i18n.language);
  const appDeckLabel = t(`wordMatch.lang.${appDeckLang}`, {
    defaultValue: appDeckLang.toUpperCase(),
  });

  const onPrimary = () => {
    if (playKind === 'solo') {
      navigation.navigate('WordGame', {
        venueId,
        challengeId,
        difficulty,
        mode: 'solo',
        sessionWordsCount: wordCount,
        wordCategory: wordCategory ?? undefined,
      });
      return;
    }
    navigation.navigate('WordMatchWait', {
      venueId,
      challengeId,
      mode: playKind,
      difficulty,
      create: true,
      wordCount,
      wordCategory: wordCategory ?? undefined,
      ranked: playKind === 'versus' && versusRanked ? true : undefined,
    });
  };

  const onQueueAtVenue = () => {
    if (!venueId) return;
    if (playKind !== 'coop' && playKind !== 'versus') return;
    navigation.navigate('WordVenueQueue', {
      venueId,
      challengeId,
      mode: playKind,
      difficulty,
      wordCount,
      wordCategory: wordCategory ?? undefined,
      ranked: playKind === 'versus' && versusRanked ? true : undefined,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.topHeaderTitle}>{t('wordLobby.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          {venueId ? t('wordLobby.venueLine', { venueId }) : t('wordLobby.globalLine')}
        </Text>
        <Text style={styles.languageHint}>
          {t('wordLobby.appLanguageDeck', { lang: appDeckLabel })}
        </Text>

        <Text style={styles.sectionTitle}>{t('wordLobby.playModeTitle')}</Text>
        <View style={styles.segmentRow}>
          {(['solo', 'coop', 'versus'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setPlayKind(k)}
              style={({ pressed }) => [
                styles.segment,
                pressed && styles.segmentPressed,
                playKind === k && styles.segmentActive,
              ]}
            >
              <Text style={styles.segmentText}>
                {k === 'solo' ? t('wordLobby.modeSolo') : k === 'coop' ? t('wordLobby.modeCoop') : t('wordLobby.modeVersus')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.modeHint}>
          {playKind === 'solo'
            ? t('wordLobby.modeSoloHint')
            : playKind === 'coop'
              ? t('wordLobby.modeCoopHint')
              : t('wordLobby.modeVersusHint')}
        </Text>

        {playKind === 'versus' ? (
          <>
            <Text style={styles.sectionTitle}>{t('wordLobby.versusMatchTypeTitle')}</Text>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => setVersusRanked(false)}
                style={({ pressed }) => [
                  styles.segment,
                  pressed && styles.segmentPressed,
                  !versusRanked && styles.segmentActive,
                ]}
              >
                <Text style={styles.segmentText}>{t('wordLobby.versusCasual')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setVersusRanked(true)}
                style={({ pressed }) => [
                  styles.segment,
                  pressed && styles.segmentPressed,
                  versusRanked && styles.segmentActive,
                ]}
              >
                <Text style={styles.segmentText}>{t('wordLobby.versusRanked')}</Text>
              </Pressable>
            </View>
            <Text style={styles.modeHint}>
              {versusRanked ? t('wordLobby.versusRankedHint') : t('wordLobby.versusCasualHint')}
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t('wordLobby.deckLengthTitle')}</Text>
        <View style={styles.chipRow}>
          {WORD_COUNT_OPTIONS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setWordCount(n)}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.segmentPressed,
                wordCount === n && styles.chipActive,
              ]}
            >
              <Text style={styles.chipText}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.modeHint}>{t('wordLobby.deckLengthHint')}</Text>

        <Text style={styles.sectionTitle}>{t('wordLobby.categoryTitle')}</Text>
        <View style={styles.chipRowWrap}>
          <Pressable
            onPress={() => setWordCategory(null)}
            style={({ pressed }) => [
              styles.chip,
              pressed && styles.segmentPressed,
              wordCategory === null && styles.chipActive,
            ]}
          >
            <Text style={styles.chipText}>{t('wordLobby.categoryAll')}</Text>
          </Pressable>
          {WORD_CATEGORY_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setWordCategory(key)}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.segmentPressed,
                wordCategory === key && styles.chipActive,
              ]}
            >
              <Text style={styles.chipText}>{t(`categories.${key}`)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('wordLobby.difficultyTitle')}</Text>
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setDifficulty('easy')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'easy' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>{t('wordLobby.easy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDifficulty('normal')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'normal' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>{t('wordLobby.normal')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDifficulty('hard')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'hard' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>{t('wordLobby.hard')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{difficultyLabel}</Text>
          <Text style={styles.cardSub}>{t('wordLobby.cardSub')}</Text>
        </View>

        <Pressable onPress={onPrimary} style={styles.playBtn}>
          <Text style={styles.playBtnText}>
            {playKind === 'solo' ? t('wordLobby.startSolo') : t('wordLobby.startRoom')}
          </Text>
        </Pressable>

        {venueId && (playKind === 'coop' || playKind === 'versus') ? (
          <Pressable onPress={onQueueAtVenue} style={styles.queueBtn}>
            <Text style={styles.queueBtnText}>{t('wordLobby.queueAtVenue')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate('WordMatchJoin', { venueId, challengeId })}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{t('wordLobby.joinWithCode')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topHeader: {
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
  topHeaderTitle: { color: colors.text, fontSize: 22, fontWeight: '900', flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  subtitle: { color: colors.textMuted, marginTop: 8, fontSize: 13 },
  languageHint: { color: colors.textMuted, marginTop: 6, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontWeight: '900', marginTop: 22, marginBottom: 10, fontSize: 14 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  segmentPressed: { opacity: 0.9 },
  segmentActive: { borderColor: colors.honey, backgroundColor: colors.surface },
  segmentText: { color: colors.text, fontWeight: '900', fontSize: 12, textAlign: 'center' },
  modeHint: { color: colors.textMuted, fontSize: 12, marginTop: 10, lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { color: colors.text, fontWeight: '900' },
  cardSub: { color: colors.textMuted, marginTop: 8, lineHeight: 18, fontSize: 13 },
  playBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
  queueBtn: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.honey,
  },
  queueBtnText: { color: colors.honeyDark, fontWeight: '900', fontSize: 15 },
  secondary: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.honeyDark, fontWeight: '900' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.honey, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontWeight: '800', fontSize: 12 },

    });
}
