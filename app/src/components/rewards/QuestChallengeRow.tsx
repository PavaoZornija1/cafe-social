import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlatformQuestIcon, PlatformQuestRow } from '../../lib/platformQuestApi';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  quest: PlatformQuestRow;
  claimLabel: string;
  claimedLabel: string;
  claiming: boolean;
  onPress: () => void;
  onClaim: () => void;
};

const ICON_MAP: Record<PlatformQuestIcon, ComponentProps<typeof Ionicons>['name']> = {
  location: 'location',
  trophy: 'trophy',
  'game-controller': 'game-controller',
  sparkles: 'sparkles',
  flash: 'flash',
  map: 'map',
  calendar: 'calendar',
  star: 'star',
};

const ICON_BG: Record<PlatformQuestIcon, string> = {
  location: '#2E6DED',
  trophy: '#EC4899',
  'game-controller': '#1E4FC4',
  sparkles: '#6B7280',
  flash: '#E68A00',
  map: '#16A34A',
  calendar: '#8B5CF6',
  star: '#F59E0B',
};

export default function QuestChallengeRow({
  colors,
  quest,
  claimLabel,
  claimedLabel,
  claiming,
  onPress,
  onClaim,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const claimed = quest.status === 'claimed';
  const claimable = quest.status === 'claimable';
  const progressPct =
    quest.targetCount > 0 ? Math.min(1, quest.progressCount / quest.targetCount) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        claimed && styles.cardClaimed,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconWrap}>
        <View style={[styles.iconBox, { backgroundColor: ICON_BG[quest.icon] }]}>
          <Ionicons
            name={ICON_MAP[quest.icon]}
            size={22}
            color={colors.textInverse}
            style={claimed ? styles.iconDim : undefined}
          />
        </View>
        {claimable || claimed ? (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={10} color={colors.textInverse} />
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, claimed && styles.titleClaimed]} numberOfLines={2}>
          {quest.title}
        </Text>
        {quest.subtitle ? (
          <Text style={[styles.subtitle, claimed && styles.subtitleClaimed]} numberOfLines={1}>
            {quest.subtitle}
          </Text>
        ) : null}

        {!claimed && quest.targetCount > 1 ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
            </View>
            <Text style={styles.progressMeta}>
              {quest.progressCount} / {quest.targetCount}
            </Text>
            <Text style={styles.xpTag}>+{quest.xpReward}</Text>
          </View>
        ) : null}

        {claimable ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onClaim();
            }}
            disabled={claiming}
            style={({ pressed }) => [styles.claimBtn, pressed && styles.pressed]}
          >
            <Text style={styles.claimBtnText}>{claimLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
          </Pressable>
        ) : null}

        {claimed ? (
          <Text style={styles.claimedText}>{claimedLabel}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    cardClaimed: {
      opacity: 0.72,
    },
    pressed: { opacity: 0.92 },
    iconWrap: { position: 'relative' },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDim: { opacity: 0.65 },
    badge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 18,
      height: 18,
      borderRadius: radii.pill,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0, gap: spacing.sm },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    titleClaimed: {
      color: colors.textMuted,
    },
    subtitle: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '600',
    },
    subtitleClaimed: {
      color: colors.textMuted,
    },
    progressBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.xp,
    },
    progressMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      minWidth: 52,
      textAlign: 'right',
    },
    xpTag: {
      color: colors.xp,
      fontSize: 12,
      fontWeight: '800',
    },
    claimBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      alignSelf: 'flex-start',
    },
    claimBtnText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    claimedText: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
