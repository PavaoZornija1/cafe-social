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
import {
  fetchMyVenueRewards,
  fetchVenuePerkTeasers,
  type VenuePerkPublicTeaser,
  type VenueRedeemableReward,
} from '../lib/venuePerksApi';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemPerk'>;

type RedeemOk = {
  staffVerificationCode: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  redeemedAt: string;
};

type RewardStatus = 'REDEEMABLE' | 'EXPIRED' | 'VOIDED' | 'REDEEMED';

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
      const hasData = teasersRef.current.length > 0 || myRewardsRef.current.length > 0;
      if (mode === 'initial' && !hasData) {
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
          return;
        }

        const { venue } = await fetchDetectedVenue();
        if (!venue) {
          setTeasers([]);
          setMyRewards([]);
          return;
        }

        const [list, mine] = await Promise.all([
          fetchVenuePerkTeasers(venue.id, token),
          fetchMyVenueRewards(venue.id, token),
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
    [isLoaded],
  );

  const loadPerksRef = useRef(loadPerks);
  loadPerksRef.current = loadPerks;

  useEffect(() => {
    if (!isLoaded) {
      setInitializing(false);
      return;
    }
    void loadPerks('initial');
  }, [isLoaded, loadPerks]);

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

  const showInitialSpinner =
    initializing && teasers.length === 0 && myRewards.length === 0 && !lastOk;

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

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {!showInitialSpinner && teasers.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('perk.availableAtVenue')}</Text>
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
            <Text style={[styles.sectionTitle, teasers.length > 0 && styles.sectionTitleSpaced]}>
              {t('perk.myRewards')}
            </Text>
            {myRewards.map((r) => {
              const dimmed = r.status !== 'REDEEMABLE';
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
                  {r.status === 'REDEEMABLE' ? (
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
                    <Text style={styles.codeValue}>{r.staffVerificationCode}</Text>
                  </View>
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
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionTitleSpaced: { marginTop: spacing.lg },
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
    centerBlock: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
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
    statusMuted: { backgroundColor: colors.bgElevated },
    statusMutedText: { color: colors.textMuted },
    statusVoided: { backgroundColor: colors.errorMuted },
    statusVoidedText: { color: colors.error },
  });
}
