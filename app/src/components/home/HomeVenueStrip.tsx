import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';
import type { HomeVenue, HomeVenueAccess } from './types';

type Props = {
  colors: AppColors;
  loading: boolean;
  error: string | null;
  venue: HomeVenue | null;
  access: HomeVenueAccess | null;
  menuUrl: string | null;
  needsCheckIn?: boolean;
  onVenuePress: () => void;
  onFindVenues: () => void;
  onCheckIn?: () => void;
};

function PinIcon({ colors, styles }: { colors: AppColors; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.pinWrap}>
      <View style={styles.pinCircle}>
        <Ionicons name="location" size={20} color={colors.textInverse} />
      </View>
    </View>
  );
}

export default function HomeVenueStrip({
  colors,
  loading,
  error,
  venue,
  access,
  menuUrl,
  needsCheckIn = false,
  onVenuePress,
  onFindVenues,
  onCheckIn,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const checkedIn = Boolean(
    venue && access?.canEnterVenueContext && access.isPhysicallyAtVenue !== false,
  );

  const openMenu = () => {
    if (menuUrl) void Linking.openURL(menuUrl);
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <PinIcon colors={colors} styles={styles} />
        <View style={styles.main}>
          <Text style={styles.metaMuted}>{t('home.detectingVenue')}</Text>
        </View>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, styles.cardError]}>
        <PinIcon colors={colors} styles={styles} />
        <Text style={styles.errorText} numberOfLines={2}>
          {error}
        </Text>
      </View>
    );
  }

  if (!venue) {
    return (
      <Pressable
        onPress={onFindVenues}
        style={({ pressed }) => [styles.card, styles.cardEmpty, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <PinIcon colors={colors} styles={styles} />
        <View style={styles.main}>
          <Text style={styles.title}>{t('home.noVenueShort')}</Text>
          <Text style={styles.metaAction}>{t('home.dashboard.findVenuesHint')}</Text>
        </View>
        <View style={styles.chevronCircle}>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onVenuePress}
      style={({ pressed }) => [styles.card, styles.cardActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('home.venueHubA11y', { name: venue.name })}
    >
      <PinIcon colors={colors} styles={styles} />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {venue.name}
          </Text>
          {access?.canEnterVenueContext && !needsCheckIn ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          ) : null}
        </View>
        <Text
          style={[styles.meta, checkedIn && !needsCheckIn && styles.metaHighlight]}
          numberOfLines={2}
        >
          {needsCheckIn
            ? t('home.explicitCheckInChallengeLine')
            : checkedIn
              ? t('home.dashboard.checkedInXp')
              : access?.canEnterVenueContext
                ? t('home.dashboard.venueUnlocked')
                : t('home.dashboard.tapToUnlock')}
        </Text>
      </View>
      {needsCheckIn && onCheckIn ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onCheckIn();
          }}
          style={({ pressed }) => [styles.checkInBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('home.explicitCheckInCta')}
        >
          <Ionicons name="qr-code-outline" size={16} color={colors.textInverse} />
        </Pressable>
      ) : menuUrl ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            openMenu();
          }}
          style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('home.dashboard.menu')}
        >
          <Text style={styles.menuBtnText}>{t('home.dashboard.menu')}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    cardEmpty: {
      backgroundColor: colors.surface,
      borderColor: colors.primaryMuted,
    },
    cardActive: {
      backgroundColor: colors.surfaceMuted,
      borderColor: 'rgba(37, 97, 233, 0.2)',
    },
    pinWrap: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinCircle: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardError: {
      backgroundColor: colors.errorMuted,
      borderColor: colors.error,
    },
    main: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      flexShrink: 1,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 3,
    },
    metaHighlight: {
      color: colors.primary,
      fontWeight: '700',
    },
    metaAction: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 3,
    },
    metaMuted: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    chevronCircle: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuBtn: {
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(37, 97, 233, 0.25)',
    },
    menuBtnText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    checkInBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.92 },
  });
}
