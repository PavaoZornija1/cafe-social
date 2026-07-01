import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

export type VersusParticipant = {
  id: string;
  username: string;
  score: number;
  isYou: boolean;
  result?: string | null;
};

type Props = {
  colors: AppColors;
  participants: VersusParticipant[];
};

const AVATAR_COLORS = ['#FBBF24', '#F87171', '#34D399', '#60A5FA', '#A78BFA'];

function initial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export default function WordGameVersusBoard({ colors, participants }: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sorted = [...participants].sort((a, b) => {
    if (a.isYou) return -1;
    if (b.isYou) return 1;
    return b.score - a.score;
  });
  const leaderScore = Math.max(...participants.map((p) => p.score), 0);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('wordGame.versusBoardTitle')}</Text>
      <View style={styles.row}>
        {sorted.map((p, index) => {
          const leading = leaderScore > 0 && p.score === leaderScore;
          return (
            <View
              key={p.id}
              style={[styles.playerCard, p.isYou && styles.playerCardYou, leading && styles.playerCardLead]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                ]}
              >
                <Text style={styles.avatarText}>{initial(p.username)}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {p.username}
                {p.isYou ? ` · ${t('wordGame.you')}` : ''}
              </Text>
              <Text style={styles.score}>{p.score}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    playerCard: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    playerCardYou: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    playerCardLead: {
      borderColor: colors.xp,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 15,
    },
    name: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
    score: {
      color: colors.xp,
      fontSize: 22,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
  });
}
