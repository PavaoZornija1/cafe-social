import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PlatformQuestHubPayload } from '../../lib/platformQuestApi';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  bundle: PlatformQuestHubPayload['bundle'];
  periodLabel: string;
  completedLabel: string;
  remainingLabel: string;
  claimLabel: string;
  claiming: boolean;
  onClaim: () => void;
};

export default function QuestBundleCard({
  colors,
  bundle,
  periodLabel,
  completedLabel,
  remainingLabel,
  claimLabel,
  claiming,
  onClaim,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>{periodLabel}</Text>
          <Text style={styles.title}>{bundle.title}</Text>
          <Text style={styles.reward}>+{bundle.xpReward} XP</Text>
          <Text style={styles.perkUnlock}>
            {t('questHub.bundlePerkUnlock', { label: bundle.bonusLabel })}
          </Text>
        </View>
        <View style={styles.giftIcon}>
          <Ionicons name="gift" size={28} color={colors.textInverse} />
        </View>
      </View>

      <View style={styles.stepsRow}>
        {Array.from({ length: bundle.targetCount }).map((_, index) => {
          const done = index < bundle.completedCount;
          return (
            <React.Fragment key={index}>
              {index > 0 ? (
                <View style={[styles.connector, done && styles.connectorDone]} />
              ) : null}
              <View style={[styles.step, done && styles.stepDone]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                ) : null}
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{completedLabel}</Text>
        <Text style={styles.footerText}>{remainingLabel}</Text>
      </View>

      {bundle.canClaim ? (
        <Pressable
          onPress={onClaim}
          disabled={claiming}
          style={({ pressed }) => [styles.claimBtn, pressed && styles.pressed]}
        >
          <Text style={styles.claimBtnText}>{claimLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    top: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    copy: { flex: 1, gap: 4 },
    kicker: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    reward: {
      color: colors.xp,
      fontSize: 14,
      fontWeight: '700',
    },
    perkUnlock: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    giftIcon: {
      width: 56,
      height: 56,
      borderRadius: radii.lg,
      backgroundColor: colors.xp,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    step: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    connector: {
      width: 18,
      height: 3,
      backgroundColor: colors.border,
      marginHorizontal: 2,
    },
    connectorDone: {
      backgroundColor: colors.primary,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    claimBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    claimBtnText: {
      color: colors.textInverse,
      fontSize: 15,
      fontWeight: '800',
    },
    pressed: { opacity: 0.9 },
  });
}
