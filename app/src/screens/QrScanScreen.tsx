import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { getCoordinatesForVenueDetect } from '../lib/locationForDetect';
import { parseVenueIdFromQr } from '../lib/parseVenueQr';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScan'>;

export default function QrScanScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

      const coords = await getCoordinatesForVenueDetect('high');
      const body =
        coords != null
          ? { latitude: coords.lat, longitude: coords.lng }
          : {};

      try {
        await apiPost(
          `/venue-context/${encodeURIComponent(qrVenueId.trim())}/register`,
          body,
          token,
        );
      } catch (e) {
        const msg = (e as Error).message ?? '';
        if (!coords && /check-in at the location/i.test(msg)) {
          throw new Error(t('qr.needLocationForCheckIn'));
        }
        throw e;
      }

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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} disabled={loading}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('qr.title')}</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.screenLead}>{t('qr.subtitle')}</Text>
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
          placeholderTextColor={colors.textMuted}
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
          {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>{t('qr.unlock')}</Text>}
        </Pressable>

      </View>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  screenLead: { color: colors.textMuted, fontSize: 14, marginBottom: 8, lineHeight: 20 },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  scannerWrap: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.textMuted,
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
    backgroundColor: colors.primary,
  },
  permBtnText: { color: colors.textInverse, fontWeight: '800' },
  secondarySmall: { marginTop: 8, alignSelf: 'center' },
  secondarySmallText: { color: colors.honeyDark, fontWeight: '700', fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.error, fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: '600' },

    });
}
