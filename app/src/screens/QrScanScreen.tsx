import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScan'>;

export default function QrScanScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const [loading, setLoading] = useState(false);
  const [qrVenueId, setQrVenueId] = useState<string>(route.params?.venueId ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.venueId) setQrVenueId(route.params.venueId);
  }, [route.params?.venueId]);

  const handleRegister = async () => {
    setError(null);

    if (!qrVenueId.trim()) {
      setError(t('qr.emptyCode'));
      return;
    }

    if (!isLoaded) return;

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error(t('qr.notAuthenticated'));

      await apiPost(`/venue-context/${encodeURIComponent(qrVenueId)}/register`, undefined, token);
      navigation.replace('Home');
    } catch (e) {
      setError((e as Error).message || t('qr.unlockError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('qr.title')}</Text>
        <Text style={styles.subtitle}>{t('qr.subtitle')}</Text>

        <View style={styles.scannerWrap}>
          <View style={styles.scanner}>
            <Text style={styles.scannerText}>{t('qr.cameraDisabled')}</Text>
          </View>
        </View>

        <Text style={styles.label}>{t('qr.venueCode')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('qr.venuePlaceholder')}
          placeholderTextColor="#6b7280"
          value={qrVenueId}
          onChangeText={setQrVenueId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !isLoaded}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('qr.unlock')}</Text>}
        </Pressable>

        <Pressable style={styles.link} onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={styles.linkText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9ca3af', fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: '#d1d5db', fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  scannerWrap: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  scanner: {
    width: '100%',
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  error: { color: '#f87171', fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { color: '#a5b4fc', fontWeight: '600', fontSize: 14 },
});
