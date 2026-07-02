import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { triggerFeedback } from '../lib/feedback';
import { getCoordinatesForVenueDetect } from '../lib/locationForDetect';
import { parseVenueIdFromQr } from '../lib/parseVenueQr';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

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
  const [scannedVenueId, setScannedVenueId] = useState<string | null>(null);

  const canUseCamera = Platform.OS !== 'web';
  const cameraReady = canUseCamera && Boolean(permission?.granted);

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

      triggerFeedback('checkIn');
      navigation.replace('MainTabs');
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
        setScannedVenueId(id);
        setError(null);
      } else {
        setError(t('qr.scanUnrecognized'));
      }
    },
    [scanEnabled, t],
  );

  const resetScan = () => {
    setScanEnabled(true);
    setScannedVenueId(null);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={loading}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('qr.title')}</Text>
          <View style={styles.iconBtnSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="qr-code-outline" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t('qr.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('qr.subtitle')}</Text>
        </View>

        <View style={styles.scannerSection}>
          <Text style={styles.sectionTitle}>{t('qr.scanSectionTitle')}</Text>
          <View style={styles.scannerWrap}>
            {cameraReady ? (
              <>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanEnabled ? onBarcodeScanned : undefined}
                />
                <View style={styles.viewfinder} pointerEvents="none">
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                {!scanEnabled ? (
                  <View style={styles.scanPausedOverlay}>
                    <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                    <Text style={styles.scanPausedText}>{t('qr.codeCaptured')}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.scannerFallback}>
                <Ionicons
                  name={canUseCamera ? 'camera-outline' : 'globe-outline'}
                  size={36}
                  color={colors.textMuted}
                />
                <Text style={styles.scannerText}>
                  {!canUseCamera
                    ? t('qr.webNoCamera')
                    : permission?.granted === false
                      ? t('qr.cameraDenied')
                      : t('qr.cameraPrompt')}
                </Text>
                {canUseCamera && permission && !permission.granted ? (
                  <Pressable
                    style={({ pressed }) => [styles.permBtn, pressed && styles.pressed]}
                    onPress={() => void requestPermission()}
                  >
                    <Ionicons name="camera" size={16} color={colors.textInverse} />
                    <Text style={styles.permBtnText}>{t('qr.allowCamera')}</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {cameraReady ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={resetScan}
            >
              <Ionicons name="scan-outline" size={16} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('qr.scanAgain')}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.manualSection}>
          <Text style={styles.sectionTitle}>{t('qr.manualEntryTitle')}</Text>
          <View style={styles.inputRow}>
            <Ionicons name="storefront-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder={t('qr.venuePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={qrVenueId}
              onChangeText={(value) => {
                setQrVenueId(value);
                setScannedVenueId(null);
                setScanEnabled(true);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {scannedVenueId ? (
            <View style={styles.capturedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.capturedBadgeText}>{t('qr.codeCaptured')}</Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.pressed,
            (loading || !isLoaded) && styles.primaryBtnDisabled,
          ]}
          onPress={() => void handleRegister()}
          disabled={loading || !isLoaded}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="location" size={18} color={colors.textInverse} />
              <Text style={styles.primaryBtnText}>{t('qr.checkInCta')}</Text>
            </>
          )}
        </Pressable>
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
    iconBtnSpacer: { width: 44, height: 44 },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
      textAlign: 'center',
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
    scannerSection: {
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    scannerWrap: {
      borderRadius: radii.xl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      height: 280,
    },
    camera: { flex: 1, width: '100%' },
    viewfinder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: colors.textInverse,
    },
    cornerTL: {
      top: '22%',
      left: '14%',
      borderTopWidth: 3,
      borderLeftWidth: 3,
      borderTopLeftRadius: radii.sm,
    },
    cornerTR: {
      top: '22%',
      right: '14%',
      borderTopWidth: 3,
      borderRightWidth: 3,
      borderTopRightRadius: radii.sm,
    },
    cornerBL: {
      bottom: '22%',
      left: '14%',
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: radii.sm,
    },
    cornerBR: {
      bottom: '22%',
      right: '14%',
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: radii.sm,
    },
    scanPausedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    scanPausedText: {
      color: colors.textInverse,
      fontSize: 14,
      fontWeight: '800',
    },
    scannerFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    scannerText: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    permBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    permBtnText: { color: colors.textInverse, fontWeight: '800', fontSize: 14 },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    manualSection: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
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
      fontSize: 15,
      fontWeight: '600',
    },
    capturedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      backgroundColor: colors.successMuted,
      borderRadius: radii.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    capturedBadgeText: {
      color: colors.success,
      fontSize: 12,
      fontWeight: '800',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.errorMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorText: {
      flex: 1,
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
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
    primaryBtnDisabled: { opacity: 0.65 },
    primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },
    pressed: { opacity: 0.88 },
  });
}
