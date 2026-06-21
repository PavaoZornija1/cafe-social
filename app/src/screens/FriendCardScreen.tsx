import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import LinearGradientFill from '../components/ui/LinearGradientFill';
import {
  buildFriendInviteDeepLink,
  buildFriendInviteQrPayload,
  createFriendInvite,
} from '../lib/friendInviteApi';
import {
  cacheFriendInvite,
  isFriendInviteValid,
  loadCachedFriendInvite,
  type CachedFriendInvite,
} from '../lib/friendInviteCache';
import { fetchMyMemberCard } from '../lib/memberCardApi';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendCard'>;

const FriendQrCode = React.memo(function FriendQrCode({
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

function memberInitial(username: string): string {
  const trimmed = username.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function formatExpiry(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FriendCardScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [invite, setInvite] = useState<CachedFriendInvite | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inviteRef = useRef<CachedFriendInvite | null>(null);
  inviteRef.current = invite;

  const buildInvite = useCallback(
    async (token: string, username: string, forceNew: boolean): Promise<CachedFriendInvite> => {
      const jwt = await getTokenRef.current();
      if (!jwt) throw new Error('Not authenticated');

      let inviteToken = token;
      let expiresAt = inviteRef.current?.expiresAt ?? '';

      if (forceNew || !inviteToken || !isFriendInviteValid(expiresAt)) {
        const created = await createFriendInvite(jwt);
        inviteToken = created.token;
        expiresAt = created.expiresAt;
      }

      const next: CachedFriendInvite = {
        token: inviteToken,
        expiresAt,
        qrPayload: buildFriendInviteQrPayload(inviteToken),
        username,
      };
      await cacheFriendInvite(next);
      return next;
    },
    [],
  );

  const syncInvite = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!isLoaded) return;

      const hasInvite = Boolean(inviteRef.current);
      if (mode === 'initial' && !hasInvite) {
        setInitializing(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }
      setError(null);

      try {
        const jwt = await getTokenRef.current();
        if (!jwt) return;

        const memberCard = await fetchMyMemberCard(jwt).catch(() => null);
        const username = memberCard?.username?.trim() || t('friendCard.memberFallback');

        const cached = inviteRef.current ?? (await loadCachedFriendInvite());
        const useCache = cached && isFriendInviteValid(cached.expiresAt);
        const next = await buildInvite(
          useCache && mode !== 'refresh' ? cached!.token : '',
          cached?.username || username,
          mode === 'refresh' || !useCache,
        );

        if (!next.username || next.username === t('friendCard.memberFallback')) {
          next.username = username;
          await cacheFriendInvite(next);
        }

        setInvite(next);
      } catch (e) {
        const cached = inviteRef.current ?? (await loadCachedFriendInvite());
        if (cached && isFriendInviteValid(cached.expiresAt)) {
          setInvite(cached);
          setError(t('friendCard.offlineHint'));
        } else {
          setInvite(null);
          setError((e as Error).message || t('friendCard.loadError'));
        }
      } finally {
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [buildInvite, isLoaded, t],
  );

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function bootstrap() {
      const cached = await loadCachedFriendInvite();
      if (cancelled) return;

      if (cached && isFriendInviteValid(cached.expiresAt)) {
        setInvite(cached);
        inviteRef.current = cached;
        setInitializing(false);
        return;
      }

      await syncInvite('initial');
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, syncInvite]);

  const handleRefresh = useCallback(() => {
    void syncInvite(inviteRef.current ? 'refresh' : 'initial');
  }, [syncInvite]);

  const shareLink = useCallback(async () => {
    if (!invite) return;
    const url = buildFriendInviteDeepLink(invite.token);
    await Share.share({
      message: t('friends.shareFriendInviteMessage', { url, raw: invite.token }),
      title: 'Cafe Social',
    });
  }, [invite, t]);

  const showInitialSpinner = initializing && !invite;
  const expired = invite ? !isFriendInviteValid(invite.expiresAt) : false;

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
          <Text style={styles.title}>{t('friendCard.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('friendCard.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('friendCard.lead')}</Text>

        {error ? <Text style={styles.warnBanner}>{error}</Text> : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t('friendCard.loading')}</Text>
          </View>
        ) : invite ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradientFill from={colors.primaryDark} to={colors.primary} />
              <View style={styles.cardHeaderContent}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="person-add" size={22} color={colors.textInverse} />
                </View>
                <Text style={styles.cardHeaderTitle}>{t('friendCard.scanToAdd')}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{memberInitial(invite.username)}</Text>
                </View>
                <View style={styles.memberMeta}>
                  <Text style={styles.memberLabel}>{t('friendCard.addLabel')}</Text>
                  <Text style={styles.username} numberOfLines={1}>
                    {invite.username}
                  </Text>
                </View>
              </View>

              <View style={styles.qrWrap}>
                <FriendQrCode
                  payload={invite.qrPayload}
                  foreground={colors.primaryDark}
                  background={colors.surface}
                />
              </View>

              <Text style={styles.expiryText}>
                {expired
                  ? t('friendCard.expired')
                  : t('friendCard.validUntil', {
                      date: formatExpiry(invite.expiresAt, i18n.language),
                    })}
              </Text>
              <Text style={styles.scanHint}>{t('friendCard.scanHint')}</Text>

              <Pressable
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
                onPress={() => void shareLink()}
              >
                <Ionicons name="share-outline" size={18} color={colors.primary} />
                <Text style={styles.shareBtnText}>{t('friendCard.shareLink')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <Ionicons name="qr-code-outline" size={40} color={colors.textMuted} />
            <Text style={styles.errorText}>{error ?? t('friendCard.loadError')}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              onPress={handleRefresh}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {invite ? (
          <View style={styles.tipsCard}>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="scan-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.tipText}>{t('friendCard.tipScan')}</Text>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.tipText}>{t('friendCard.tipExpiry')}</Text>
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
    warnBanner: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.md,
    },
    loadingText: { color: colors.textMuted, fontSize: 14 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      overflow: 'hidden',
      marginBottom: spacing.lg,
    },
    cardHeader: { height: 72, overflow: 'hidden' },
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
      gap: spacing.md,
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
      backgroundColor: colors.accentPink,
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
    expiryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    scanHint: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
    },
    shareBtnText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
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
    retryBtnText: { color: colors.primaryDark, fontWeight: '800' },
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
