import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import WordGameHeader from '../components/word/WordGameHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { triggerFeedback } from '../lib/feedback';
import { redeemFriendInvite } from '../lib/redeemFriendInvite';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemInvite'>;

function parseTokenFromUrl(url: string): string | null {
  try {
    const normalized = url.replace(/^cafesocial:\/\//, 'https://x/');
    const u = new URL(normalized);
    return u.searchParams.get('token');
  } catch {
    return null;
  }
}

export default function RedeemInviteScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [token, setToken] = useState(route.params?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.token) setToken(route.params.token);
  }, [route.params?.token]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const q = parseTokenFromUrl(url);
      if (q) {
        setError(null);
        setToken(q);
      }
    });
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      const q = parseTokenFromUrl(url);
      if (q) {
        setError(null);
        setToken(q);
      }
    });
    return () => sub.remove();
  }, []);

  const onRedeem = async () => {
    setError(null);
    const raw = token.trim();
    if (!raw) {
      setError(t('redeem.pasteToken'));
      return;
    }
    if (!isLoaded) return;
    const jwt = await getTokenRef.current();
    if (!jwt) {
      setError(t('redeem.signInFirst'));
      return;
    }

    setBusy(true);
    try {
      const res = await redeemFriendInvite(jwt, raw);
      if (res.kind === 'PARTY' && res.partyId) {
        triggerFeedback('lobbyJoined');
        navigation.replace('PartyDetail', { partyId: res.partyId });
        return;
      }
      triggerFeedback('correct');
      navigation.navigate('MainTabs', { screen: 'FriendsTab' });
    } catch (e) {
      setError((e as Error).message || t('redeem.redeemFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <WordGameHeader
        colors={colors}
        title={t('redeem.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="link-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('redeem.heroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('redeem.heroTitle')}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <Ionicons name="people-outline" size={16} color={colors.primary} />
            <Text style={styles.infoChipText}>{t('redeem.partyInfo')}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={styles.infoChipText}>{t('redeem.friendInfo')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAccent} />
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="ticket-outline" size={20} color={colors.textInverse} />
            </View>
            <Text style={styles.cardTitle}>{t('redeem.cardTitle')}</Text>
          </View>

          <Text style={styles.inputLabel}>{t('redeem.inputLabel')}</Text>
          <TextInput
            value={token}
            onChangeText={(v) => {
              setError(null);
              setToken(v);
            }}
            placeholder={t('redeem.tokenPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
            style={[styles.input, error ? styles.inputError : null]}
            editable={!busy}
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.inputHint}>{t('redeem.inputHint')}</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (busy || !token.trim()) && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          disabled={busy || !token.trim()}
          onPress={() => void onRedeem()}
          accessibilityRole="button"
          accessibilityLabel={t('redeem.submit')}
        >
          {busy ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{t('redeem.submit')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
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
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.md,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    infoRow: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    infoChipText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    inputLabel: {
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    input: {
      marginTop: spacing.xs,
      minHeight: 96,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.errorMuted,
    },
    inputHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
    },
    errorText: {
      flex: 1,
      color: colors.error,
      fontWeight: '700',
      fontSize: 13,
      lineHeight: 18,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 16,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.88 },
  });
}
