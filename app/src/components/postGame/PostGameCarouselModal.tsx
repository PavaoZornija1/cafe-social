import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import SunburstHero from './SunburstHero';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type {
  PostGameCarouselActions,
  PostGameMoment,
  PostGamePayload,
  PostGameSummary,
} from '../../lib/postGame/types';

const AUTO_ADVANCE_MS = 3000;

type Slide =
  | { kind: 'moment'; moment: PostGameMoment }
  | { kind: 'summary'; summary: PostGameSummary };

type Props = {
  colors: AppColors;
  visible: boolean;
  payload: PostGamePayload | null;
  actions: PostGameCarouselActions | null;
  onClose: () => void;
};

function buildSlides(payload: PostGamePayload): Slide[] {
  const momentSlides: Slide[] = payload.moments.map((moment) => ({ kind: 'moment', moment }));
  return [...momentSlides, { kind: 'summary', summary: payload.summary }];
}

export default function PostGameCarouselModal({
  colors,
  visible,
  payload,
  actions,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slides = useMemo(() => (payload ? buildSlides(payload) : []), [payload]);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setIndex(0);
    }
  }, [visible, payload]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleAdvance = useCallback(
    (fromIndex: number) => {
      clearTimer();
      if (!visible || slides.length === 0) return;
      if (fromIndex >= slides.length - 1) return;
      timerRef.current = setTimeout(() => {
        setIndex((current) => {
          const next = Math.min(current + 1, slides.length - 1);
          if (next < slides.length - 1) {
            scheduleAdvance(next);
          }
          return next;
        });
      }, AUTO_ADVANCE_MS);
    },
    [clearTimer, slides.length, visible],
  );

  useEffect(() => {
    if (!visible || slides.length === 0) return undefined;
    scheduleAdvance(index);
    return clearTimer;
  }, [visible, slides.length, index, scheduleAdvance, clearTimer]);

  const goTo = (nextIndex: number) => {
    clearTimer();
    setIndex(nextIndex);
    if (nextIndex < slides.length - 1) {
      scheduleAdvance(nextIndex);
    }
  };

  if (!payload || !actions) return null;

  const slide = slides[index];
  const isSummary = slide?.kind === 'summary';
  const summary = payload.summary;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { maxWidth: Math.min(width - spacing.xl * 2, 420) }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
            <View style={styles.dots}>
              {slides.map((_, i) => (
                <Pressable key={i} onPress={() => goTo(i)} accessibilityRole="button">
                  <View style={[styles.dot, i === index && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.page}>
            {slide?.kind === 'moment' ? (
              <MomentSlide colors={colors} moment={slide.moment} />
            ) : slide?.kind === 'summary' ? (
              <SummarySlide colors={colors} summary={slide.summary} />
            ) : null}
          </View>

          {isSummary ? (
            <View style={styles.footer}>
              {summary.showRematch && actions.onRematch ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    actions.rematchBusy && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                  disabled={actions.rematchBusy}
                  onPress={() => actions.onRematch?.()}
                >
                  {actions.rematchBusy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>{t('postGame.rematch')}</Text>
                  )}
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={() => actions.onDone()}
              >
                <Text style={styles.primaryBtnText}>{t('postGame.done')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.autoHint}>{t('postGame.autoAdvanceHint')}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MomentSlide({ colors, moment }: { colors: AppColors; moment: PostGameMoment }) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressPct =
    moment.progressTarget && moment.progressTarget > 0 && moment.progressCount != null
      ? Math.min(1, moment.progressCount / moment.progressTarget)
      : null;

  const tierHint =
    moment.kind === 'tier_up' && moment.previousTierLabel
      ? `${moment.previousTierLabel} → ${moment.tierLabel ?? moment.title}`
      : null;

  return (
    <View style={styles.slideBody}>
      <SunburstHero colors={colors} icon={moment.icon} />
      <Text style={styles.title}>{moment.title}</Text>
      {moment.subtitle ? <Text style={styles.subtitle}>{moment.subtitle}</Text> : null}
      {tierHint ? <Text style={styles.tierHint}>{tierHint}</Text> : null}
      {moment.kind === 'tier_up' && moment.nextTierName ? (
        <Text style={styles.nextTierHint}>
          {t('postGame.nextTierHint', { tier: moment.nextTierName })}
        </Text>
      ) : null}
      {progressPct != null ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {moment.progressCount}/{moment.progressTarget}
          </Text>
        </>
      ) : null}
      {(moment.xpAmount || moment.perkTitle) ? (
        <View style={styles.rewardRow}>
          {moment.xpAmount ? (
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>+{moment.xpAmount} XP</Text>
            </View>
          ) : null}
          {moment.xpAmount && moment.perkTitle ? (
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
          ) : null}
          {moment.perkTitle ? (
            <View style={styles.perkPill}>
              <Ionicons name="cafe-outline" size={16} color={colors.primary} />
              <Text style={styles.perkPillText}>{moment.perkTitle}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SummarySlide({ colors, summary }: { colors: AppColors; summary: PostGameSummary }) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const won = summary.won;

  return (
    <View style={styles.slideBody}>
      <SunburstHero colors={colors} icon="trophy" won={won} />
      <Text style={styles.title}>{t('postGame.summaryTitle')}</Text>
      <Text style={styles.subtitle}>
        {won ? t('postGame.summaryWon') : t('postGame.summaryLost')}
      </Text>
      {summary.participants && summary.participants.length > 0 ? (
        <View style={styles.scoresCard}>
          {summary.participants.map((p) => (
            <View key={`${p.username}-${p.isYou ? 'you' : 'other'}`} style={[styles.scoreRow, p.isYou && styles.scoreRowMe]}>
              <Text style={styles.scoreName} numberOfLines={1}>
                {p.username}
                {p.isYou ? ` · ${t('wordGame.you')}` : ''}
              </Text>
              <Text style={styles.scoreValue}>
                {summary.game === 'brawler'
                  ? `${p.kills ?? 0}/${p.deaths ?? 0}${p.xpGained ? ` · +${p.xpGained} XP` : ''}`
                  : `${p.score}${p.result === 'WIN' ? ' 🏆' : ''}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    sheet: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: { width: 36 },
    dots: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.xp,
    },
    page: {
      minHeight: 280,
    },
    slideBody: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 20,
    },
    tierHint: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    nextTierHint: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    progressTrack: {
      height: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.xp,
      borderRadius: radii.pill,
    },
    progressLabel: {
      textAlign: 'right',
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    xpPill: {
      backgroundColor: colors.honeyMuted,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    xpPillText: {
      color: colors.xp,
      fontWeight: '800',
      fontSize: 14,
    },
    perkPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    perkPillText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    scoresCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.xs,
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
    scoreValue: {
      color: colors.xp,
      fontSize: 14,
      fontWeight: '900',
    },
    footer: {
      gap: spacing.sm,
    },
    primaryBtn: {
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '900',
    },
    secondaryBtn: {
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    secondaryBtnText: {
      color: colors.textSecondary,
      fontWeight: '900',
      fontSize: 14,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.92 },
    autoHint: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
