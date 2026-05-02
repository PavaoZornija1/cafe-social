import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
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

export default function RewardsHubScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<GlobalRewardClaimsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
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
      setError(t('rewardsHub.loadError'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const items: GlobalRewardClaim[] = payload?.items ?? [];
  const activeN = payload?.wallet.activeRedeemable ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
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

        {items.map((r) => (
          <View key={r.redemptionId} style={styles.card}>
            <Text style={styles.venueName}>{r.venueName}</Text>
            <Text style={styles.perkTitle}>{r.perkTitle}</Text>
            {r.perkSubtitle ? <Text style={styles.perkSub}>{r.perkSubtitle}</Text> : null}
            <Text style={styles.meta}>
              {t('perk.rewardStatus')}: {r.status} · {t('perk.rewardExpires')}{' '}
              {new Date(r.expiresAt).toISOString().slice(0, 10)}
            </Text>
            {r.status === 'REDEEMABLE' ? (
              <View style={styles.qrWrap}>
                <QRCode value={r.qrPayload} size={140} />
              </View>
            ) : null}
            <Text style={styles.codeLine}>
              {t('perk.staffVerificationCode')}: {r.staffVerificationCode}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() =>
                navigation.navigate('VenueHub', { venueId: r.venueId, venueName: r.venueName })
              }
            >
              <Text style={styles.secondaryBtnText}>{t('rewardsHub.openVenue')}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
    err: { marginTop: 12, color: '#b91c1c', fontSize: 14 },
    empty: { marginTop: 16, fontSize: 15, color: colors.textMuted },
    card: {
      marginTop: 16,
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
    secondaryBtn: {
      marginTop: 12,
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
