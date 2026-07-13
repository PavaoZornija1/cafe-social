import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { VenueStaffRole } from '../../lib/staffContext';
import { isManagerPlusRole, staffRoleLabelKey } from '../../lib/staffContext';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  venueName: string;
  role: VenueStaffRole;
  canClaimGuestRewards: boolean;
  onOpenStaffTools: () => void;
  onOpenScan?: () => void;
};

export default function StaffAtVenueBanner({
  colors,
  venueName,
  role,
  canClaimGuestRewards,
  onOpenStaffTools,
  onOpenScan,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const managerPlus = isManagerPlusRole(role);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={managerPlus ? 'shield-checkmark' : 'id-card-outline'}
            size={20}
            color={colors.textInverse}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>{t('staff.atVenue.kicker')}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {venueName}
          </Text>
          <Text style={styles.role}>{t(staffRoleLabelKey(role))}</Text>
        </View>
      </View>

      <Text style={styles.body}>
        {canClaimGuestRewards
          ? t('staff.atVenue.bodyCanPlay')
          : t(
              managerPlus
                ? 'staff.atVenue.bodyManagerNoGuestRewards'
                : 'staff.atVenue.bodyEmployeeNoGuestRewards',
            )}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={onOpenStaffTools}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="list-outline" size={16} color={colors.textInverse} />
          <Text style={styles.primaryBtnText}>{t('staff.atVenue.openRedemptions')}</Text>
        </Pressable>
        {onOpenScan ? (
          <Pressable
            onPress={onOpenScan}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryBtnText}>{t('staff.atVenue.scanQr')}</Text>
          </Pressable>
        ) : null}
      </View>

      {managerPlus ? (
        <Text style={styles.managerHint}>{t('staff.atVenue.managerPortalHint')}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      padding: spacing.lg,
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerText: { flex: 1, gap: 2 },
    kicker: {
      color: colors.primaryDark,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      lineHeight: 22,
    },
    role: {
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: '700',
    },
    body: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 13,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    secondaryBtnText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 13,
    },
    managerHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    pressed: { opacity: 0.88 },
  });
}
