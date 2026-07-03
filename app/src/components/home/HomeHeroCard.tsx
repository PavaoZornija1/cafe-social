import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import LinearGradientFill from '../ui/LinearGradientFill';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { FriendAtVenueRow } from './types';

type Props = {
  colors: AppColors;
  displayName: string;
  streak: number;
  friendsHere: FriendAtVenueRow[];
  disabled: boolean;
  /** Shown under the play CTA when games are disabled (e.g. partner venue locked). */
  disabledReason?: string | null;
  /** Venue AUTO offer XP multiplier currently active (1 = none). */
  activeXpMultiplier?: number;
  onPlay: () => void;
};

const FRIEND_AVATAR_COLORS = ['#FBBF24', '#F87171', '#34D399', '#60A5FA', '#A78BFA'];

function friendInitial(username: string | null | undefined): string {
  const trimmed = (username ?? '').trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function firstNameFromDisplay(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export default function HomeHeroCard({
  colors,
  displayName,
  streak,
  friendsHere,
  disabled,
  disabledReason,
  activeXpMultiplier = 1,
  onPlay,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibleFriends = friendsHere.slice(0, 3);
  const extraCount = Math.max(0, friendsHere.length - visibleFriends.length);
  const firstName = firstNameFromDisplay(displayName);
  const streakLabel =
    streak === 1
      ? t('home.dashboard.streakDayOne')
      : t('home.dashboard.streakDays', { count: streak });

  return (
    <Pressable
      onPress={onPlay}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        disabled && styles.outerDisabled,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        disabled && disabledReason ? disabledReason : t('home.dashboard.heroA11y')
      }
      accessibilityState={{ disabled }}
    >
      <View style={styles.card}>
        <LinearGradientFill
          from={colors.heroDark}
          to={colors.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        />

        <View style={styles.badgeRow}>
          <View style={styles.livePill}>
            <Ionicons name="sparkles" size={12} color={colors.textInverse} />
            <Text style={styles.livePillText}>{t('home.dashboard.liveGames')}</Text>
          </View>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color={colors.xp} />
            <Text style={styles.streakPillText}>{streakLabel}</Text>
          </View>
        </View>

        <Text style={styles.tapToPlay}>
          {disabled && disabledReason
            ? t('home.dashboard.playLocked')
            : activeXpMultiplier > 1
              ? t('home.dashboard.tapToPlayXpBoosted', { mult: activeXpMultiplier })
              : t('home.dashboard.tapToPlayXp')}
        </Text>
        <Text style={styles.headline}>
          {disabled && disabledReason
            ? disabledReason
            : firstName
              ? t('home.dashboard.gameOnNamed', { name: firstName })
              : t('home.dashboard.gameOn')}
        </Text>

        <View style={styles.friendsRow}>
          {friendsHere.length > 0 ? (
            <>
              <View style={styles.avatarRow}>
                {visibleFriends.map((friend, index) => (
                  <View
                    key={friend.id}
                    style={[
                      styles.friendAvatar,
                      { backgroundColor: FRIEND_AVATAR_COLORS[index % FRIEND_AVATAR_COLORS.length] },
                      index > 0 && styles.friendAvatarOverlap,
                    ]}
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
              <Text style={styles.friendsCaption} numberOfLines={2}>
                {t('home.dashboard.friendsHereNow', { count: friendsHere.length })}
              </Text>
            </>
          ) : (
            <Text style={styles.friendsCaptionMuted}>{t('home.dashboard.noFriendsHere')}</Text>
          )}
        </View>

        <View style={styles.ctaBar}>
          <Text style={styles.ctaText}>{t('home.dashboard.pickGame')}</Text>
          <View style={styles.ctaButton}>
            <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    outer: { gap: spacing.sm },
    outerDisabled: { opacity: 0.88 },
    pressed: { opacity: 0.96 },
    card: {
      backgroundColor: colors.heroDark,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    cardGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      zIndex: 1,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: radii.pill,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    livePillText: {
      color: colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    streakPillText: {
      color: colors.xp,
      fontSize: 11,
      fontWeight: '800',
    },
    tapToPlay: {
      color: colors.textInverse,
      opacity: 0.88,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: spacing.xs,
      zIndex: 1,
    },
    headline: {
      color: colors.textInverse,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: -0.6,
      lineHeight: 34,
      zIndex: 1,
    },
    friendsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
      minHeight: 36,
      zIndex: 1,
    },
    avatarRow: {
      flexDirection: 'row',
    },
    friendAvatar: {
      width: 30,
      height: 30,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.heroDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    friendAvatarOverlap: {
      marginLeft: -8,
    },
    friendInitial: {
      color: colors.textInverse,
      fontSize: 12,
      fontWeight: '900',
    },
    friendMore: {
      backgroundColor: colors.surface,
    },
    friendMoreText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
    },
    friendsCaption: {
      flex: 1,
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '600',
      opacity: 0.95,
    },
    friendsCaptionMuted: {
      color: colors.textInverse,
      fontSize: 13,
      fontWeight: '600',
      opacity: 0.85,
    },
    ctaBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      zIndex: 1,
    },
    ctaText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    ctaButton: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
