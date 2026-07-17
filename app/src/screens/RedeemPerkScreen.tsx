import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import { isReceiptSubmissionsEnabled } from '../lib/receiptSubmissionsFeature';
import { canUseGuestRewardActionsAtVenue } from '../lib/staffRewardPolicy';
import {
  fetchMyVenueRewards,
  fetchVenuePerkTeasers,
  type VenuePerkPublicTeaser,
  type VenueRedeemableReward,
} from '../lib/venuePerksApi';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useDetectedVenueQuery, useStaffContext, useVenueSession } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';
import StaffAtVenueBanner from '../components/staff/StaffAtVenueBanner';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemPerk'>;

type RedeemOk = {
  staffVerificationCode: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  redeemedAt: string;
};

type RewardStatus = 'REDEEMABLE' | 'EXPIRED' | 'VOIDED' | 'REDEEMED' | 'LOCKED';

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

export default function RedeemPerkScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const detectQuery = useDetectedVenueQuery({ refetchOnScreenFocus: false });
  const routeVenueId = route.params?.venueId ?? null;
  const session = useVenueSession({ routeVenueId });
  const staff = useStaffContext({ venueId: routeVenueId });
  const detectRef = useRef(detectQuery);
  detectRef.current = detectQuery;

  const [resolvedVenueId, setResolvedVenueId] = useState<string | null>(routeVenueId);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastOk, setLastOk] = useState<RedeemOk | null>(null);
  const [teasers, setTeasers] = useState<VenuePerkPublicTeaser[]>([]);
  const [myRewards, setMyRewards] = useState<VenueRedeemableReward[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const teasersRef = useRef(teasers);
  teasersRef.current = teasers;
  const myRewardsRef = useRef(myRewards);
  myRewardsRef.current = myRewards;
  const hasLoadedRef = useRef(false);

  const loadPerks = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial' && !hasLoadedRef.current) {
        setInitializing(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        if (!isLoaded) return;

        const token = await getTokenRef.current();
        if (!token) {
          setTeasers([]);
          setMyRewards([]);
          setResolvedVenueId(null);
          return;
        }

        let activeVenueId = routeVenueId ?? detectRef.current.data?.venue?.id ?? null;
        if (!activeVenueId) {
          const result = await detectRef.current.refetch();
          activeVenueId = result.data?.venue?.id ?? null;
        }
        setResolvedVenueId(activeVenueId);

        if (!activeVenueId) {
          setTeasers([]);
          setMyRewards([]);
          return;
        }

        const [list, mine] = await Promise.all([
          fetchVenuePerkTeasers(activeVenueId, token),
          fetchMyVenueRewards(activeVenueId, token),
        ]);
        setTeasers(list);
        setMyRewards(mine);
      } catch {
        if (teasersRef.current.length === 0 && myRewardsRef.current.length === 0) {
          setTeasers([]);
          setMyRewards([]);
        }
      } finally {
        hasLoadedRef.current = true;
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [isLoaded, routeVenueId],
  );

  const loadPerksRef = useRef(loadPerks);
  loadPerksRef.current = loadPerks;

  useEffect(() => {
    if (!isLoaded) return;
    void loadPerks(hasLoadedRef.current ? 'refresh' : 'initial');
  }, [isLoaded, routeVenueId, loadPerks]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) return;
      void loadPerksRef.current('refresh');
    }, []),
  );

  const handleRefresh = useCallback(() => {
    void loadPerks(
      teasersRef.current.length > 0 || myRewardsRef.current.length > 0 ? 'refresh' : 'initial',
    );
  }, [loadPerks]);

  const redeem = async () => {
    if (!staff.canClaimGuestRewards) {
      Alert.alert(t('common.error'), t('perk.staffGuestRewardsBlocked'));
      return;
    }
    if (!session.canDoVenueActions) {
      Alert.alert(t('common.error'), t('home.playLockedHint'));
      return;
    }
    const raw = code.trim().toUpperCase();
    if (!raw) {
      Alert.alert(t('common.error'), t('perk.codeRequired'));
      return;
    }
    if (!isLoaded) return;
    const token = await getTokenRef.current();
    if (!token) {
      Alert.alert(t('common.error'), t('perk.signInFirst'));
      return;
    }
    const paramVenueId = route.params?.venueId?.trim() ?? '';
    const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
    if (!venue?.id) {
      Alert.alert(t('common.error'), t('perk.needVenue'));
      return;
    }
    if (paramVenueId && paramVenueId !== venue.id) {
      Alert.alert(t('common.error'), t('perk.wrongVenue'));
      return;
    }
    const venueId = venue.id;
    if (
      coords == null ||
      typeof coords.lat !== 'number' ||
      typeof coords.lng !== 'number'
    ) {
      Alert.alert(t('common.error'), t('perk.needLocationPrecise'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<RedeemOk>(
        `/venue-context/${encodeURIComponent(venueId)}/perks/redeem`,
        { code: raw, latitude: coords.lat, longitude: coords.lng },
        token,
      );
      setLastOk(res);
      setCode('');
      triggerFeedback('perkRedeemed');
      try {
        const [list, mine] = await Promise.all([
          fetchVenuePerkTeasers(venueId, token),
          fetchMyVenueRewards(venueId, token),
        ]);
        setTeasers(list);
        setMyRewards(mine);
      } catch {
        /* non-blocking */
      }
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('perk.redeemFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Per-venue gate: rewards on this screen all belong to resolvedVenueId,
  // so staff at that exact venue lose guest actions (QR / code / receipt),
  // while the same account keeps the full guest flow at other venues.
  // Pre-detection fail-safe: known staff members don't get guest claim UI
  // while the venue is still being detected — it may turn out to be theirs.
  // Guests without staff memberships are unaffected.
  const staffPreDetection =
    staff.hasStaffVenues && !resolvedVenueId && session.isLoading;

  const guestActionsAllowed =
    canUseGuestRewardActionsAtVenue({
      staffVenueIds: staff.staffVenueIds,
      membershipsResolved: staff.membershipsResolved,
      rewardVenueId: resolvedVenueId,
    }) &&
    staff.canClaimGuestRewards &&
    !staffPreDetection;

  const showInitialSpinner =
    initializing && teasers.length === 0 && myRewards.length === 0 && !lastOk;

  const showNoVenue =
    !showInitialSpinner && hasLoadedRef.current && !resolvedVenueId;

  const showEmptyPerks =
    !showInitialSpinner &&
    !showNoVenue &&
    hasLoadedRef.current &&
    teasers.length === 0 &&
    myRewards.length === 0 &&
    !lastOk;

  const renderStatusPill = (status: string) => {
    const labelKey = statusLabelKey(status);
    const statusText =
      labelKey === 'perkWallet.statusOther' ? t(labelKey, { status }) : t(labelKey);

    let pillStyle = styles.statusMuted;
    let textStyle = styles.statusMutedText;
    switch (status as RewardStatus | string) {
      case 'REDEEMABLE':
        pillStyle = styles.statusReady;
        textStyle = styles.statusReadyText;
        break;
      case 'REDEEMED':
        pillStyle = styles.statusDone;
        textStyle = styles.statusDoneText;
        break;
      case 'VOIDED':
        pillStyle = styles.statusVoided;
        textStyle = styles.statusVoidedText;
        break;
      case 'LOCKED':
        pillStyle = styles.statusLocked;
        textStyle = styles.statusLockedText;
        break;
      default:
        break;
    }

    return (
      <View style={[styles.statusPill, pillStyle]}>
        <Text style={[styles.statusText, textStyle]}>{statusText}</Text>
      </View>
    );
  };

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
          <Text style={styles.title}>{t('perk.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('perk.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="gift-outline" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t('perk.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('perk.subtitle')}</Text>
        </View>

        {staff.canUseStaffTools && resolvedVenueId && staff.roleAtVenue ? (
          <StaffAtVenueBanner
            colors={colors}
            venueName={
              staff.staffVenues?.find((row) => row.venue.id === resolvedVenueId)?.venue.name ??
              t('perk.title')
            }
            role={staff.roleAtVenue}
            canClaimGuestRewards={staff.canClaimGuestRewards}
            onOpenStaffTools={() =>
              navigation.navigate('StaffRedemptions', {
                venueId: resolvedVenueId,
                venueName:
                  staff.staffVenues?.find((row) => row.venue.id === resolvedVenueId)?.venue.name ??
                  '',
              })
            }
            onOpenScan={() =>
              navigation.navigate('StaffQrScan', {
                venueId: resolvedVenueId,
                venueName:
                  staff.staffVenues?.find((row) => row.venue.id === resolvedVenueId)?.venue.name ??
                  '',
              })
            }
          />
        ) : null}

        {lastOk ? (
          <View style={styles.successCard}>
            <View style={styles.successHeader}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={styles.successTitle}>{t('perk.justRedeemed')}</Text>
            </View>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>{t('perk.staffVerificationCode')}</Text>
              <Text style={styles.codeValue}>{lastOk.staffVerificationCode}</Text>
            </View>
            <Text style={styles.resultTitle}>{lastOk.title}</Text>
            {lastOk.subtitle ? <Text style={styles.resultSub}>{lastOk.subtitle}</Text> : null}
            {lastOk.body ? <Text style={styles.resultBody}>{lastOk.body}</Text> : null}
            <Text style={styles.resultMeta}>{t('perk.showToStaff')}</Text>
          </View>
        ) : null}

        {staff.canClaimGuestRewards && !staffPreDetection ? (
          <View style={styles.codeSection}>
            <Text style={styles.sectionTitle}>{t('perk.enterCodeTitle')}</Text>
            <View style={styles.inputRow}>
              <Ionicons name="keypad-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={t('perk.codePlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
                editable={!busy}
              />
            </View>
            <Pressable
              onPress={() => void redeem()}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color={colors.textInverse} />
                  <Text style={styles.primaryBtnText}>{t('perk.redeem')}</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : staff.isStaffAtVenue ? (
          <View style={styles.staffBlockedCard}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.staffBlockedText}>{t('perk.staffGuestRewardsBlocked')}</Text>
          </View>
        ) : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {showNoVenue ? (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('perk.needVenue')}</Text>
          </View>
        ) : null}

        {showEmptyPerks ? (
          <View style={styles.emptyCard}>
            <Ionicons name="gift-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('perk.emptyAtVenue')}</Text>
          </View>
        ) : null}

        {!showInitialSpinner && teasers.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, styles.listSectionTitle]}>
              {t('perk.availableAtVenue')}
            </Text>
            {teasers.map((p) => (
              <View key={p.id} style={styles.teaserCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.teaserTitle}>{p.title}</Text>
                  {p.redeemedByYou ? (
                    <View style={[styles.statusPill, styles.statusDone]}>
                      <Text style={[styles.statusText, styles.statusDoneText]}>
                        {t('perk.redeemedByYou')}
                      </Text>
                    </View>
                  ) : p.fullyRedeemed ? (
                    <View style={[styles.statusPill, styles.statusMuted]}>
                      <Text style={[styles.statusText, styles.statusMutedText]}>
                        {t('perk.fullyRedeemedLabel')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {p.subtitle ? <Text style={styles.teaserSub}>{p.subtitle}</Text> : null}
                {p.body ? <Text style={styles.teaserBody}>{p.body}</Text> : null}
                {p.requiresQrUnlock ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="qr-code-outline" size={14} color={colors.honey} />
                    <Text style={styles.teaserMeta}>{t('perk.qrUnlockHint')}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {!showInitialSpinner && myRewards.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                styles.listSectionTitle,
                teasers.length > 0 && styles.sectionTitleSpaced,
              ]}
            >
              {t('perk.myRewards')}
            </Text>
            {myRewards.map((r) => {
              const dimmed = r.status !== 'REDEEMABLE' && r.status !== 'LOCKED';
              return (
                <View key={r.redemptionId} style={[styles.rewardCard, dimmed && styles.cardDimmed]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.rewardTitle}>{r.perkTitle}</Text>
                    {renderStatusPill(r.status)}
                  </View>
                  {r.perkSubtitle ? <Text style={styles.teaserSub}>{r.perkSubtitle}</Text> : null}
                  <Text style={styles.expiryLine}>
                    {t('perk.rewardExpires')} {formatExpiry(r.expiresAt)}
                  </Text>
                  {r.status === 'LOCKED' ? (
                    <Text style={styles.lockedHint}>{t('perkWallet.lockedHint')}</Text>
                  ) : null}
                  {!guestActionsAllowed && staff.isStaffAtVenue ? (
                    <Text style={styles.lockedHint}>{t('perk.staffRewardActionsHidden')}</Text>
                  ) : null}
                  {r.status === 'REDEEMABLE' && guestActionsAllowed ? (
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
                      {r.status === 'LOCKED' || !guestActionsAllowed
                        ? t('perkWallet.codeHidden')
                        : r.staffVerificationCode}
                    </Text>
                  </View>
                  {r.status === 'REDEEMABLE' && guestActionsAllowed && isReceiptSubmissionsEnabled() ? (
                    <Pressable
                      style={({ pressed }) => [styles.submitReceiptBtn, pressed && styles.pressed]}
                      onPress={() => {
                        if (!resolvedVenueId) return;
                        navigation.navigate('SubmitReceipt', {
                          venueId: resolvedVenueId,
                          redemptionId: r.redemptionId,
                        });
                      }}
                    >
                      <Text style={styles.submitReceiptBtnText}>
                        {t('perkWallet.submitReceiptToUnlock')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
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
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '900',
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    successCard: {
      backgroundColor: colors.successMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.success,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    successHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    successTitle: {
      color: colors.success,
      fontSize: 15,
      fontWeight: '900',
    },
    codeSection: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    staffBlockedCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    staffBlockedText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    centerBlock: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionTitleSpaced: { marginTop: spacing.lg },
    listSectionTitle: { marginBottom: spacing.md },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 2,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
    },
    primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
    pressed: { opacity: 0.88 },
    disabled: { opacity: 0.6 },
    codeBox: {
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
      fontSize: 22,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 2,
    },
    submitReceiptBtn: {
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    submitReceiptBtnText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    resultTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    resultSub: { color: colors.honeyDark, fontSize: 14, fontWeight: '700' },
    resultBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    resultMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: spacing.xs },
    teaserCard: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    rewardCard: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    cardDimmed: { opacity: 0.88 },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    teaserTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 22 },
    rewardTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900', lineHeight: 22 },
    teaserSub: { color: colors.honeyDark, fontSize: 14, fontWeight: '700', lineHeight: 20 },
    teaserBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    teaserMeta: {
      flex: 1,
      color: colors.honey,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 17,
    },
    expiryLine: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    qrWrap: {
      alignItems: 'center',
      marginTop: spacing.xs,
      padding: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    statusPill: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      maxWidth: '48%',
    },
    statusText: { fontSize: 10, fontWeight: '800' },
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
  });
}
