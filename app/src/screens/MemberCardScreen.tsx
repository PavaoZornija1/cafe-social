import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import LinearGradientFill from '../components/ui/LinearGradientFill';
import type { RootStackParamList } from '../navigation/type';
import { fetchMyMemberCard, type MemberCardDto } from '../lib/memberCardApi';
import { cacheMemberCard, loadCachedMemberCard } from '../lib/memberCardCache';
import { memberCardQrVisibility, memberCardVenueMode } from '../lib/staffRewardPolicy';
import { useStaffContext, useVenueSession } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberCard'>;

function memberInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

const MemberQrCode = React.memo(function MemberQrCode({
  payload,
  foreground,
  background,
}: {
  payload: string;
  foreground: string;
  background: string;
}) {
  return (
    <QRCode value={payload} size={208} backgroundColor={background} color={foreground} />
  );
});

export default function MemberCardScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const session = useVenueSession();
  const staff = useStaffContext();
  // Own-venue staff mode for the currently detected venue: the card stays
  // accessible (valid elsewhere) but must not be presented as usable here.
  const atOwnVenue =
    memberCardVenueMode({
      activeVenueId: session.playVenueId,
      isStaffAtVenue: staff.isStaffAtVenue,
    }) === 'staffOwnVenue';
  // Fail-safe QR rendering: with an active venue, the QR stays hidden until
  // staff membership state resolves (brief spinner for guests). While venue
  // detection is still pending, only known staff members are held back.
  // Off-venue and offline use keep the QR available.
  const qrVisibility = memberCardQrVisibility({
    activeVenueId: session.playVenueId,
    isStaffAtVenue: staff.isStaffAtVenue,
    staffStateResolved: staff.membershipsResolved,
    venueDetectionPending: session.isLoading,
    hasStaffVenues: staff.hasStaffVenues,
  });
  const ownVenueName = session.detectedVenue?.name ?? '';

  const [card, setCard] = useState<MemberCardDto | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<MemberCardDto | null>(null);
  cardRef.current = card;

  const syncCard = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!isLoaded) return;

    const hasCard = Boolean(cardRef.current);
    if (mode === 'initial' && !hasCard) {
      setInitializing(true);
    } else if (mode === 'refresh') {
      setRefreshing(true);
    }

    const token = await getTokenRef.current();
    if (!token) {
      setInitializing(false);
      setRefreshing(false);
      return;
    }

    try {
      const fresh = await fetchMyMemberCard(token);
      await cacheMemberCard(fresh);
      setCard(fresh);
      setOffline(false);
      setError(null);
    } catch (e) {
      const cached = cardRef.current ?? (await loadCachedMemberCard());
      if (cached) {
        setCard(cached);
        setOffline(true);
        setError(null);
      } else {
        setCard(null);
        setOffline(false);
        setError((e as Error).message || t('memberCard.loadError'));
      }
    } finally {
      setInitializing(false);
      setRefreshing(false);
    }
  }, [isLoaded, t]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function bootstrap() {
      const cached = await loadCachedMemberCard();
      if (cancelled) return;

      if (cached) {
        setCard(cached);
        cardRef.current = cached;
        setInitializing(false);
        void syncCard('refresh');
        return;
      }

      await syncCard('initial');
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, syncCard]);

  const handleRefresh = useCallback(() => {
    void syncCard(cardRef.current ? 'refresh' : 'initial');
  }, [syncCard]);

  const showInitialSpinner = initializing && !card;

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
          <Text style={styles.title}>{t('memberCard.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('memberCard.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('memberCard.lead')}</Text>

        {atOwnVenue ? (
          <View style={styles.staffBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={styles.staffBannerText}>
              {ownVenueName
                ? t('memberCard.staffOwnVenueNotice', { venue: ownVenueName })
                : t('memberCard.staffOwnVenueNoticeNoName')}
            </Text>
          </View>
        ) : null}

        {offline ? (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <Text style={styles.offlineBannerText}>{t('memberCard.offlineHint')}</Text>
          </View>
        ) : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t('memberCard.loading')}</Text>
          </View>
        ) : card ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradientFill from={colors.primaryDark} to={colors.primary} />
              <View style={styles.cardHeaderContent}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="qr-code" size={22} color={colors.textInverse} />
                </View>
                <Text style={styles.cardHeaderTitle}>
                  {atOwnVenue
                    ? t('memberCard.staffOwnVenueHeader')
                    : t('memberCard.showAtTill')}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{memberInitial(card.username)}</Text>
                </View>
                <View style={styles.memberMeta}>
                  <Text style={styles.memberLabel}>{t('memberCard.memberLabel')}</Text>
                  <Text style={styles.username} numberOfLines={1}>
                    {card.username}
                  </Text>
                </View>
              </View>

              <View style={styles.qrWrap}>
                {qrVisibility === 'hiddenStaffVenue' ? (
                  <View style={styles.qrHiddenWrap}>
                    <Ionicons name="eye-off-outline" size={40} color={colors.textMuted} />
                    <Text style={styles.qrHiddenText}>
                      {t('memberCard.staffOwnVenueQrHidden')}
                    </Text>
                  </View>
                ) : qrVisibility === 'hiddenResolving' ? (
                  <View style={styles.qrHiddenWrap}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : card.qrPayload ? (
                  <MemberQrCode
                    payload={card.qrPayload}
                    foreground={colors.primaryDark}
                    background={colors.surface}
                  />
                ) : null}
              </View>

              <Text style={styles.scanHint}>
                {atOwnVenue
                  ? t('memberCard.staffOwnVenueScanHint')
                  : t('memberCard.scanHint')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <Ionicons name="qr-code-outline" size={40} color={colors.textMuted} />
            <Text style={styles.errorText}>{error ?? t('memberCard.loadError')}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={handleRefresh}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {card ? (
          <View style={styles.tipsCard}>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.tipText}>{t('memberCard.tipVisit')}</Text>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.tipText}>{t('memberCard.tipOffline')}</Text>
            </View>
          </View>
        ) : null}
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
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    offlineBannerText: {
      flex: 1,
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    staffBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    staffBannerText: {
      flex: 1,
      color: colors.warning,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    qrHiddenWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    qrHiddenText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 17,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    cardHeader: {
      height: 72,
      overflow: 'hidden',
    },
    cardHeaderContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cardHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeaderTitle: {
      flex: 1,
      color: colors.textInverse,
      fontSize: 17,
      fontWeight: '900',
    },
    cardBody: {
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.lg,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      alignSelf: 'stretch',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '900',
    },
    memberMeta: { flex: 1, minWidth: 0 },
    memberLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    username: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
      marginTop: 2,
    },
    qrWrap: {
      width: 240,
      height: 240,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanHint: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryBtn: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radii.md,
    },
    retryBtnText: {
      color: colors.primaryDark,
      fontWeight: '800',
    },
    tipsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    tipIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    tipText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      paddingTop: spacing.xs,
    },
    pressed: { opacity: 0.88 },
  });
}
