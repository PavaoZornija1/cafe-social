import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { parseVenueIdFromQr } from '../lib/parseVenueQr';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScan'>;

export default function QrScanScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [qrVenueId, setQrVenueId] = useState<string>(route.params?.venueId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);

  const canUseCamera = Platform.OS !== 'web';

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

      await apiPost(`/venue-context/${encodeURIComponent(qrVenueId.trim())}/register`, undefined, token);
      navigation.replace('Home');
    } catch (e) {
      setError((e as Error).message || t('qr.unlockError'));
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanEnabled) return;
      const id = parseVenueIdFromQr(data);
      if (id) {
        setScanEnabled(false);
        setQrVenueId(id);
        setError(null);
      } else {
        setError(t('qr.scanUnrecognized'));
      }
    },
    [scanEnabled, t],
  );

  const askCamera = () => {
    void requestPermission();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('qr.title')}</Text>
        <Text style={styles.subtitle}>{t('qr.subtitle')}</Text>

        <View style={styles.scannerWrap}>
          {canUseCamera && permission?.granted ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanEnabled ? onBarcodeScanned : undefined}
            />
          ) : (
            <View style={styles.scannerFallback}>
              <Text style={styles.scannerText}>
                {!canUseCamera
                  ? t('qr.webNoCamera')
                  : permission?.granted === false
                    ? t('qr.cameraDenied')
                    : t('qr.cameraPrompt')}
              </Text>
              {canUseCamera && permission && !permission.granted ? (
                <Pressable style={styles.permBtn} onPress={askCamera}>
                  <Text style={styles.permBtnText}>{t('qr.allowCamera')}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {canUseCamera && permission?.granted ? (
          <Pressable
            style={styles.secondarySmall}
            onPress={() => {
              setScanEnabled(true);
              setError(null);
            }}
          >
            <Text style={styles.secondarySmallText}>{t('qr.scanAgain')}</Text>
          </Pressable>
        ) : null}

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
          onPress={() => void handleRegister()}
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
    height: 260,
  },
  camera: { flex: 1, width: '100%' },
  scannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  scannerText: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  permBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
  },
  permBtnText: { color: '#fff', fontWeight: '800' },
  secondarySmall: { marginTop: 8, alignSelf: 'center' },
  secondarySmallText: { color: '#a5b4fc', fontWeight: '700', fontSize: 13 },
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
