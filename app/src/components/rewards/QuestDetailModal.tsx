import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { PlatformQuestRow } from '../../lib/platformQuestApi';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  visible: boolean;
  quest: PlatformQuestRow | null;
  questIndex: number;
  questTotal: number;
  streak: number;
  playLabel: string;
  xpRewardLabel: string;
  onClose: () => void;
  onPlay: () => void;
};

export default function QuestDetailModal({
  colors,
  visible,
  quest,
  questIndex,
  questTotal,
  streak,
  playLabel,
  xpRewardLabel,
  onClose,
  onPlay,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!quest) return null;

  const progressPct =
    quest.targetCount > 0 ? Math.min(1, quest.progressCount / quest.targetCount) : 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
            <View style={styles.dots}>
              {Array.from({ length: questTotal }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === questIndex && styles.dotActive]}
                />
              ))}
            </View>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={14} color={colors.accentPink} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Ionicons name="trophy" size={72} color={colors.xp} />
          </View>

          <Text style={styles.title}>{quest.title}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {quest.progressCount} / {quest.targetCount}
          </Text>

          <View style={styles.rewardRow}>
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>{xpRewardLabel}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
            <View style={styles.perkPill}>
              <Ionicons name="cafe-outline" size={16} color={colors.primary} />
              <Text style={styles.perkPillText}>XP</Text>
            </View>
          </View>

          <Pressable
            onPress={onPlay}
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
          >
            <Ionicons name="play" size={18} color={colors.textInverse} />
            <Text style={styles.playBtnText}>{playLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    sheet: {
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
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.pill,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    streakText: {
      color: colors.accentPink,
      fontWeight: '800',
      fontSize: 13,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
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
      marginVertical: spacing.sm,
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
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.sm,
    },
    playBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    pressed: { opacity: 0.92 },
  });
}
