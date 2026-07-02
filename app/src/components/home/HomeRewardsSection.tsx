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
};

const PLACEHOLDER_EMOJI = ['☕', '🥐', '🧁', '🍵'];

export default function HomeRewardsSection({
  colors,
  lifetimeXp,
  offers,
  onSeeAll,
  onOfferPress,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('home.dashboard.rewardsTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('home.dashboard.rewardsSubtitle', { xp: lifetimeXp ?? 0 })}
          </Text>
        </View>
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.seeAllText}>{t('home.dashboard.seeAll')}</Text>
        </Pressable>
      </View>

      {offers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('home.dashboard.noRewardsYet')}</Text>
          <Text style={styles.emptyBody}>{t('home.dashboard.noRewardsHint')}</Text>
        </View>
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
              {offer.imageUrl ? (
                <Image source={{ uri: offer.imageUrl }} style={styles.rewardImage} />
              ) : (
                <View style={styles.rewardEmojiWrap}>
                  <Text style={styles.rewardEmoji}>
                    {PLACEHOLDER_EMOJI[index % PLACEHOLDER_EMOJI.length]}
                  </Text>
                </View>
              )}
              <Text style={styles.rewardTitle} numberOfLines={2}>
                {offer.title}
              </Text>
              {offer.isFeatured ? (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredText}>{t('home.dashboard.featured')}</Text>
                </View>
              ) : null}
              <Text style={styles.redeemHint}>{t('home.dashboard.viewOffer')}</Text>
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    seeAll: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    seeAllText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    scrollContent: {
      gap: spacing.md,
      paddingRight: spacing.lg,
    },
    rewardCard: {
      width: 148,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    rewardImage: {
      width: '100%',
      height: 72,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
    },
    rewardEmojiWrap: {
      width: '100%',
      height: 72,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rewardEmoji: { fontSize: 32 },
    rewardTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      minHeight: 36,
    },
    featuredBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.honeyMuted,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    featuredText: {
      color: colors.accentPink,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    redeemHint: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    pressed: { opacity: 0.9 },
  });
}
