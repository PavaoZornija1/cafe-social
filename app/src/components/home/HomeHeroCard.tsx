import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { FriendAtVenueRow } from './types';

type Props = {
  colors: AppColors;
  streak: number;
  friendsHere: FriendAtVenueRow[];
  disabled: boolean;
  lockedHint?: string;
  onPlay: () => void;
};

function friendInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export default function HomeHeroCard({
  colors,
  streak,
  friendsHere,
  disabled,
  lockedHint,
  onPlay,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibleFriends = friendsHere.slice(0, 3);
  const extraCount = Math.max(0, friendsHere.length - visibleFriends.length);

  return (
    <Pressable
      onPress={onPlay}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('home.dashboard.heroA11y')}
      accessibilityState={{ disabled }}
    >
      <View style={styles.topRow}>
        <View style={styles.streakBlock}>
          <Text style={styles.streakLabel}>{t('home.dashboard.streak')}</Text>
          <Text style={styles.streakValue}>{streak}</Text>
        </View>
        <View style={styles.friendsBlock}>
          <Text style={styles.friendsLabel}>{t('home.dashboard.friendsHere')}</Text>
          {friendsHere.length === 0 ? (
            <Text style={styles.friendsEmpty}>{t('home.dashboard.noFriendsHere')}</Text>
          ) : (
            <View style={styles.avatarRow}>
              {visibleFriends.map((friend, index) => (
                <View
                  key={friend.id}
                  style={[styles.friendAvatar, index > 0 && styles.friendAvatarOverlap]}
                >
                  <Text style={styles.friendInitial}>{friendInitial(friend.username)}</Text>
                </View>
              ))}
              {extraCount > 0 ? (
                <View style={[styles.friendAvatar, styles.friendAvatarOverlap, styles.friendMore]}>
                  <Text style={styles.friendMoreText}>+{extraCount}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </View>

      <Text style={styles.headline}>{t('home.dashboard.gameOn')}</Text>
      <Text style={styles.subline}>{t('home.dashboard.heroXpHint')}</Text>

      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{t('home.dashboard.pickGame')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textInverse} />
      </View>

      {disabled && lockedHint ? (
        <Text style={styles.lockedHint} numberOfLines={2}>
          {lockedHint}
        </Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    cardDisabled: {
      opacity: 0.72,
    },
    pressed: { opacity: 0.94 },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    streakBlock: { flex: 1 },
    streakLabel: {
      color: colors.textInverse,
      opacity: 0.85,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    streakValue: {
      color: colors.textInverse,
      fontSize: 36,
      fontWeight: '900',
      marginTop: 2,
    },
    friendsBlock: {
      flex: 1,
      alignItems: 'flex-end',
    },
    friendsLabel: {
      color: colors.textInverse,
      opacity: 0.85,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    friendsEmpty: {
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 8,
      opacity: 0.9,
    },
    avatarRow: {
      flexDirection: 'row',
      marginTop: 8,
    },
    friendAvatar: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.heroDark,
      borderWidth: 2,
      borderColor: colors.hero,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendAvatarOverlap: {
      marginLeft: -10,
    },
    friendInitial: {
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '800',
    },
    friendMore: {
      backgroundColor: colors.surface,
    },
    friendMoreText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    headline: {
      color: colors.textInverse,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subline: {
      color: colors.textInverse,
      opacity: 0.9,
      fontSize: 15,
      fontWeight: '600',
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.25)',
    },
    ctaText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    lockedHint: {
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: '600',
      opacity: 0.95,
    },
  });
}
