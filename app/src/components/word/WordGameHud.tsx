import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import LinearGradientFill from '../ui/LinearGradientFill';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  progressCurrent: number;
  progressTotal: number;
  progressLabel: string;
  correctCount: number;
  timeLeft: number | null;
  matchMode: 'solo' | 'coop' | 'versus';
  difficultyLabel: string;
  ranked?: boolean;
};

export default function WordGameHud({
  colors,
  progressCurrent,
  progressTotal,
  progressLabel,
  correctCount,
  timeLeft,
  matchMode,
  difficultyLabel,
  ranked,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressPct =
    progressTotal > 0 ? Math.min(1, Math.max(0, progressCurrent / progressTotal)) : 0;
  const urgent = timeLeft !== null && timeLeft <= 15;
  const modeLabel =
    matchMode === 'coop'
      ? t('wordLobby.modeCoop')
      : matchMode === 'versus'
        ? t('wordLobby.modeVersus')
        : t('wordLobby.modeSolo');

  return (
    <View style={styles.outer}>
      <LinearGradientFill
        from={colors.heroDark}
        to={colors.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.topRow}>
        <View style={styles.progressCopy}>
          <Text style={styles.kicker}>{t('wordGame.hudProgressKicker')}</Text>
          <Text style={styles.progressLine} numberOfLines={2}>
            {progressLabel}
          </Text>
        </View>
        {timeLeft !== null ? (
          <View style={[styles.timerPill, urgent && styles.timerPillUrgent]}>
            <Ionicons
              name="timer-outline"
              size={16}
              color={urgent ? colors.error : colors.textInverse}
            />
            <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>
              {Math.max(0, timeLeft)}s
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progressPct * 100)}%` }]} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{modeLabel}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{difficultyLabel}</Text>
          </View>
          {ranked ? (
            <View style={[styles.badge, styles.badgeRanked]}>
              <Ionicons name="ribbon-outline" size={12} color={colors.xp} />
              <Text style={[styles.badgeText, styles.badgeTextRanked]}>
                {t('wordMatch.rankedBadge')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.correct}>{t('wordGame.correct', { count: correctCount })}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    outer: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.md,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    progressCopy: { flex: 1, gap: 2 },
    kicker: {
      color: colors.textInverse,
      opacity: 0.82,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    progressLine: {
      color: colors.textInverse,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    timerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    timerPillUrgent: {
      backgroundColor: colors.errorMuted,
    },
    timerText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    timerTextUrgent: { color: colors.error },
    track: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      backgroundColor: colors.textInverse,
      borderRadius: radii.pill,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      flex: 1,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    badgeRanked: {
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    badgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    badgeTextRanked: { color: colors.honeyDark },
    correct: {
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '800',
    },
  });
}
