import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';

type Props = NativeStackScreenProps<RootStackParamList, 'WordLobby'>;

type Difficulty = 'easy' | 'normal' | 'hard';
type PlayKind = 'solo' | 'coop' | 'versus';

export default function WordLobbyScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { venueId, challengeId } = route.params ?? {};
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [playKind, setPlayKind] = useState<PlayKind>('solo');

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
        sessionWordsCount: 5,
      });
      return;
    }
    navigation.navigate('WordMatchWait', {
      venueId,
      challengeId,
      mode: playKind,
      difficulty,
      create: true,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('wordLobby.title')}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#9ca3af', marginTop: 8, fontSize: 13 },
  languageHint: { color: '#6b7280', marginTop: 6, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontWeight: '900', marginTop: 22, marginBottom: 10, fontSize: 14 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  segmentPressed: { opacity: 0.9 },
  segmentActive: { borderColor: '#a78bfa', backgroundColor: '#0b1220' },
  segmentText: { color: '#f9fafb', fontWeight: '900', fontSize: 12, textAlign: 'center' },
  modeHint: { color: '#6b7280', fontSize: 12, marginTop: 10, lineHeight: 17 },
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { color: '#fff', fontWeight: '900' },
  cardSub: { color: '#9ca3af', marginTop: 8, lineHeight: 18, fontSize: 13 },
  playBtn: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondary: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  secondaryText: { color: '#a5b4fc', fontWeight: '900' },
});
