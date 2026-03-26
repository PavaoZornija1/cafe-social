import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemPerk'>;

type RedeemOk = {
  staffVerificationCode: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  redeemedAt: string;
};

export default function RedeemPerkScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastOk, setLastOk] = useState<RedeemOk | null>(null);

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
    let venueId = route.params?.venueId?.trim() ?? '';
    if (!venueId) {
      const det = await fetchDetectedVenue();
      venueId = det?.id ?? '';
    }
    if (!venueId) {
      Alert.alert(t('common.error'), t('perk.needVenue'));
      return;
    }
    const detected = await fetchDetectedVenue();
    setBusy(true);
    try {
      const res = await apiPost<RedeemOk>(
        `/venue-context/${encodeURIComponent(venueId)}/perks/redeem`,
        { code: raw, detectedVenueId: detected?.id ?? null },
        token,
      );
      setLastOk(res);
      setCode('');
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
            <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  scroll: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    marginBottom: 16,
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hint: { color: '#64748b', fontSize: 13, marginTop: 8, lineHeight: 18 },
  input: {
    marginTop: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  resultCard: {
    marginTop: 28,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#312e81',
    borderRadius: 16,
    padding: 18,
  },
  verifyLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  verifyCode: {
    color: '#fef08a',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 14,
  },
  resultTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  resultSub: { color: '#a5b4fc', marginTop: 8, fontWeight: '700' },
  resultBody: { color: '#e2e8f0', marginTop: 10, lineHeight: 20 },
  resultMeta: { color: '#64748b', marginTop: 14, fontSize: 12, fontWeight: '600' },
});
