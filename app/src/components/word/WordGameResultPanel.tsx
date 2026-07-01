import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import LinearGradientFill from '../ui/LinearGradientFill';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { VersusParticipant } from './WordGameVersusBoard';

type Props = {
  colors: AppColors;
  won: boolean;
  matchMode: 'solo' | 'coop' | 'versus';
  participants: VersusParticipant[];
  showRematch: boolean;
  rematchBusy: boolean;
  onRematch: () => void;
  onDone: () => void;
};

export default function WordGameResultPanel({
  colors,
  won,
  matchMode,
  participants,
  showRematch,
  rematchBusy,
  onRematch,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, won ? styles.heroWin : styles.heroLoss]}>
        {won ? (
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
        ) : null}
        <View style={[styles.iconWrap, !won && styles.iconWrapLoss]}>
          <Ionicons
            name={won ? 'trophy' : 'flag-outline'}
            size={28}
            color={won ? colors.textInverse : colors.text}
          />
        </View>
        <Text style={[styles.title, !won && styles.titleLoss]}>{t('wordGame.matchOver')}</Text>
        <Text style={[styles.sub, !won && styles.subLoss]}>
          {won ? t('wordGame.matchWon') : t('wordGame.matchLost')}
        </Text>
      </View>

      {matchMode === 'versus' && participants.length > 0 ? (
        <View style={styles.scoresCard}>
          <Text style={styles.scoresLabel}>{t('wordGame.finalScores')}</Text>
          {participants.map((p) => (
            <View key={p.id} style={[styles.scoreRow, p.isYou && styles.scoreRowMe]}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {p.username}
                {p.isYou ? ` · ${t('wordGame.you')}` : ''}
              </Text>
              <Text style={styles.scoreValue}>
                {p.score}
                {p.result === 'WIN' ? ' 🏆' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {showRematch ? (
        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            rematchBusy && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          disabled={rematchBusy}
          onPress={() => void onRematch()}
        >
          {rematchBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryBtnText}>{t('wordGame.rematch')}</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        onPress={() => void onDone()}
      >
        <Text style={styles.primaryBtnText}>{t('wordGame.back')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
      alignItems: 'flex-start',
      overflow: 'hidden',
    },
    heroWin: { backgroundColor: colors.hero },
    heroLoss: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    iconWrapLoss: {
      backgroundColor: colors.primaryMuted,
    },
    title: {
      color: colors.textInverse,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    titleLoss: { color: colors.text },
    sub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    subLoss: { color: colors.textSecondary, opacity: 1 },
    scoresCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    scoresLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    scoreRowMe: {
      backgroundColor: colors.primaryMuted,
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
    },
    scoreName: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    scoreValue: { color: colors.xp, fontSize: 14, fontWeight: '900' },
    primaryBtn: {
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 15 },
    secondaryBtn: {
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      marginBottom: spacing.sm,
      minHeight: 48,
      justifyContent: 'center',
    },
    secondaryBtnText: { color: colors.textSecondary, fontWeight: '900', fontSize: 14 },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.88 },
  });
}
