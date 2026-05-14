import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import {
  fetchMyVenueRewards,
  fetchVenuePerkTeasers,
  type VenuePerkPublicTeaser,
  type VenueRedeemableReward,
} from '../lib/venuePerksApi';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemPerk'>;

type RedeemOk = {
  staffVerificationCode: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  redeemedAt: string;
};

export default function RedeemPerkScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastOk, setLastOk] = useState<RedeemOk | null>(null);
  const [teasers, setTeasers] = useState<VenuePerkPublicTeaser[]>([]);
  const [myRewards, setMyRewards] = useState<VenueRedeemableReward[]>([]);
  const [loadingTeasers, setLoadingTeasers] = useState(true);

  useEffect(() => {
    if (!isLoaded) {
      setLoadingTeasers(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingTeasers(true);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setTeasers([]);
          return;
        }
        const { venue } = await fetchDetectedVenue();
        if (!venue) {
          setTeasers([]);
          return;
        }
        const [list, mine] = await Promise.all([
          fetchVenuePerkTeasers(venue.id, token),
          fetchMyVenueRewards(venue.id, token),
        ]);
        if (!cancelled) {
          setTeasers(list);
          setMyRewards(mine);
        }
      } catch {
        if (!cancelled) setTeasers([]);
      } finally {
        if (!cancelled) setLoadingTeasers(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

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
      try {
        const [list, mine] = await Promise.all([
          fetchVenuePerkTeasers(venueId, token),
          fetchMyVenueRewards(venueId, token),
        ]);
        setTeasers(list);
        setMyRewards(mine);
      } catch {
        /* ignore */
      }
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('perk.redeemFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('perk.title')}</Text>
        <Text style={styles.hint}>{t('perk.subtitle')}</Text>

        {loadingTeasers ? (
          <ActivityIndicator color="#a78bfa" style={{ marginTop: 16 }} />
        ) : teasers.length > 0 ? (
          <View style={styles.teaserSection}>
            <Text style={styles.teaserSectionTitle}>{t('perk.availableAtVenue')}</Text>
            {teasers.map((p) => (
              <View key={p.id} style={styles.teaserCard}>
                <Text style={styles.teaserTitle}>{p.title}</Text>
                {p.subtitle ? (
                  <Text style={styles.teaserSub}>{p.subtitle}</Text>
                ) : null}
                {p.body ? <Text style={styles.teaserBody}>{p.body}</Text> : null}
                {p.requiresQrUnlock ? (
                  <Text style={styles.teaserMeta}>{t('perk.qrUnlockHint')}</Text>
                ) : null}
                {p.redeemedByYou ? (
                  <Text style={styles.teaserBadge}>{t('perk.redeemedByYou')}</Text>
                ) : null}
                {p.fullyRedeemed && !p.redeemedByYou ? (
                  <Text style={styles.teaserBadgeMuted}>{t('perk.fullyRedeemedLabel')}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {myRewards.length > 0 ? (
          <View style={styles.teaserSection}>
            <Text style={styles.teaserSectionTitle}>{t('perk.myRewards')}</Text>
            {myRewards.map((r) => (
              <View key={r.redemptionId} style={styles.rewardCard}>
                <Text style={styles.teaserTitle}>{r.perkTitle}</Text>
                <Text style={styles.teaserBody}>
                  {t('perk.rewardStatus')}: {r.status} · {t('perk.rewardExpires')} {new Date(r.expiresAt).toISOString().slice(0, 10)}
                </Text>
                {r.status === 'REDEEMABLE' ? (
                  <View style={styles.qrWrap}>
                    <QRCode value={r.qrPayload} size={140} />
                  </View>
                ) : null}
                <Text style={styles.teaserMeta}>
                  {t('perk.staffVerificationCode')}: {r.staffVerificationCode}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t('perk.codePlaceholder')}
          placeholderTextColor="#64748b"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          editable={!busy}
        />

        <Pressable
          onPress={() => void redeem()}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryBtnText}>{t('perk.redeem')}</Text>
          )}
        </Pressable>

        {lastOk ? (
          <View style={styles.resultCard}>
            <Text style={styles.verifyLabel}>{t('perk.staffVerificationCode')}</Text>
            <Text style={styles.verifyCode}>{lastOk.staffVerificationCode}</Text>
            <Text style={styles.resultTitle}>{lastOk.title}</Text>
            {lastOk.subtitle ? <Text style={styles.resultSub}>{lastOk.subtitle}</Text> : null}
            {lastOk.body ? <Text style={styles.resultBody}>{lastOk.body}</Text> : null}
            <Text style={styles.resultMeta}>{t('perk.showToStaff')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  input: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  resultCard: {
    marginTop: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.honeyMuted,
    borderRadius: 16,
    padding: 18,
  },
  verifyLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  verifyCode: {
    color: '#fef08a',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 14,
  },
  resultTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  resultSub: { color: colors.honeyDark, marginTop: 8, fontWeight: '700' },
  resultBody: { color: colors.text, marginTop: 10, lineHeight: 20 },
  resultMeta: { color: colors.textMuted, marginTop: 14, fontSize: 12, fontWeight: '600' },
  teaserSection: { marginTop: 20, gap: 10 },
  teaserSectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  teaserCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  teaserTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  teaserSub: { color: colors.honeyDark, marginTop: 6, fontSize: 13, fontWeight: '700' },
  teaserBody: { color: colors.textMuted, marginTop: 8, fontSize: 13, lineHeight: 18 },
  teaserMeta: { color: '#fbbf24', marginTop: 8, fontSize: 12, fontWeight: '700' },
  teaserBadge: { color: '#4ade80', marginTop: 8, fontSize: 12, fontWeight: '800' },
  teaserBadgeMuted: { color: colors.textMuted, marginTop: 8, fontSize: 12, fontWeight: '700' },
  rewardCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    padding: 14,
  },
  qrWrap: {
    marginTop: 10,
    marginBottom: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
  },

    });
}
