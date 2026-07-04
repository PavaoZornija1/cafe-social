import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useQueryClient } from '@tanstack/react-query';
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
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import { getCoordinatesForVenueDetect } from '../lib/locationForDetect';
import { parseVenueIdFromQr } from '../lib/parseVenueQr';
import { invalidateVenueSession } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScan'>;

export default function QrScanScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const knownVenueId = route.params?.venueId?.trim() || '';
  const [scannedVenueId, setScannedVenueId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);

  const canUseCamera = Platform.OS !== 'web';
  const cameraReady = canUseCamera && Boolean(permission?.granted);
  /** Prefer a fresh scan; otherwise the venue we opened this screen from. */
  const venueId = scannedVenueId ?? knownVenueId;
  const readyToCheckIn = venueId.length > 0;

  useEffect(() => {
    // Opening from a known venue (Home / hub) — no need to keep scanning.
    if (knownVenueId) setScanEnabled(false);
  }, [knownVenueId]);

  const handleRegister = async () => {
    setError(null);
    const id = venueId.trim();

    if (!id) {
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
          `/venue-context/${encodeURIComponent(id)}/register`,
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
      await invalidateVenueSession(queryClient, id);
      navigation.replace('MainTabs');
    } catch (e) {
      setError((e as Error).message || t('qr.unlockError'));
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanEnabled || loading) return;
      const id = parseVenueIdFromQr(data);
      if (id) {
        setScanEnabled(false);
        setScannedVenueId(id);
        setError(null);
      } else {
        setError(t('qr.scanUnrecognized'));
      }
    },
    [scanEnabled, loading, t],
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
          <Text style={styles.heroTitle}>
            {knownVenueId && !scannedVenueId ? t('qr.heroTitleKnownVenue') : t('qr.heroTitle')}
          </Text>
          <Text style={styles.heroSub}>
            {knownVenueId && !scannedVenueId ? t('qr.subtitleKnownVenue') : t('qr.subtitle')}
          </Text>
        </View>

        {knownVenueId && !scanEnabled && !scannedVenueId ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, styles.scanInsteadBtn, pressed && styles.pressed]}
            onPress={() => {
              setScanEnabled(true);
              setError(null);
            }}
            disabled={loading}
          >
            <Ionicons name="scan-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryBtnText}>{t('qr.scanInstead')}</Text>
          </Pressable>
        ) : null}

        {!knownVenueId || scanEnabled || scannedVenueId ? (
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
                  {!scanEnabled && scannedVenueId ? (
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

            {cameraReady && scannedVenueId ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                onPress={resetScan}
                disabled={loading}
              >
                <Ionicons name="scan-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>{t('qr.scanAgain')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {readyToCheckIn ? (
          <View style={styles.readyCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.readyText}>
              {scannedVenueId ? t('qr.codeCaptured') : t('qr.readyKnownVenue')}
            </Text>
          </View>
        ) : null}

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
            (loading || !isLoaded || !readyToCheckIn) && styles.primaryBtnDisabled,
          ]}
          onPress={() => void handleRegister()}
          disabled={loading || !isLoaded || !readyToCheckIn}
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
    scanInsteadBtn: { marginBottom: spacing.lg },
    readyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.successMuted,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    readyText: {
      flex: 1,
      color: colors.success,
      fontSize: 14,
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
