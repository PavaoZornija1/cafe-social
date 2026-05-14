import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardsHub'>;

function statusLabelKey(status: string): string {
  switch (status) {
    case 'REDEEMABLE':
      return 'rewardsHub.statusRedeemable';
    case 'EXPIRED':
      return 'rewardsHub.statusExpired';
    case 'VOIDED':
      return 'rewardsHub.statusVoided';
    case 'REDEEMED':
      return 'rewardsHub.statusRedeemed';
    default:
      return 'rewardsHub.statusOther';
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

export default function RewardsHubScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<GlobalRewardClaimsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRewards = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!isLoaded) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setPayload(null);
        return;
      }
      const data = await fetchMyGlobalRewardClaims(token);
      setPayload(data);
    } catch {
      setError(tRef.current('rewardsHub.loadError'));
      setPayload(null);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [isLoaded]);

  useFocusEffect(
    useCallback(() => {
      void fetchRewards('initial');
    }, [fetchRewards]),
  );

  const items: GlobalRewardClaim[] = payload?.items ?? [];
  const activeN = payload?.wallet.activeRedeemable ?? 0;

  const { redeemable, history } = useMemo(() => {
    const r: GlobalRewardClaim[] = [];
    const h: GlobalRewardClaim[] = [];
    for (const it of items) {
      if (it.status === 'REDEEMABLE') r.push(it);
      else h.push(it);
    }
    return { redeemable: r, history: h };
  }, [items]);

  const onRefresh = useCallback(() => {
    void fetchRewards('refresh');
  }, [fetchRewards]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            title={t('rewardsHub.pullToRefresh')}
          />
        }
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('rewardsHub.title')}</Text>
        <Text style={styles.hint}>{t('rewardsHub.subtitle')}</Text>
        {payload != null && activeN > 0 ? (
          <Text style={styles.meta}>{t('rewardsHub.activeCount', { n: activeN })}</Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : null}
        {error ? <Text style={styles.err}>{error}</Text> : null}

        {!loading && !error && items.length === 0 ? (
          <Text style={styles.empty}>{t('rewardsHub.empty')}</Text>
        ) : null}

        {redeemable.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('rewardsHub.sectionReady')}</Text>
            {redeemable.map((r) => (
              <RewardClaimCard
                key={r.redemptionId}
                r={r}
                styles={styles}
                navigation={navigation}
                showQr
              />
            ))}
          </>
        ) : null}

        {history.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                redeemable.length > 0 ? styles.sectionTitleSpaced : null,
              ]}
            >
              {t('rewardsHub.sectionHistory')}
            </Text>
            {history.map((r) => (
              <RewardClaimCard
                key={r.redemptionId}
                r={r}
                styles={styles}
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

type RewardClaimCardProps = {
  r: GlobalRewardClaim;
  styles: ReturnType<typeof createStyles>;
  navigation: Props['navigation'];
  showQr: boolean;
};

function RewardClaimCard({ r, styles, navigation, showQr }: RewardClaimCardProps) {
  const { t } = useTranslation();
  const labelKey = statusLabelKey(r.status);
  const statusText =
    labelKey === 'rewardsHub.statusOther'
      ? t(labelKey, { status: r.status })
      : t(labelKey);

  return (
    <View style={styles.card}>
      <Text style={styles.venueName}>{r.venueName}</Text>
      <Text style={styles.perkTitle}>{r.perkTitle}</Text>
      {r.perkSubtitle ? <Text style={styles.perkSub}>{r.perkSubtitle}</Text> : null}
      <Text style={styles.meta}>
        {t('perk.rewardStatus')}: {statusText} · {t('perk.rewardExpires')}{' '}
        {formatExpiry(r.expiresAt)}
      </Text>
      {showQr && r.status === 'REDEEMABLE' ? (
        <View style={styles.qrWrap}>
          <QRCode value={r.qrPayload} size={140} />
        </View>
      ) : null}
      <Text style={styles.codeLine}>
        {t('perk.staffVerificationCode')}: {r.staffVerificationCode}
      </Text>
      {r.status === 'REDEEMABLE' ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('RedeemPerk', { venueId: r.venueId })}
        >
          <Text style={styles.primaryBtnText}>{t('rewardsHub.redeemAtVenue')}</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        onPress={() =>
          navigation.navigate('VenueHub', { venueId: r.venueId, venueName: r.venueName })
        }
      >
        <Text style={styles.secondaryBtnText}>{t('rewardsHub.openVenue')}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
    backText: { color: colors.primary, fontSize: 16 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    hint: { marginTop: 6, fontSize: 14, color: colors.textMuted },
    meta: { marginTop: 8, fontSize: 13, color: colors.textMuted },
    sectionTitle: {
      marginTop: 20,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    sectionTitleSpaced: { marginTop: 28 },
    err: { marginTop: 12, color: colors.error, fontSize: 14 },
    empty: { marginTop: 16, fontSize: 15, color: colors.textMuted },
    card: {
      marginTop: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    venueName: { fontSize: 12, fontWeight: '600', color: colors.primary, marginBottom: 4 },
    perkTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    perkSub: { marginTop: 4, fontSize: 14, color: colors.textMuted },
    qrWrap: { alignItems: 'center', marginTop: 12 },
    codeLine: { marginTop: 10, fontSize: 12, color: colors.textMuted },
    primaryBtn: {
      marginTop: 12,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    primaryBtnText: { color: colors.textInverse, fontSize: 14, fontWeight: '600' },
    secondaryBtn: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: '500' },
    pressed: { opacity: 0.85 },
  });
}
