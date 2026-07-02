import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDistanceKm, venueInitial } from '../../lib/geo';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { VenueFriendAvatar } from './VenueNearbyCard';

const AVATAR_COLORS = ['#2561E9', '#E68A00', '#EC4899', '#16A34A', '#8B5CF6'];

type PreviewVenue = {
  id: string;
  name: string;
  area: string | null;
  distanceKm: number | null;
  walkMin: number | null;
  isHere: boolean;
  offerLabel: string | null;
  friendsHere: VenueFriendAvatar[];
};

type Props = {
  colors: AppColors;
  venue: PreviewVenue;
  previewA11y: string;
  walkMinLabel: string | null;
  onOpen: () => void;
};

function friendInitial(username: string | null | undefined): string {
  const trimmed = (username ?? '').trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function PartnerVenueMapPreview({
  colors,
  venue,
  previewA11y,
  walkMinLabel,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = venueInitial(venue.name);
  const logoColor = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
  const visibleFriends = venue.friendsHere.slice(0, 3);
  const extraFriends = Math.max(0, venue.friendsHere.length - visibleFriends.length);

  const metaParts = [
    venue.area,
    venue.distanceKm != null ? formatDistanceKm(venue.distanceKm) : null,
    walkMinLabel,
    !venue.isHere ? t('partnerMap.open') : null,
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.preview, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={previewA11y}
      >
        <View style={[styles.logo, { backgroundColor: logoColor }]}>
          <Text style={styles.logoText}>{initial}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {venue.name}
            </Text>
            {venue.isHere ? (
              <View style={styles.hereBadge}>
                <Text style={styles.hereBadgeText}>{t('partnerMap.youreHere')}</Text>
              </View>
            ) : venue.offerLabel ? (
              <View style={styles.offerBadge}>
                <Ionicons name="gift" size={11} color={colors.xp} />
                <Text style={styles.offerBadgeText} numberOfLines={1}>
                  {venue.offerLabel.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          {metaParts.length > 0 ? (
            <View style={styles.metaRow}>
              {metaParts.map((part, index) => (
                <React.Fragment key={`${part}-${index}`}>
                  {index > 0 ? <Text style={styles.metaDot}>·</Text> : null}
                  <Text style={styles.metaText} numberOfLines={1}>
                    {part}
                  </Text>
                  {index === metaParts.length - 1 && !venue.isHere ? (
                    <View style={styles.openDot} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          ) : null}

          {venue.friendsHere.length > 0 ? (
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
                {t('partnerMap.friendsHereCount', { count: venue.friendsHere.length })}
              </Text>
            </View>
          ) : null}

          <View style={styles.ctaRow}>
            <Text style={styles.ctaText}>{t('partnerMap.openVenueCta')}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default memo(PartnerVenueMapPreview);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      bottom: 2 * spacing.md,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    logoText: {
      color: colors.textInverse,
      fontSize: 24,
      fontWeight: '900',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    title: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: -0.2,
    },
    hereBadge: {
      backgroundColor: colors.accentPink,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    hereBadgeText: {
      color: colors.textInverse,
      fontSize: 9,
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
      fontSize: 9,
      fontWeight: '800',
      flexShrink: 1,
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
      flexShrink: 1,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    ctaText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: { opacity: 0.88 },
  });
}
