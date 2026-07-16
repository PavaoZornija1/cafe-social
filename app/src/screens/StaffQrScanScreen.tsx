import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { StaffAccessGate } from '../components/staff/StaffAccessGate';
import { parseMemberTokenFromQr } from '../lib/parseMemberCardQr';
import {
  fulfillMemberCardOffer,
  scanAndRedeemStaffReward,
  scanMemberCardAtVenue,
} from '../lib/ownerStaffApi';
import { parseStaffVerificationFromQr } from '../lib/staffQr';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffQrScan'>;

export default function StaffQrScanScreen(props: Props) {
  return (
    <StaffAccessGate>
      <StaffQrScanBody {...props} />
    </StaffAccessGate>
  );
}

function StaffQrScanBody({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { venueId, venueName } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanEnabled, setScanEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canUseCamera = Platform.OS !== 'web';

  const goMatch = useCallback(
    (code: string) => {
      navigation.replace('StaffRedemptions', {
        venueId,
        venueName: venueName ?? '',
        highlightCode: code,
      });
    },
    [navigation, venueId, venueName],
  );

  const scanMemberCard = useCallback(
    async (qrPayload: string) => {
      if (!isLoaded || busy) return;
      setBusy(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setError(t('staff.signInFirst'));
          return;
        }
        const res = await scanMemberCardAtVenue(token, venueId, qrPayload);
        const pending = res.pendingOffers ?? [];
        if (pending.length === 0) {
          Alert.alert(
            t('staff.memberScanSuccessTitle'),
            t('staff.memberScanSuccessBody', { name: res.username }),
            [{ text: t('common.continue'), onPress: () => navigation.goBack() }],
          );
          return;
        }

        const first = pending[0]!;
        const more =
          pending.length > 1
            ? `\n\n${t('staff.memberScanMoreOffers', { count: pending.length - 1 })}`
            : '';
        Alert.alert(
          t('staff.memberScanSuccessTitle'),
          t('staff.memberScanPendingOfferBody', {
            name: res.username,
            offer: first.title,
          }) + more,
          [
            {
              text: t('staff.memberScanFulfillCta'),
              onPress: () => {
                void (async () => {
                  try {
                    const tok = await getTokenRef.current();
                    if (!tok) return;
                    for (const offer of pending) {
                      await fulfillMemberCardOffer(tok, venueId, offer.redemptionId);
                    }
                    Alert.alert(
                      t('staff.memberScanFulfilledTitle'),
                      t('staff.memberScanFulfilledBody', { count: pending.length }),
                      [{ text: t('common.continue'), onPress: () => navigation.goBack() }],
                    );
                  } catch (err) {
                    setError((err as Error).message ?? t('staff.loadFailed'));
                    setScanEnabled(true);
                  }
                })();
              },
            },
            { text: t('common.cancel'), style: 'cancel', onPress: () => navigation.goBack() },
          ],
        );
      } catch (e) {
        setError((e as Error).message ?? t('staff.loadFailed'));
        setScanEnabled(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, navigation, t, venueId],
  );

  const scanRedeem = useCallback(
    async (code: string) => {
      if (!isLoaded || busy) return;
      setBusy(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setError(t('staff.signInFirst'));
          return;
        }
        await scanAndRedeemStaffReward(token, venueId, code);
        Alert.alert(t('staff.scanSuccessTitle'), t('staff.scanSuccessBody'), [
          { text: t('common.continue'), onPress: () => goMatch(code) },
        ]);
      } catch (e) {
        setError((e as Error).message ?? t('staff.loadFailed'));
        setScanEnabled(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, goMatch, isLoaded, t, venueId],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanEnabled || busy) return;
      if (parseMemberTokenFromQr(data)) {
        setScanEnabled(false);
        setError(null);
        void scanMemberCard(data);
        return;
      }
      const code = parseStaffVerificationFromQr(data);
      if (code) {
        setScanEnabled(false);
        setError(null);
        void scanRedeem(code);
      } else {
        setError(t('staff.qrUnrecognized'));
      }
    },
    [busy, scanEnabled, scanMemberCard, scanRedeem, t],
  );

  const applyManual = useCallback(() => {
    if (busy) return;
    setError(null);
    if (parseMemberTokenFromQr(manual)) {
      void scanMemberCard(manual);
      return;
    }
    const code = parseStaffVerificationFromQr(manual);
    if (!code) {
      setError(t('staff.codeInvalid'));
      return;
    }
    void scanRedeem(code);
  }, [busy, manual, scanMemberCard, scanRedeem, t]);

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
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('staff.scanTitle')}</Text>
          <View style={styles.iconBtnPlaceholder} />
        </View>

        <Text style={styles.subtitle}>{t('staff.scanSubtitle')}</Text>

        <View style={styles.scannerWrap}>
          {canUseCamera && permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanEnabled && !busy ? onBarcodeScanned : undefined}
              />
              {busy ? (
                <View style={styles.scannerOverlay}>
                  <ActivityIndicator color={colors.textInverse} size="large" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.scannerFallback}>
              <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
              <Text style={styles.fallbackText}>
                {!canUseCamera
                  ? t('qr.webNoCamera')
                  : permission?.granted === false
                    ? t('qr.cameraDenied')
                    : t('qr.cameraPrompt')}
              </Text>
              {canUseCamera && permission && !permission.granted ? (
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  onPress={() => void requestPermission()}
                >
                  <Text style={styles.primaryBtnText}>{t('qr.allowCamera')}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {canUseCamera && permission?.granted ? (
          <Pressable
            style={({ pressed }) => [styles.scanAgainBtn, pressed && styles.pressed]}
            onPress={() => {
              setScanEnabled(true);
              setError(null);
            }}
            disabled={busy}
          >
            <Ionicons name="scan-outline" size={16} color={colors.primary} />
            <Text style={styles.scanAgainText}>{t('qr.scanAgain')}</Text>
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>{t('staff.manualCode')}</Text>
          <TextInput
            value={manual}
            onChangeText={setManual}
            autoCapitalize="characters"
            placeholder={t('staff.manualPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={isLoaded && !busy}
          />
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            onPress={applyManual}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryBtnText}>{t('staff.findOnList')}</Text>
            )}
          </Pressable>
        </View>
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
    iconBtnPlaceholder: { width: 44, height: 44 },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: spacing.lg,
    },
    scannerWrap: {
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      height: 260,
      backgroundColor: '#000',
    },
    camera: { flex: 1 },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scannerFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: colors.surface,
      gap: spacing.md,
    },
    fallbackText: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    scanAgainBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      alignSelf: 'center',
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    scanAgainText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.errorMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
    },
    errorText: {
      flex: 1,
      color: colors.error,
      fontSize: 13,
      lineHeight: 18,
    },
    manualCard: {
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    manualLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 16,
      letterSpacing: 1,
    },
    primaryBtn: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '800',
      fontSize: 15,
    },
    pressed: { opacity: 0.88 },
    disabled: { opacity: 0.6 },
  });
}
