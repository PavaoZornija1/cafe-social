import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { getVenuePlayBudgetIapCatalog } from '../lib/venuePlayBudgetCatalog';
import { promptVenuePlayTimePurchaseDialog } from '../lib/venuePlayBudgetPurchaseUi';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

export type VenuePlayBudgetMeDto = {
  unlimited: boolean;
  venueId: string;
  dayKey: string;
  remainingActiveSeconds: number;
  consumedActiveSeconds: number;
  freeAllowanceSeconds: number;
  iapBonusSecondsRemaining: number;
  inGeofence: boolean | null;
};

type Props = {
  venueId: string;
  getToken: () => Promise<string | null>;
  subscriptionActive: boolean;
  /** `compact` — muted footnote for lobby/choose screens; default bar is fuller. */
  variant?: 'bar' | 'compact';
};

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    label: { color: colors.textSecondary, fontSize: 12, flex: 1 },
    value: { color: colors.text, fontSize: 13, fontWeight: '600' },
    barTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 8,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
    extendBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primaryMuted,
    },
    extendLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
    compactWrap: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    compactLabel: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    compactExtendBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radii.sm,
      backgroundColor: colors.primaryMuted,
    },
    compactExtendLabel: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
    compactTrack: {
      height: 3,
      borderRadius: radii.pill,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
  });
}

export default function VenuePlayTimeBar({
  venueId,
  getToken,
  subscriptionActive,
  variant = 'bar',
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<VenuePlayBudgetMeDto | null>(null);
  const [loading, setLoading] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const refresh = useCallback(async () => {
    if (subscriptionActive || !venueId?.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setData(null);
        return;
      }
      const { coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
      const qs = new URLSearchParams({ venueId: venueId.trim() });
      if (coords) {
        qs.set('lat', String(coords.lat));
        qs.set('lng', String(coords.lng));
      }
      const row = await apiGet<VenuePlayBudgetMeDto>(`/venue-play-budget/me?${qs.toString()}`, token);
      setData(row);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [venueId, subscriptionActive]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const id = setInterval(() => void refresh(), 45_000);
      return () => clearInterval(id);
    }, [refresh]),
  );

  if (subscriptionActive || !venueId?.trim()) return null;

  if (loading && !data) {
    if (variant === 'compact') return null;
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data || data.unlimited) return null;

  const cap = Math.max(1, data.remainingActiveSeconds + data.consumedActiveSeconds);
  const pct = Math.min(1, data.remainingActiveSeconds / cap);
  const remMin = Math.max(0, Math.ceil(data.remainingActiveSeconds / 60));
  const showExtend = getVenuePlayBudgetIapCatalog().length > 0;
  const label =
    data.inGeofence === false
      ? t('venuePlayBar.outsideGeofence')
      : variant === 'compact'
        ? t('venuePlayBar.compactRemaining', { minutes: remMin })
        : t('venuePlayBar.timeRemaining', { minutes: remMin });

  if (variant === 'compact') {
    return (
      <View style={styles.compactWrap} accessibilityRole="summary">
        <View style={styles.compactRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.compactLabel} numberOfLines={2}>
            {label}
          </Text>
          {showExtend ? (
            <Pressable
              style={({ pressed }) => [styles.compactExtendBtn, pressed && { opacity: 0.85 }]}
              onPress={() => void promptVenuePlayTimePurchaseDialog({ t, getToken })}
              accessibilityRole="button"
              accessibilityLabel={t('venuePlayBar.extend')}
            >
              <Text style={styles.compactExtendLabel}>{t('venuePlayBar.extend')}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.compactTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {showExtend ? (
          <Pressable
            style={({ pressed }) => [styles.extendBtn, pressed && { opacity: 0.85 }]}
            onPress={() => void promptVenuePlayTimePurchaseDialog({ t, getToken })}
            accessibilityRole="button"
            accessibilityLabel={t('venuePlayBar.extend')}
          >
            <Text style={styles.extendLabel}>{t('venuePlayBar.extend')}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}
