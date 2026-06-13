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
  onVenuePress: () => void;
  onFindVenues: () => void;
};

export default function HomeVenueStrip({
  colors,
  loading,
  error,
  venue,
  access,
  menuUrl,
  onVenuePress,
  onFindVenues,
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
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={styles.meta}>{t('home.detectingVenue')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, styles.cardError]}>
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
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="location-outline" size={20} color={colors.primary} />
        <View style={styles.main}>
          <Text style={styles.title}>{t('home.noVenueShort')}</Text>
          <Text style={styles.meta}>{t('home.dashboard.findVenuesHint')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onVenuePress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('home.venueHubA11y', { name: venue.name })}
    >
      <Ionicons name="location" size={20} color={colors.primary} />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {venue.name}
          </Text>
          {access?.canEnterVenueContext ? (
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {checkedIn
            ? t('home.dashboard.checkedInXp')
            : access?.canEnterVenueContext
              ? t('home.dashboard.venueUnlocked')
              : t('home.dashboard.tapToUnlock')}
        </Text>
      </View>
      {menuUrl ? (
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
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
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
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    menuBtn: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    menuBtnText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    pressed: { opacity: 0.9 },
  });
}
