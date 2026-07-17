import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  isOfferCtaActionable,
  resolveOfferCta,
  type OfferCta,
} from '../../lib/staffRewardPolicy';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { HomePublicOffer } from './types';

type Props = {
  colors: AppColors;
  lifetimeXp: number | null;
  offers: HomePublicOffer[];
  claimingOfferId?: string | null;
  /** When false, guest claim CTAs are muted (staff at own venue). */
  guestClaimsEnabled?: boolean;
  /**
   * False while staff state for this venue is still resolving; claim CTAs
   * stay non-actionable without showing staff copy to guests.
   */
  claimsResolved?: boolean;
  onSeeAll: () => void;
  onOfferPress: (offer: HomePublicOffer) => void;
  onBrowseVenues?: () => void;
};

const PLACEHOLDER_EMOJI = ['☕', '🥐', '🧁', '🍵'];

function offerCtaLabel(
  cta: OfferCta,
  t: (k: string, o?: Record<string, unknown>) => string,
  offer: HomePublicOffer,
): string {
  switch (cta.kind) {
    case 'autoInfo':
      return cta.boosted
        ? t('home.dashboard.offerAutoXp', { mult: offer.autoXpMultiplier })
        : t('home.dashboard.offerAutoActive');
    case 'fulfilled':
      return t('home.dashboard.offerFulfilled');
    case 'showMemberCard':
      return t('home.dashboard.offerShowMemberCard');
    case 'exhausted':
      return t('home.dashboard.offerExhausted');
    case 'staffUnavailable':
      return t('home.dashboard.offerStaffUnavailable');
    case 'claim':
      return t('home.dashboard.offerClaimCta');
    default: {
      const _exhaustive: never = cta;
      return _exhaustive;
    }
  }
}

export default function HomeRewardsSection({
  colors,
  lifetimeXp,
  offers,
  claimingOfferId,
  guestClaimsEnabled = true,
  claimsResolved = true,
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
          <Text style={styles.title}>{t('home.dashboard.offersTitle')}</Text>
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
          <Text style={styles.emptyTitle}>{t('home.dashboard.noOffersYet')}</Text>
          <Text style={styles.emptyBody}>{t('home.dashboard.noOffersHint')}</Text>
          <Text style={styles.emptyCta}>{t('home.dashboard.browseVenuesCta')}</Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {offers.map((offer, index) => {
            const isAuto = offer.fulfillment === 'AUTO';
            const busy = claimingOfferId === offer.id;
            // While staff state is unresolved, show plain guest labels
            // (no staff copy, no AUTO boost) but keep claims disabled.
            const ctaClaims = claimsResolved ? guestClaimsEnabled : !isAuto;
            const cta = resolveOfferCta(offer, ctaClaims);
            const claimBlocked =
              cta.kind === 'staffUnavailable' ||
              (!claimsResolved && !isAuto && cta.kind !== 'fulfilled');
            const disabled =
              busy ||
              !isOfferCtaActionable(cta) ||
              claimBlocked ||
              (isAuto && !offer.body);

            return (
              <Pressable
                key={offer.id}
                onPress={() => onOfferPress(offer)}
                disabled={disabled && !isAuto}
                style={({ pressed }) => [
                  styles.rewardCard,
                  pressed && !disabled && styles.pressed,
                  (cta.kind === 'fulfilled' ||
                    cta.kind === 'exhausted' ||
                    claimBlocked) &&
                    styles.rewardCardMuted,
                ]}
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
                    <View
                      style={[
                        styles.availableDot,
                        isAuto ? styles.dotAuto : styles.dotMember,
                      ]}
                    />
                    <Text style={styles.availableText}>
                      {isAuto
                        ? t('home.dashboard.offerKindAuto')
                        : cta.kind === 'staffUnavailable'
                          ? t('home.dashboard.offerKindMemberCardStaff')
                          : t('home.dashboard.offerKindMemberCard')}
                    </Text>
                  </View>
                  {busy ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.redeemText,
                        (cta.kind === 'fulfilled' ||
                          cta.kind === 'exhausted' ||
                          claimBlocked) &&
                          styles.redeemTextMuted,
                      ]}
                    >
                      {offerCtaLabel(cta, t, offer)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
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
    rewardCardMuted: { opacity: 0.72 },
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
    },
    dotAuto: { backgroundColor: colors.xp },
    dotMember: { backgroundColor: colors.success },
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
    redeemTextMuted: { color: colors.textMuted },
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
