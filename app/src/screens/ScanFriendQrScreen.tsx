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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { parseFriendInviteTokenFromQr } from '../lib/parseFriendInviteQr';
import { redeemFriendInvite } from '../lib/redeemFriendInvite';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanFriendQr'>;

export default function ScanFriendQrScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);

  const canUseCamera = Platform.OS !== 'web';

  const redeemToken = useCallback(
    async (token: string) => {
      if (!isLoaded || busy) return;
      setBusy(true);
      setError(null);
      try {
        const jwt = await getTokenRef.current();
        if (!jwt) throw new Error(t('scanFriendQr.notAuthenticated'));

        const res = await redeemFriendInvite(jwt, token);
        if (res.kind === 'PARTY' && res.partyId) {
          Alert.alert('', t('redeem.joinedParty'), [
            {
              text: t('common.continue'),
              onPress: () => navigation.replace('PartyDetail', { partyId: res.partyId! }),
            },
          ]);
          return;
        }

        Alert.alert('', t('redeem.friendLinked'), [
          { text: t('common.continue'), onPress: () => navigation.goBack() },
        ]);
      } catch (e) {
        setError((e as Error).message || t('scanFriendQr.redeemFailed'));
        setScanEnabled(true);
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, navigation, t],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanEnabled || busy) return;
      const token = parseFriendInviteTokenFromQr(data);
      if (!token) {
        setError(t('scanFriendQr.unrecognized'));
        return;
      }
      setScanEnabled(false);
      setError(null);
      void redeemToken(token);
    },
    [busy, redeemToken, scanEnabled, t],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('scanFriendQr.title')}</Text>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      <Text style={styles.subtitle}>{t('scanFriendQr.subtitle')}</Text>

      <View style={styles.scannerWrap}>
        {canUseCamera && permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanEnabled && !busy ? onBarcodeScanned : undefined}
          />
        ) : (
          <View style={styles.scannerFallback}>
            <Text style={styles.fallbackText}>
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
                <Text style={styles.permBtnText}>{t('qr.allowCamera')}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.busyText}>{t('scanFriendQr.adding')}</Text>
          </View>
        ) : null}
      </View>

      {canUseCamera && permission?.granted ? (
        <Pressable
          style={({ pressed }) => [styles.scanAgainBtn, pressed && styles.pressed]}
          onPress={() => {
            setScanEnabled(true);
            setError(null);
          }}
        >
          <Text style={styles.scanAgainText}>{t('qr.scanAgain')}</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
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
    },
    iconBtnPlaceholder: { width: 44 },
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
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.lg,
    },
    scannerWrap: {
      marginHorizontal: spacing.xl,
      height: 320,
      borderRadius: radii.xl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    camera: { flex: 1, width: '100%' },
    scannerFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    fallbackText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      fontWeight: '600',
    },
    permBtn: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
    },
    permBtnText: { color: colors.textInverse, fontWeight: '800' },
    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    busyText: { color: colors.textInverse, fontWeight: '700' },
    scanAgainBtn: { alignSelf: 'center', marginTop: spacing.md },
    scanAgainText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
    error: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      marginTop: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    pressed: { opacity: 0.88 },
  });
}
