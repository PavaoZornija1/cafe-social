import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { venueInitial } from '../../lib/geo';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

export type VenueFriendAvatar = {
  id: string;
  username: string;
};

type Props = {
  colors: AppColors;
  name: string;
  area: string | null;
  distanceLabel: string | null;
  walkMin: number | null;
  isHere: boolean;
  offerLabel: string | null;
  friendsHere: VenueFriendAvatar[];
  selected?: boolean;
  onPress: () => void;
};

const AVATAR_COLORS = ['#2E6DED', '#E68A00', '#EC4899', '#16A34A', '#8B5CF6'];

function friendInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export default function VenueNearbyCard({
  colors,
  name,
  area,
  distanceLabel,
  walkMin,
  isHere,
  offerLabel,
  friendsHere,
  selected,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = venueInitial(name);
  const avatarColor = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
  const visibleFriends = friendsHere.slice(0, 3);
  const extraFriends = Math.max(0, friendsHere.length - visibleFriends.length);

  const metaParts = [
    distanceLabel,
    walkMin != null ? t('partnerMap.walkMin', { n: walkMin }) : null,
    !isHere ? t('partnerMap.open') : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isHere && styles.cardHere,
        selected && styles.cardSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View style={[styles.logo, { backgroundColor: avatarColor }]}>
        <Text style={styles.logoText}>{initial}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {isHere ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          ) : null}
          {isHere ? (
            <View style={styles.hereBadge}>
              <Text style={styles.hereBadgeText}>{t('partnerMap.youreHere')}</Text>
            </View>
          ) : offerLabel ? (
            <View style={styles.offerBadge}>
              <Ionicons name="gift" size={12} color={colors.xp} />
              <Text style={styles.offerBadgeText} numberOfLines={1}>
                {offerLabel.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {area ? (
          <Text style={styles.area} numberOfLines={1}>
            {area}
          </Text>
        ) : null}

        {metaParts.length > 0 ? (
          <View style={styles.metaRow}>
            {metaParts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                {index > 0 ? <Text style={styles.metaDot}>·</Text> : null}
                <Text style={styles.metaText}>{part}</Text>
                {index === metaParts.length - 1 && !isHere ? (
                  <View style={styles.openDot} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {friendsHere.length > 0 ? (
          <View style={styles.friendsRow}>
            <View style={styles.friendAvatars}>
              {visibleFriends.map((friend, index) => (
                <View
                  key={friend.id}
                  style={[
                    styles.friendAvatar,
                    { backgroundColor: AVATAR_COLORS[(index + 1) % AVATAR_COLORS.length] },
                    index > 0 && styles.friendOverlap,
                  ]}
                >
                  <Text style={styles.friendInitial}>{friendInitial(friend.username)}</Text>
                </View>
              ))}
              {extraFriends > 0 ? (
                <View style={[styles.friendAvatar, styles.friendOverlap, styles.friendMore]}>
                  <Text style={styles.friendMoreText}>+{extraFriends}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.friendsLabel}>
              {t('partnerMap.friendsHereCount', { count: friendsHere.length })}
            </Text>
          </View>
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
    cardHere: {
      borderColor: colors.primary,
      borderWidth: 2,
      backgroundColor: colors.primaryMuted,
    },
    cardSelected: {
      borderColor: colors.primaryDark,
    },
    pressed: { opacity: 0.92 },
    logo: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: colors.textInverse,
      fontSize: 22,
      fontWeight: '900',
    },
    body: { flex: 1, minWidth: 0, gap: 4 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    name: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      flexShrink: 1,
    },
    hereBadge: {
      backgroundColor: colors.accentPink,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    hereBadgeText: {
      color: colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    offerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.honeyMuted,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: 8,
      maxWidth: '100%',
    },
    offerBadgeText: {
      color: colors.xp,
      fontSize: 10,
      fontWeight: '800',
      flexShrink: 1,
    },
    area: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    metaText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    metaDot: {
      color: colors.textMuted,
      fontSize: 13,
    },
    openDot: {
      width: 7,
      height: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.success,
      marginLeft: 2,
    },
    friendsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    friendAvatars: {
      flexDirection: 'row',
    },
    friendAvatar: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    friendOverlap: {
      marginLeft: -8,
    },
    friendInitial: {
      color: colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
    },
    friendMore: {
      backgroundColor: colors.bgElevated,
    },
    friendMoreText: {
      color: colors.textSecondary,
      fontSize: 9,
      fontWeight: '800',
    },
    friendsLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
