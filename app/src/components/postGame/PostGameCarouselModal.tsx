import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  onComplete: () => void;
  /** In-arena overlay avoids RN Modal + landscape lock crashes on iOS. */
  variant?: 'modal' | 'overlay';
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
  onComplete,
  variant = 'modal',
}: Props) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = variant === 'overlay';
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const slides = useMemo(() => (payload ? buildSlides(payload) : []), [payload]);
  const [index, setIndex] = useState(0);
  const [pagerWidth, setPagerWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pagerRef = useRef<ScrollView>(null);
  const goToRef = useRef<(nextIndex: number, animated?: boolean) => void>(() => {});
  /** Once the summary slide is reached, never auto-advance again this session. */
  const autoAdvanceDisabledRef = useRef(false);

  useEffect(() => {
    autoAdvanceDisabledRef.current = false;
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

  const goTo = useCallback(
    (nextIndex: number, animated = true) => {
      clearTimer();
      const clamped = Math.max(0, Math.min(nextIndex, slides.length - 1));
      setIndex(clamped);
      if (pagerWidth > 0) {
        pagerRef.current?.scrollTo({ x: clamped * pagerWidth, animated });
      }
    },
    [clearTimer, pagerWidth, slides.length],
  );

  goToRef.current = goTo;

  const scheduleAdvance = useCallback(
    (fromIndex: number) => {
      clearTimer();
      if (!visible || slides.length === 0) return;
      if (autoAdvanceDisabledRef.current) return;
      if (fromIndex >= slides.length - 1) return;
      timerRef.current = setTimeout(() => {
        goToRef.current(fromIndex + 1);
      }, AUTO_ADVANCE_MS);
    },
    [clearTimer, slides.length, visible],
  );

  useEffect(() => {
    if (slides.length > 0 && index >= slides.length - 1) {
      autoAdvanceDisabledRef.current = true;
      clearTimer();
    }
  }, [clearTimer, index, slides.length]);

  useEffect(() => {
    if (!visible || slides.length === 0) return undefined;
    scheduleAdvance(index);
    return clearTimer;
  }, [visible, slides.length, index, scheduleAdvance, clearTimer]);

  useEffect(() => {
    if (!visible || pagerWidth <= 0) return;
    pagerRef.current?.scrollTo({ x: index * pagerWidth, animated: false });
  }, [visible, pagerWidth]);

  const onPagerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pagerWidth <= 0 || slides.length === 0) return;
      const next = Math.max(
        0,
        Math.min(slides.length - 1, Math.round(event.nativeEvent.contentOffset.x / pagerWidth)),
      );
      if (next !== index) {
        setIndex(next);
      }
    },
    [index, pagerWidth, slides.length],
  );

  if (!visible || !payload || !actions) return null;

  const slide = slides[index];
  const isSummary = slide?.kind === 'summary';
  const summary = payload.summary;

  const overlayPad = compact ? spacing.md : spacing.xl;
  const availW = width - insets.left - insets.right;
  const availH = height - insets.top - insets.bottom;
  const sheetMaxWidth = compact
    ? Math.min(availW * 0.58, availH * 0.88, 320)
    : Math.min(availW - overlayPad * 2, 420);
  const sheetMaxHeight = compact ? undefined : Math.max(220, availH - overlayPad * 2);

  const sheet = (
    <View
      style={[
        styles.sheet,
        {
          maxWidth: sheetMaxWidth,
          ...(sheetMaxHeight != null ? { maxHeight: sheetMaxHeight } : null),
        },
      ]}
    >
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

      <View
        style={styles.pagerHost}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== pagerWidth) {
            setPagerWidth(nextWidth);
          }
        }}
      >
        {pagerWidth > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            scrollEnabled={slides.length > 1}
            bounces={slides.length > 1}
            onMomentumScrollEnd={onPagerScrollEnd}
            scrollEventThrottle={16}
            style={styles.pager}
          >
            {slides.map((item, i) => (
              <View key={i} style={[styles.page, { width: pagerWidth }]}>
                {item.kind === 'moment' ? (
                  <MomentSlide colors={colors} moment={item.moment} compact={compact} />
                ) : (
                  <SummarySlide colors={colors} summary={item.summary} compact={compact} />
                )}
              </View>
            ))}
          </ScrollView>
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
            onPress={onComplete}
          >
            <Text style={styles.primaryBtnText}>{t('postGame.done')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (variant === 'overlay') {
    return (
      <View style={styles.overlayHost} pointerEvents="box-none">
        <View style={[styles.overlayBackdrop, { backgroundColor: colors.overlay }]} />
        <View
          style={[
            styles.overlayCenter,
            {
              paddingTop: insets.top + overlayPad,
              paddingBottom: insets.bottom + overlayPad,
              paddingLeft: insets.left + overlayPad,
              paddingRight: insets.right + overlayPad,
            },
          ]}
        >
          {sheet}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        {sheet}
      </View>
    </Modal>
  );
}

function MomentSlide({
  colors,
  moment,
  compact = false,
}: {
  colors: AppColors;
  moment: PostGameMoment;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
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
      <SunburstHero colors={colors} icon={moment.icon} compact={compact} />
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

function SummarySlide({
  colors,
  summary,
  compact = false,
}: {
  colors: AppColors;
  summary: PostGameSummary;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const won = summary.won;

  return (
    <View style={styles.slideBody}>
      <SunburstHero colors={colors} icon="trophy" won={won} compact={compact} />
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

function createStyles(colors: AppColors, compact = false) {
  return StyleSheet.create({
    overlayHost: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2000,
      elevation: 2000,
    },
    overlayBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    overlayCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
      borderRadius: compact ? radii.lg : radii.xl,
      padding: compact ? spacing.lg : spacing.xl,
      gap: compact ? spacing.sm : spacing.md,
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
    pagerHost: {
      width: '100%',
    },
    pager: {
      width: '100%',
    },
    page: {
      minHeight: compact ? undefined : 280,
    },
    slideBody: {
      gap: compact ? spacing.xs : spacing.md,
      paddingBottom: compact ? 0 : spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: compact ? 17 : 22,
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: compact ? 12 : 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: compact ? 16 : 20,
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
      borderRadius: compact ? radii.md : radii.lg,
      padding: compact ? spacing.sm : spacing.md,
      gap: compact ? 2 : spacing.xs,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: compact ? 2 : spacing.xs,
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
      fontSize: compact ? 12 : 14,
      fontWeight: '700',
    },
    scoreValue: {
      color: colors.xp,
      fontSize: compact ? 12 : 14,
      fontWeight: '900',
    },
    footer: {
      gap: spacing.sm,
    },
    primaryBtn: {
      borderRadius: radii.lg,
      paddingVertical: compact ? spacing.md : spacing.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontSize: compact ? 15 : 16,
      fontWeight: '900',
    },
    secondaryBtn: {
      borderRadius: radii.lg,
      paddingVertical: compact ? spacing.md : spacing.lg,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      minHeight: compact ? 42 : 48,
      justifyContent: 'center',
    },
    secondaryBtnText: {
      color: colors.textSecondary,
      fontWeight: '900',
      fontSize: 14,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.92 },
  });
}
