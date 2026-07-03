import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import {
  addUtcDaysYmd,
  acknowledgeStaffRedemption,
  fetchStaffModerationSummary,
  fetchStaffRedemptions,
  utcTodayYmd,
  type StaffModerationSummary,
  type StaffRedemptionRow,
  type StaffRedemptionsResponse,
} from '../lib/ownerStaffApi';
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffRedemptions'>;

export default function StaffRedemptionsScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { venueId, venueName, highlightCode: routeHighlight } = route.params;
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [dateYmd, setDateYmd] = useState(() => utcTodayYmd());
  const [payload, setPayload] = useState<StaffRedemptionsResponse | null>(null);
  const [filter, setFilter] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modSummary, setModSummary] = useState<StaffModerationSummary | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const highlight = useMemo(() => {
    const h = routeHighlight?.trim().toUpperCase().replace(/\s/g, '');
    return h && /^[0-9A-F]{8}$/.test(h) ? h : null;
  }, [routeHighlight]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!isLoaded) return;

      const hasData = Boolean(payloadRef.current);
      if (mode === 'initial' && !hasData) {
        setInitializing(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error(t('staff.signInFirst'));
        const [data, summary] = await Promise.all([
          fetchStaffRedemptions(token, venueId, dateYmd),
          fetchStaffModerationSummary(token, venueId).catch(() => null),
        ]);
        setPayload(data);
        setModSummary(summary);
      } catch (e) {
        if (!hasData) {
          setPayload(null);
          setModSummary(null);
        }
        Alert.alert(t('common.error'), (e as Error).message ?? t('staff.loadFailed'));
      } finally {
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [isLoaded, venueId, dateYmd, t],
  );

  const prevDateRef = useRef(dateYmd);
  useEffect(() => {
    if (prevDateRef.current !== dateYmd) {
      setPayload(null);
      prevDateRef.current = dateYmd;
    }
    void load('initial');
  }, [dateYmd, venueId, isLoaded, load]);

  useFocusEffect(
    useCallback(() => {
      if (payloadRef.current) {
        void load('refresh');
      }
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    void load(payloadRef.current ? 'refresh' : 'initial');
  }, [load]);

  const filtered: StaffRedemptionRow[] = useMemo(() => {
    const list = payload?.redemptions ?? [];
    const q = filter.trim().toUpperCase().replace(/\s/g, '');
    if (!q) return list;
    return list.filter(
      (r) =>
        r.staffVerificationCode.includes(q) ||
        r.perkCode.toUpperCase().includes(q) ||
        r.perkTitle.toUpperCase().includes(q) ||
        r.playerUsername.toUpperCase().includes(q),
    );
  }, [payload, filter]);

  const highlightMissing = Boolean(
    highlight &&
      payload?.redemptions?.length &&
      !payload.redemptions.some((r) => r.staffVerificationCode === highlight),
  );

  const handleAcknowledge = useCallback(
    async (redemptionId: string) => {
      if (ackingId) return;
      setAckingId(redemptionId);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error(t('staff.signInFirst'));
        await acknowledgeStaffRedemption(token, venueId, redemptionId);
        await load('refresh');
      } catch (e) {
        Alert.alert(t('common.error'), (e as Error).message ?? t('staff.loadFailed'));
      } finally {
        setAckingId(null);
      }
    },
    [ackingId, load, t, venueId],
  );

  const title = venueName ?? payload?.venueName ?? venueId;
  const showInitialSpinner = initializing && !payload;

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('staff.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        {modSummary ? (
          <View style={styles.modPanel}>
            <Text style={styles.modPanelTitle}>{t('staff.moderationSnapshot')}</Text>
            <Text style={styles.modPanelLine}>
              {t('staff.modOpenReports', { n: modSummary.openReportsCount })} ·{' '}
              {t('staff.modActiveBans', { n: modSummary.activeBansCount })} ·{' '}
              {t('staff.modOpenAppeals', { n: modSummary.openAppealsCount })}
            </Text>
            {modSummary.recentOpenReports.length > 0 ? (
              <View style={styles.modReportList}>
                {modSummary.recentOpenReports.map((r) => (
                  <Text key={r.id} style={styles.modReportItem} numberOfLines={2}>
                    @{r.reportedUsername}: {r.reasonPreview}
                  </Text>
                ))}
              </View>
            ) : null}
            <Text style={styles.modPanelHint}>{t('staff.modPartnerToolsHint')}</Text>
          </View>
        ) : null}

        <View style={styles.dateRow}>
          <Pressable
            style={({ pressed }) => [styles.dayBtn, pressed && styles.pressed]}
            onPress={() => setDateYmd((d) => addUtcDaysYmd(d, -1))}
            accessibilityRole="button"
            accessibilityLabel={t('staff.prevDayA11y')}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.dayCenter}>
            <Text style={styles.dayLabel}>{t('staff.dateUtc')}</Text>
            <Text style={styles.dayValue}>{dateYmd}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.dayBtn, pressed && styles.pressed]}
            onPress={() => setDateYmd((d) => addUtcDaysYmd(d, 1))}
            accessibilityRole="button"
            accessibilityLabel={t('staff.nextDayA11y')}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}
            onPress={() => setDateYmd(utcTodayYmd())}
          >
            <Text style={styles.todayBtnText}>{t('staff.today')}</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder={t('staff.filterPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Pressable
            style={({ pressed }) => [styles.scanBtn, pressed && styles.pressed]}
            onPress={() =>
              navigation.navigate('StaffQrScan', { venueId, venueName: title })
            }
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.textInverse} />
            <Text style={styles.scanBtnText}>{t('staff.scanQr')}</Text>
          </Pressable>
        </View>

        {highlightMissing ? (
          <View style={styles.warnBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.warnText}>{t('staff.highlightMissing')}</Text>
          </View>
        ) : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}
      </>
    ),
    [
      colors,
      dateYmd,
      filter,
      handleRefresh,
      highlightMissing,
      modSummary,
      navigation,
      refreshing,
      showInitialSpinner,
      styles,
      t,
      title,
      venueId,
    ],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={showInitialSpinner ? [] : filtered}
        keyExtractor={(item) => item.redemptionId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          showInitialSpinner ? null : (
            <Text style={styles.empty}>{t('staff.emptyDay')}</Text>
          )
        }
        renderItem={({ item }) => {
          const isHit = highlight && item.staffVerificationCode === highlight;
          const voided = !!item.voidedAt;
          const canAck = item.status === 'REDEEMABLE' && !voided;
          const acking = ackingId === item.redemptionId;
          return (
            <View
              style={[
                styles.rowCard,
                isHit && styles.rowCardHighlight,
                voided && styles.rowCardVoided,
              ]}
            >
              <Text style={styles.code}>{item.staffVerificationCode}</Text>
              <Text style={styles.perkTitle}>{item.perkTitle}</Text>
              <Text style={styles.guestName}>@{item.playerUsername}</Text>
              <Text style={styles.perkMeta}>
                {item.perkCode} · {new Date(item.issuedAt).toISOString()} · {item.status}
                {voided ? ' · VOID' : ''}
              </Text>
              {canAck ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.ackBtn,
                    pressed && styles.pressed,
                    acking && styles.ackBtnDisabled,
                  ]}
                  disabled={acking}
                  onPress={() => void handleAcknowledge(item.redemptionId)}
                >
                  {acking ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.ackBtnText}>{t('staff.acknowledge')}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    list: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.md,
      marginBottom: spacing.md,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    dayBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dayCenter: { flex: 1, alignItems: 'center' },
    dayLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    dayValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 2,
    },
    todayBtn: {
      paddingHorizontal: spacing.md,
      height: 44,
      justifyContent: 'center',
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    todayBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 14,
    },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    scanBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 12,
    },
    rowCard: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    rowCardHighlight: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    rowCardVoided: {
      opacity: 0.55,
    },
    code: {
      color: colors.primary,
      fontWeight: '900',
      fontSize: 20,
      letterSpacing: 1,
    },
    perkTitle: {
      color: colors.text,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    guestName: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
    perkMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    ackBtn: {
      marginTop: spacing.md,
      alignSelf: 'flex-start',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      minWidth: 120,
      alignItems: 'center',
    },
    ackBtnDisabled: { opacity: 0.6 },
    ackBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 13,
    },
    centerBlock: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    empty: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    warnBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.warningBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning,
    },
    warnText: {
      flex: 1,
      color: colors.warning,
      fontSize: 13,
      lineHeight: 18,
    },
    modPanel: {
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modPanelTitle: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 13,
    },
    modPanelLine: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    modReportList: {
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    modReportItem: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    modPanelHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: spacing.sm,
      lineHeight: 15,
    },
    pressed: { opacity: 0.88 },
  });
}
