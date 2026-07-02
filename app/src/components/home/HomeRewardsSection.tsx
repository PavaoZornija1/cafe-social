import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { HomePublicOffer } from './types';

type Props = {
  colors: AppColors;
  lifetimeXp: number | null;
  offers: HomePublicOffer[];
  onSeeAll: () => void;
  onOfferPress: (offer: HomePublicOffer) => void;
  onBrowseVenues?: () => void;
};

const PLACEHOLDER_EMOJI = ['☕', '🥐', '🧁', '🍵'];

export default function HomeRewardsSection({
  colors,
  lifetimeXp,
  offers,
  onSeeAll,
  onOfferPress,
  onBrowseVenues,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const xp = lifetimeXp ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('home.dashboard.rewardsTitle')}</Text>
          <Text style={styles.xpLine}>{t('home.dashboard.rewardsXpLine', { xp })}</Text>
        </View>
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.seeAllText}>{t('home.dashboard.seeAll')}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>

      {offers.length === 0 ? (
        <Pressable
          onPress={onBrowseVenues ?? onSeeAll}
          style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.emptyPreviewRow}>
            <View style={[styles.previewCard, styles.previewCardMuted]}>
              <Text style={styles.previewEmoji}>☕</Text>
            </View>
            <View style={[styles.previewCard, styles.previewCardMuted, styles.previewCardOverlap]}>
              <Text style={styles.previewEmoji}>🥐</Text>
            </View>
          </View>
          <Text style={styles.emptyTitle}>{t('home.dashboard.noRewardsYet')}</Text>
          <Text style={styles.emptyBody}>{t('home.dashboard.noRewardsHint')}</Text>
          <Text style={styles.emptyCta}>{t('home.dashboard.browseVenuesCta')}</Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {offers.map((offer, index) => (
            <Pressable
              key={offer.id}
              onPress={() => onOfferPress(offer)}
              style={({ pressed }) => [styles.rewardCard, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.imageWrap}>
                {offer.imageUrl ? (
                  <Image source={{ uri: offer.imageUrl }} style={styles.rewardImage} />
                ) : (
                  <View style={styles.rewardEmojiWrap}>
                    <Text style={styles.rewardEmoji}>
                      {PLACEHOLDER_EMOJI[index % PLACEHOLDER_EMOJI.length]}
                    </Text>
                  </View>
                )}
                {offer.isFeatured ? (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredText}>{t('home.dashboard.pickOfDay')}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.rewardTitle} numberOfLines={2}>
                {offer.title}
              </Text>
              <Text style={styles.rewardSubtitle} numberOfLines={2}>
                {offer.body?.trim() || t('home.dashboard.rewardAtPartner')}
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.availableRow}>
                  <View style={styles.availableDot} />
                  <Text style={styles.availableText}>{t('home.dashboard.availableNow')}</Text>
                </View>
                <Text style={styles.redeemText}>{t('home.dashboard.redeemCta')}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    section: { gap: spacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      flex: 1,
      flexWrap: 'wrap',
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    xpLine: {
      color: colors.xp,
      fontSize: 14,
      fontWeight: '800',
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    seeAllText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    scrollContent: {
      gap: spacing.md,
      paddingRight: spacing.lg,
    },
    rewardCard: {
      width: 196,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    imageWrap: {
      position: 'relative',
      borderRadius: radii.md,
      overflow: 'hidden',
    },
    rewardImage: {
      width: '100%',
      height: 96,
      backgroundColor: colors.bgElevated,
    },
    rewardEmojiWrap: {
      width: '100%',
      height: 96,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardEmoji: { fontSize: 36 },
    featuredBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: colors.accentPink,
      borderRadius: radii.sm,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    featuredText: {
      color: colors.textInverse,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.4,
    },
    rewardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      minHeight: 40,
    },
    rewardSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
      minHeight: 32,
    },
    cardFooter: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    availableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    availableDot: {
      width: 7,
      height: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.success,
    },
    availableText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    redeemText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    emptyPreviewRow: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    previewCard: {
      width: 72,
      height: 72,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    previewCardMuted: { opacity: 0.85 },
    previewCardOverlap: { marginLeft: -16 },
    previewEmoji: { fontSize: 28 },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    emptyCta: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    pressed: { opacity: 0.9 },
  });
}
