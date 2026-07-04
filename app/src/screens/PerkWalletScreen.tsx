import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import {
  fetchMyGlobalRewardClaims,
  type GlobalRewardClaim,
  type GlobalRewardClaimsPayload,
} from '../lib/venuePerksApi';
import { isReceiptSubmissionsEnabled } from '../lib/receiptSubmissionsFeature';
import { useVenueSession } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PerkWallet'>;

type ClaimStatus = 'REDEEMABLE' | 'EXPIRED' | 'VOIDED' | 'REDEEMED' | 'LOCKED';

function statusLabelKey(status: string): string {
  switch (status) {
    case 'REDEEMABLE':
      return 'perkWallet.statusRedeemable';
    case 'EXPIRED':
      return 'perkWallet.statusExpired';
    case 'VOIDED':
      return 'perkWallet.statusVoided';
    case 'REDEEMED':
      return 'perkWallet.statusRedeemed';
    case 'LOCKED':
      return 'perkWallet.statusLocked';
    default:
      return 'perkWallet.statusOther';
  }
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const PerkRewardQr = React.memo(function PerkRewardQr({
  payload,
  foreground,
  background,
}: {
  payload: string;
  foreground: string;
  background: string;
}) {
  return (
    <QRCode value={payload} size={160} backgroundColor={background} color={foreground} />
  );
});

type CardStyles = ReturnType<typeof createStyles>;

type RewardClaimCardProps = {
  r: GlobalRewardClaim;
  styles: CardStyles;
  colors: AppColors;
  navigation: Props['navigation'];
  showQr: boolean;
};

const RewardClaimCard = React.memo(function RewardClaimCard({
  r,
  styles,
  colors,
  navigation,
  showQr,
}: RewardClaimCardProps) {
  const { t } = useTranslation();
  const receiptsEnabled = isReceiptSubmissionsEnabled();
  const labelKey = statusLabelKey(r.status);
  const statusText =
    labelKey === 'perkWallet.statusOther' ? t(labelKey, { status: r.status }) : t(labelKey);

  const statusStyle = useMemo(() => {
    switch (r.status as ClaimStatus | string) {
      case 'REDEEMABLE':
        return { pill: styles.statusReady, text: styles.statusReadyText };
      case 'EXPIRED':
        return { pill: styles.statusMuted, text: styles.statusMutedText };
      case 'VOIDED':
        return { pill: styles.statusVoided, text: styles.statusVoidedText };
      case 'REDEEMED':
        return { pill: styles.statusDone, text: styles.statusDoneText };
      case 'LOCKED':
        return { pill: styles.statusLocked, text: styles.statusLockedText };
      default:
        return { pill: styles.statusMuted, text: styles.statusMutedText };
    }
  }, [r.status, styles]);

  const dimmed = r.status !== 'REDEEMABLE' && r.status !== 'LOCKED';

  return (
    <View style={[styles.card, dimmed && styles.cardDimmed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.venueName}>{r.venueName}</Text>
        <View style={[styles.statusPill, statusStyle.pill]}>
          <Text style={[styles.statusText, statusStyle.text]}>{statusText}</Text>
        </View>
      </View>

      <Text style={styles.perkTitle}>{r.perkTitle}</Text>
      {r.perkSubtitle ? <Text style={styles.perkSub}>{r.perkSubtitle}</Text> : null}

      <Text style={styles.expiryLine}>
        {t('perk.rewardExpires')} {formatExpiry(r.expiresAt)}
      </Text>

      {r.status === 'LOCKED' ? (
        <Text style={styles.lockedHint}>{t('perkWallet.lockedHint')}</Text>
      ) : null}

      {showQr && r.status === 'REDEEMABLE' ? (
        <View style={styles.qrWrap}>
          <PerkRewardQr
            payload={r.qrPayload}
            foreground={colors.primaryDark}
            background={colors.surface}
          />
        </View>
      ) : null}

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>{t('perk.staffVerificationCode')}</Text>
        <Text style={styles.codeValue}>
          {r.status === 'LOCKED' ? t('perkWallet.codeHidden') : r.staffVerificationCode}
        </Text>
      </View>

      <View style={styles.cardActions}>
        {r.status === 'REDEEMABLE' ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => navigation.navigate('RedeemPerk', { venueId: r.venueId })}
            >
              <Ionicons name="gift-outline" size={16} color={colors.textInverse} />
              <Text style={styles.primaryBtnText}>{t('perkWallet.redeemAtVenue')}</Text>
            </Pressable>
            {receiptsEnabled ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() =>
                navigation.navigate('SubmitReceipt', {
                  venueId: r.venueId,
                  redemptionId: r.redemptionId,
                })
              }
            >
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('perkWallet.submitReceiptToUnlock')}</Text>
            </Pressable>
            ) : null}
          </>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('VenueHub', { venueId: r.venueId, venueName: r.venueName })}
        >
          <Ionicons name="storefront-outline" size={16} color={colors.primary} />
          <Text style={styles.secondaryBtnText}>{t('perkWallet.openVenue')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function PerkWalletScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const session = useVenueSession();
  const showStaffQr = session.canDoVenueActions;

  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<GlobalRewardClaimsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const hasLoadedRef = useRef(false);

  const fetchRewards = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!isLoaded) return;

    if (mode === 'initial' && !hasLoadedRef.current) {
      setInitializing(true);
    } else if (mode === 'refresh') {
      setRefreshing(true);
    }
    setError(null);

    try {
      const token = await getTokenRef.current();
      if (!token) {
        if (!hasLoadedRef.current) setPayload(null);
        return;
      }
      const data = await fetchMyGlobalRewardClaims(token);
      setPayload(data);
    } catch {
      setError(tRef.current('perkWallet.loadError'));
      if (!hasLoadedRef.current) setPayload(null);
    } finally {
      hasLoadedRef.current = true;
      setInitializing(false);
      setRefreshing(false);
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void fetchRewards(hasLoadedRef.current ? 'refresh' : 'initial');
  }, [isLoaded, fetchRewards]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      void fetchRewards('refresh');
    }, [fetchRewards]),
  );

  const handleRefresh = useCallback(() => {
    void fetchRewards(payloadRef.current ? 'refresh' : 'initial');
  }, [fetchRewards]);

  const items: GlobalRewardClaim[] = payload?.items ?? [];
  const activeN = payload?.wallet.activeRedeemable ?? 0;

  const { redeemable, history } = useMemo(() => {
    const r: GlobalRewardClaim[] = [];
    const h: GlobalRewardClaim[] = [];
    for (const it of items) {
      if (it.status === 'REDEEMABLE' || it.status === 'LOCKED') r.push(it);
      else h.push(it);
    }
    return { redeemable: r, history: h };
  }, [items]);

  const showInitialSpinner = initializing && payload === null && !error;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('perkWallet.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('perkWallet.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('perkWallet.subtitle')}</Text>

        {payload != null && activeN > 0 ? (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.activeBadgeText}>{t('perkWallet.activeCount', { n: activeN })}</Text>
          </View>
        ) : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {error && !payload ? (
          <View style={styles.centerBlock}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={handleRefresh}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!showInitialSpinner && !error && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="ticket-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('perkWallet.empty')}</Text>
          </View>
        ) : null}

        {redeemable.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('perkWallet.sectionReady')}</Text>
            {redeemable.map((r) => (
              <RewardClaimCard
                key={r.redemptionId}
                r={r}
                styles={styles}
                colors={colors}
                navigation={navigation}
                showQr={showStaffQr}
              />
            ))}
          </>
        ) : null}

        {history.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, redeemable.length > 0 && styles.sectionTitleSpaced]}>
              {t('perkWallet.sectionHistory')}
            </Text>
            {history.map((r) => (
              <RewardClaimCard
                key={r.redemptionId}
                r={r}
                styles={styles}
                colors={colors}
                navigation={navigation}
                showQr={false}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
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
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      backgroundColor: colors.successMuted,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.lg,
    },
    activeBadgeText: {
      color: colors.success,
      fontSize: 13,
      fontWeight: '700',
    },
    centerBlock: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    retryBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 14,
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xxl,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    sectionTitle: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionTitleSpaced: { marginTop: spacing.xl },
    card: {
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    cardDimmed: { opacity: 0.88 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    venueName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    statusPill: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    statusText: { fontSize: 11, fontWeight: '800' },
    statusReady: { backgroundColor: colors.successMuted },
    statusReadyText: { color: colors.success },
    statusDone: { backgroundColor: colors.primaryMuted },
    statusDoneText: { color: colors.primary },
    statusLocked: { backgroundColor: colors.warningBg },
    statusLockedText: { color: colors.warning },
    lockedHint: {
      color: colors.warning,
      fontSize: 13,
      lineHeight: 18,
      marginTop: spacing.sm,
      fontWeight: '600',
    },
    statusMuted: { backgroundColor: colors.bgElevated },
    statusMutedText: { color: colors.textMuted },
    statusVoided: { backgroundColor: colors.errorMuted },
    statusVoidedText: { color: colors.error },
    perkTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    perkSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    expiryLine: { fontSize: 13, color: colors.textMuted },
    qrWrap: {
      alignItems: 'center',
      marginTop: spacing.sm,
      padding: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    codeBox: {
      marginTop: spacing.xs,
      backgroundColor: colors.bgElevated,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    codeValue: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 1,
    },
    cardActions: {
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    primaryBtnText: { color: colors.textInverse, fontSize: 14, fontWeight: '800' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    secondaryBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.88 },
  });
}
