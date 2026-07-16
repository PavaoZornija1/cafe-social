import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import ScreenHeader from '../components/ScreenHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { StaffAccessGate } from '../components/staff/StaffAccessGate';
import type { OwnerVenueRow } from '../lib/ownerStaffApi';
import { getPartnerPortalUrl } from '../lib/partnerPortalUrl';
import { isManagerPlusRole } from '../lib/staffContext';
import type { RootStackParamList } from '../navigation/type';
import { useStaffVenuesQuery } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffVenues'>;

function formatLocation(venue: OwnerVenueRow['venue']): string | null {
  const parts = [venue.address, venue.city, venue.country].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function roleLabel(role: OwnerVenueRow['role'], t: TFunction): string {
  switch (role) {
    case 'OWNER':
      return t('staff.roleOwner');
    case 'MANAGER':
      return t('staff.roleManager');
    case 'EMPLOYEE':
      return t('staff.roleEmployee');
    default:
      return role;
  }
}

function roleChipStyle(role: OwnerVenueRow['role'], colors: AppColors) {
  switch (role) {
    case 'OWNER':
      return {
        bg: colors.honeyMuted,
        text: colors.honeyDark,
        icon: 'star' as const,
      };
    case 'MANAGER':
      return {
        bg: colors.primaryMuted,
        text: colors.primaryDark,
        icon: 'shield-checkmark' as const,
      };
    case 'EMPLOYEE':
      return {
        bg: colors.surface,
        text: colors.textSecondary,
        icon: 'person' as const,
      };
    default:
      return {
        bg: colors.surface,
        text: colors.textSecondary,
        icon: 'person' as const,
      };
  }
}

export default function StaffVenuesScreen({ navigation }: Props) {
  return (
    <StaffAccessGate>
      <StaffVenuesBody navigation={navigation} />
    </StaffAccessGate>
  );
}

function StaffVenuesBody({
  navigation,
}: {
  navigation: Props['navigation'];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded } = useAuth();
  const staffQuery = useStaffVenuesQuery();
  const rows = staffQuery.data ?? [];
  const loading = staffQuery.isLoading;
  const loadError = !isLoaded
    ? null
    : staffQuery.isError
      ? (staffQuery.error as Error)?.message ?? t('staff.loadFailed')
      : !staffQuery.isLoading && !staffQuery.isFetching && !staffQuery.data
        ? t('staff.signInFirst')
        : null;

  const hasManagerPlus = rows.some((row) => isManagerPlusRole(row.role));
  const portalUrl = getPartnerPortalUrl('/owner');

  const load = useCallback(async () => {
    await staffQuery.refetch();
  }, [staffQuery]);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('staff.venuesTitle')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="storefront-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('staff.heroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('staff.heroTitle')}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="gift-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>{t('staff.infoRedemptions')}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.infoText}>{t('staff.infoScan')}</Text>
          </View>
        </View>

        {hasManagerPlus && portalUrl ? (
          <Pressable
            style={({ pressed }) => [styles.portalBtn, pressed && styles.pressed]}
            onPress={() => void Linking.openURL(portalUrl)}
            accessibilityRole="link"
          >
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <Text style={styles.portalBtnText}>{t('staff.openPartnerPortal')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('staff.yourVenues')}</Text>
          {!loading && rows.length > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{rows.length}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.listLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('staff.loadFailed')}</Text>
            <Text style={styles.emptyBody}>{loadError}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={() => void load()}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="business-outline" size={32} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('staff.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('staff.noVenues')}</Text>
          </View>
        ) : (
          rows.map((item) => {
            const location = formatLocation(item.venue);
            const chip = roleChipStyle(item.role, colors);
            return (
              <Pressable
                key={item.venue.id}
                style={({ pressed }) => [styles.venueCard, pressed && styles.pressed]}
                onPress={() =>
                  navigation.navigate('StaffRedemptions', {
                    venueId: item.venue.id,
                    venueName: item.venue.name,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={t('staff.openVenue', { name: item.venue.name })}
              >
                <View style={styles.venueIconWrap}>
                  <Ionicons name="storefront" size={20} color={colors.textInverse} />
                </View>
                <View style={styles.venueCopy}>
                  <Text style={styles.venueTitle} numberOfLines={1}>
                    {item.venue.name}
                  </Text>
                  {location ? (
                    <Text style={styles.venueMeta} numberOfLines={2}>
                      {location}
                    </Text>
                  ) : null}
                  <View style={[styles.roleChip, { backgroundColor: chip.bg }]}>
                    <Ionicons name={chip.icon} size={10} color={chip.text} />
                    <Text style={[styles.roleChipText, { color: chip.text }]}>
                      {roleLabel(item.role, t)}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.lg,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    infoCard: {
      gap: spacing.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    portalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.primaryMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
    },
    portalBtnText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    infoIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    infoText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    countPill: {
      minWidth: 26,
      height: 26,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countPillText: {
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '900',
    },
    listLoading: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
    },
    retryBtnText: {
      color: colors.primaryDark,
      fontWeight: '800',
      fontSize: 14,
    },
    venueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    venueIconWrap: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    venueCopy: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    venueTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    venueMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    roleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      marginTop: 4,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
    },
    roleChipText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    pressed: { opacity: 0.88 },
  });
}
