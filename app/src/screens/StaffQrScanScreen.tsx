import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { parseStaffVerificationFromQr } from '../lib/staffQr';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffQrScan'>;

export default function StaffQrScanScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { isLoaded } = useAuth();
  const { venueId, venueName } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanEnabled, setScanEnabled] = useState(true);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canUseCamera = Platform.OS !== 'web';

  const goMatch = useCallback(
    (code: string) => {
      const name = venueName ?? '';
      navigation.replace('StaffRedemptions', {
        venueId,
        venueName: name,
        highlightCode: code,
      });
    },
    [navigation, venueId, venueName],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanEnabled) return;
      const code = parseStaffVerificationFromQr(data);
      if (code) {
        setScanEnabled(false);
        setError(null);
        goMatch(code);
      } else {
        setError(t('staff.qrUnrecognized'));
      }
    },
    [scanEnabled, goMatch, t],
  );

  const applyManual = () => {
    setError(null);
    const code = parseStaffVerificationFromQr(manual);
    if (!code) {
      setError(t('staff.codeInvalid'));
      return;
    }
    goMatch(code);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('staff.scanTitle')}</Text>
      </View>
      <Text style={styles.sub}>{t('staff.scanSubtitle')}</Text>

      <View style={styles.scannerWrap}>
        {canUseCamera && permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanEnabled ? onBarcodeScanned : undefined}
          />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>
              {!canUseCamera
                ? t('qr.webNoCamera')
                : permission?.granted === false
                  ? t('qr.cameraDenied')
                  : t('qr.cameraPrompt')}
            </Text>
            {canUseCamera && permission && !permission.granted ? (
              <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.manual}>
        <Text style={styles.manualLabel}>{t('staff.manualCode')}</Text>
        <TextInput
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
          placeholder={t('staff.manualPlaceholder')}
          placeholderTextColor="#6b7280"
          style={styles.input}
          editable={isLoaded}
        />
        <Pressable style={styles.applyBtn} onPress={applyManual}>
          <Text style={styles.applyBtnText}>{t('staff.findOnList')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#111827' },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  sub: { color: '#6b7280', fontSize: 13, marginHorizontal: 24, marginTop: 10, lineHeight: 18 },
  scannerWrap: {
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
    height: 240,
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#111827',
  },
  fallbackText: { color: '#9ca3af', textAlign: 'center' },
  permBtn: {
    marginTop: 12,
    backgroundColor: '#6d28d9',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permBtnText: { color: '#fff', fontWeight: '800' },
  secondarySmall: { alignSelf: 'center', marginTop: 10 },
  secondarySmallText: { color: '#a78bfa', fontWeight: '700', fontSize: 13 },
  error: { color: '#f87171', marginHorizontal: 24, marginTop: 10, fontSize: 13 },
  manual: { marginHorizontal: 24, marginTop: 20 },
  manualLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 16,
    letterSpacing: 1,
  },
  applyBtn: {
    marginTop: 12,
    backgroundColor: '#4c1d95',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: { color: '#e9d5ff', fontWeight: '800' },
});
