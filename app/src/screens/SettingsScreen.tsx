import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth, useClerk } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesError } from 'react-native-purchases';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { LANGUAGE_OPTIONS, type AppLanguage, setAppLanguage } from '../i18n';
import { apiGet, apiPatch } from '../lib/api';
import { setBackgroundApiToken } from '../lib/backgroundApiToken';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../lib/legalUrls';
import {
  getPreferredPackageOrder,
  isRevenueCatNativeConfigured,
  pickPrimaryPackage,
} from '../lib/revenuecat';
import { SUBSCRIPTION_MANAGE_URL } from '../lib/subscriptionUrl';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type MeSummary = {
  discoverable: boolean;
  totalPrivacy: boolean;
  partnerMarketingPush: boolean;
  matchActivityPush: boolean;
  subscriptionActive?: boolean;
};

export default function SettingsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { signOut } = useClerk();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [busy, setBusy] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);
  const [totalPrivacy, setTotalPrivacy] = useState(false);
  const [partnerMarketingPush, setPartnerMarketingPush] = useState(true);
  const [matchActivityPush, setMatchActivityPush] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [friendLinkBusy, setFriendLinkBusy] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [rcBusy, setRcBusy] = useState(false);
  const [subscriptionPendingSync, setSubscriptionPendingSync] = useState(false);
  const [subscriptionPendingFollowUp, setSubscriptionPendingFollowUp] = useState(false);
  const [offeringsIssue, setOfferingsIssue] = useState<'none' | 'no_current' | 'no_packages'>('none');
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const rcNative = isRevenueCatNativeConfigured();
  const packageOrder = getPreferredPackageOrder();

  const refreshSubscriptionOnly = useCallback(
    async (silent: boolean): Promise<boolean> => {
      if (!isLoaded) return false;
      try {
        const token = await getTokenRef.current();
        if (!token) return false;
        const s = await apiGet<MeSummary>('/players/me/summary', token);
        const active = s.subscriptionActive ?? false;
        setSubscriptionActive(active);
        return active;
      } catch {
        if (!silent) Alert.alert(t('common.error'), t('settings.privacyLoadError'));
        return false;
      }
    },
    [isLoaded, t],
  );

  const loadPrivacy = useCallback(async (): Promise<boolean> => {
    if (!isLoaded) return false;
    setPrivacyLoading(true);
    let active = false;
    try {
      const token = await getTokenRef.current();
      if (!token) return false;
      const s = await apiGet<MeSummary>('/players/me/summary', token);
      setDiscoverable(s.discoverable);
      setTotalPrivacy(s.totalPrivacy);
      setPartnerMarketingPush(s.partnerMarketingPush ?? true);
      setMatchActivityPush(s.matchActivityPush ?? true);
      active = s.subscriptionActive ?? false;
      setSubscriptionActive(active);
    } catch {
      Alert.alert(t('common.error'), t('settings.privacyLoadError'));
    } finally {
      setPrivacyLoading(false);
    }
    return active;
  }, [isLoaded, t]);

  useEffect(() => {
    if (subscriptionActive) {
      setSubscriptionPendingSync(false);
      setSubscriptionPendingFollowUp(false);
    }
  }, [subscriptionActive]);

  useEffect(() => {
    if (!subscriptionPendingSync) return;
    let cancelled = false;
    const run = async () => {
      for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
        const active = await refreshSubscriptionOnly(true);
        if (cancelled) return;
        if (active) {
          setSubscriptionPendingSync(false);
          setSubscriptionPendingFollowUp(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        setSubscriptionPendingSync(false);
        setSubscriptionPendingFollowUp(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [subscriptionPendingSync, refreshSubscriptionOnly]);

  useFocusEffect(
    useCallback(() => {
      void loadPrivacy();
    }, [loadPrivacy]),
  );

  const persistPrivacy = async (patch: Partial<MeSummary>) => {
    const token = await getTokenRef.current();
    if (!token) return;
    setPrivacySaving(true);
    try {
      await apiPatch('/players/me/settings', patch, token);
    } catch {
      Alert.alert(t('common.error'), t('settings.privacyLoadError'));
      await loadPrivacy();
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleLanguage = async (code: AppLanguage) => {
    try {
      await setAppLanguage(code);
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    }
  };

  const openRevenueCatSubscribe = async () => {
    if (!isLoaded || Platform.OS === 'web' || !rcNative) return;
    setRcBusy(true);
    setOfferingsIssue('none');
    try {
      const offerings = await Purchases.getOfferings();
      if (!offerings.current) {
        setOfferingsIssue('no_current');
        return;
      }
      const pkgs = offerings.current.availablePackages ?? [];
      if (pkgs.length === 0) {
        setOfferingsIssue('no_packages');
        return;
      }
      const pkg = pickPrimaryPackage(pkgs, packageOrder);
      if (!pkg) {
        setOfferingsIssue('no_packages');
        return;
      }
      await Purchases.purchasePackage(pkg);
      setOfferingsIssue('none');
      const active = await loadPrivacy();
      if (active) {
        Alert.alert(t('settings.subscription'), t('settings.subscriptionPurchaseImmediate'));
      } else {
        setSubscriptionPendingFollowUp(false);
        setSubscriptionPendingSync(true);
      }
    } catch (e) {
      const pe = e as PurchasesError;
      if (pe.userCancelled || pe.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return;
      Alert.alert(t('common.error'), pe.message || t('settings.subscriptionPurchaseError'));
    } finally {
      setRcBusy(false);
    }
  };

  const restoreRevenueCat = async () => {
    if (!isLoaded || Platform.OS === 'web' || !rcNative) return;
    setRcBusy(true);
    try {
      await Purchases.restorePurchases();
      setOfferingsIssue('none');
      const active = await loadPrivacy();
      if (active) {
        Alert.alert(t('settings.subscription'), t('settings.subscriptionRestoreActive'));
      } else {
        setSubscriptionPendingFollowUp(false);
        setSubscriptionPendingSync(true);
      }
    } catch (e) {
      const pe = e as PurchasesError;
      Alert.alert(t('common.error'), pe.message || t('common.retry'));
    } finally {
      setRcBusy(false);
    }
  };

  const refreshSubscriptionStatus = async () => {
    if (!isLoaded || privacyLoading) return;
    setSubscriptionPendingFollowUp(false);
    const active = await loadPrivacy();
    if (!active && rcNative && Platform.OS !== 'web') {
      setSubscriptionPendingSync(true);
    }
  };

  const openStoreSubscriptions = async () => {
    if (!isLoaded || Platform.OS === 'web' || !rcNative) return;
    setRcBusy(true);
    try {
      await Purchases.showManageSubscriptions();
    } catch {
      Alert.alert(t('common.error'), t('settings.subscriptionManageNativeError'));
    } finally {
      setRcBusy(false);
    }
  };

  const shareFriendLink = async () => {
    setFriendLinkBusy(true);
    try {
      const token = await getTokenRef.current();
      await createAndShareFriendInviteLink(token, t);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('friends.friendLinkFailed'));
    } finally {
      setFriendLinkBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('settings.title')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
        <Text style={styles.hint}>{t('settings.languageHint')}</Text>
        <View style={styles.langList}>
          {LANGUAGE_OPTIONS.map(({ code, nativeName }) => {
            const active = i18n.language === code;
            return (
              <Pressable
                key={code}
                onPress={() => void handleLanguage(code)}
                style={({ pressed }) => [
                  styles.langRow,
                  active && styles.langRowActive,
                  pressed && styles.langRowPressed,
                ]}
              >
                <Text style={styles.langName}>{nativeName}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.privacy')}</Text>
        <Text style={styles.hint}>{t('settings.privacyHint')}</Text>
        {privacyLoading ? (
          <View style={styles.privacyLoading}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : (
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('settings.discoverable')}</Text>
              <Switch
                value={discoverable}
                disabled={privacySaving || totalPrivacy}
                onValueChange={(v) => {
                  setDiscoverable(v);
                  void persistPrivacy({ discoverable: v });
                }}
                trackColor={{ true: '#6d28d9', false: '#374151' }}
                thumbColor="#f4f4f5"
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleRowBorder]}>
              <Text style={styles.toggleLabel}>{t('settings.totalPrivacy')}</Text>
              <Switch
                value={totalPrivacy}
                disabled={privacySaving}
                onValueChange={(v) => {
                  setTotalPrivacy(v);
                  void persistPrivacy({ totalPrivacy: v });
                }}
                trackColor={{ true: '#7f1d1d', false: '#374151' }}
                thumbColor="#f4f4f5"
              />
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.location')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('settings.locationHint')}</Text>
          <Text style={[styles.cardText, { marginTop: 12, color: '#9ca3af' }]}>
            {t('settings.locationGeofenceHint')}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.notifications')}</Text>
        <Text style={styles.hint}>{t('settings.notificationsHint')}</Text>
        {privacyLoading ? (
          <View style={styles.privacyLoading}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : (
          <View style={styles.toggleCard}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('settings.pushMatchActivity')}</Text>
              <Switch
                value={matchActivityPush}
                disabled={privacySaving}
                onValueChange={(v) => {
                  setMatchActivityPush(v);
                  void persistPrivacy({ matchActivityPush: v });
                }}
                trackColor={{ true: '#6d28d9', false: '#374151' }}
                thumbColor="#f4f4f5"
              />
            </View>
            <View style={[styles.toggleRow, styles.toggleRowBorder]}>
              <Text style={styles.toggleLabel}>{t('settings.pushPartnerMarketing')}</Text>
              <Switch
                value={partnerMarketingPush}
                disabled={privacySaving}
                onValueChange={(v) => {
                  setPartnerMarketingPush(v);
                  void persistPrivacy({ partnerMarketingPush: v });
                }}
                trackColor={{ true: '#6d28d9', false: '#374151' }}
                thumbColor="#f4f4f5"
              />
            </View>
            <Text style={styles.pushFootnote}>{t('settings.pushPartnerFootnote')}</Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.legalTitle')}</Text>
        <Text style={styles.hint}>{t('settings.legalHint')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('settings.legalDataSummary')}</Text>
          {PRIVACY_POLICY_URL ? (
            <Pressable
              style={({ pressed }) => [styles.linkRow, pressed && styles.actionRowPressed]}
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            >
              <Text style={styles.linkText}>{t('settings.privacyPolicyLink')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.cardTextMuted}>{t('settings.legalUrlMissing')}</Text>
          )}
          {TERMS_OF_SERVICE_URL ? (
            <Pressable
              style={({ pressed }) => [styles.linkRow, pressed && styles.actionRowPressed]}
              onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
            >
              <Text style={styles.linkText}>{t('settings.termsLink')}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.subscription')}</Text>
        <Text style={styles.hint}>{t('settings.subscriptionHint')}</Text>
        {(rcNative && Platform.OS !== 'web') || SUBSCRIPTION_MANAGE_URL ? (
          <Text style={styles.paywallLead}>{t('settings.subscriptionPaywallLead')}</Text>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {privacyLoading
              ? '…'
              : subscriptionActive
                ? t('settings.subscriptionActive')
                : t('settings.subscriptionInactive')}
          </Text>
          {subscriptionPendingSync ? (
            <View style={styles.pendingStrip}>
              <Text style={styles.pendingStripText}>{t('settings.subscriptionPendingBanner')}</Text>
            </View>
          ) : null}
          {subscriptionPendingFollowUp && !subscriptionActive ? (
            <View style={styles.followUpStrip}>
              <Text style={styles.followUpStripText}>{t('settings.subscriptionPendingFollowUp')}</Text>
              <Pressable
                disabled={privacyLoading}
                style={({ pressed }) => [styles.refreshStatusBtn, pressed && styles.actionRowPressed]}
                onPress={() => void refreshSubscriptionStatus()}
              >
                <Text style={styles.refreshStatusBtnText}>{t('settings.subscriptionPendingRefresh')}</Text>
              </Pressable>
            </View>
          ) : null}
          {Platform.OS !== 'web' && rcNative && offeringsIssue !== 'none' ? (
            <View style={styles.offeringsIssueStrip}>
              <Text style={styles.offeringsIssueTitle}>{t('settings.subscriptionOfferingsTitle')}</Text>
              <Text style={styles.offeringsIssueBody}>
                {offeringsIssue === 'no_current'
                  ? t('settings.subscriptionOfferingsNoCurrent')
                  : t('settings.subscriptionOfferingsNoPackages')}
              </Text>
            </View>
          ) : null}
          {Platform.OS !== 'web' && rcNative ? (
            <Text style={styles.packageHint}>
              {packageOrder === 'annual_first'
                ? t('settings.subscriptionPackageHintAnnualFirst')
                : t('settings.subscriptionPackageHintMonthlyFirst')}
            </Text>
          ) : null}
          {Platform.OS !== 'web' && rcNative ? (
            <>
              {!subscriptionActive ? (
                <Pressable
                  disabled={rcBusy || privacyLoading}
                  style={({ pressed }) => [
                    styles.linkRow,
                    pressed && styles.actionRowPressed,
                    (rcBusy || privacyLoading) && styles.actionRowDisabled,
                  ]}
                  onPress={() => void openRevenueCatSubscribe()}
                >
                  <Text style={styles.linkText}>
                    {rcBusy ? '…' : t('settings.subscriptionSubscribe')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={rcBusy || privacyLoading}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && styles.actionRowPressed,
                  (rcBusy || privacyLoading) && styles.actionRowDisabled,
                ]}
                onPress={() => void restoreRevenueCat()}
              >
                <Text style={styles.linkText}>{t('settings.subscriptionRestore')}</Text>
              </Pressable>
              <Pressable
                disabled={rcBusy || privacyLoading}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && styles.actionRowPressed,
                  (rcBusy || privacyLoading) && styles.actionRowDisabled,
                ]}
                onPress={() => void openStoreSubscriptions()}
              >
                <Text style={styles.linkText}>{t('settings.subscriptionManageNative')}</Text>
              </Pressable>
            </>
          ) : Platform.OS !== 'web' ? (
            <Text style={styles.cardTextMuted}>{t('settings.subscriptionRcMissingKey')}</Text>
          ) : (
            <Text style={styles.cardTextMuted}>{t('settings.subscriptionWebOnlyHint')}</Text>
          )}
          {SUBSCRIPTION_MANAGE_URL ? (
            <Pressable
              style={({ pressed }) => [styles.linkRow, pressed && styles.actionRowPressed]}
              onPress={() => void Linking.openURL(SUBSCRIPTION_MANAGE_URL)}
            >
              <Text style={styles.linkText}>{t('settings.subscriptionOpen')}</Text>
            </Pressable>
          ) : null}
          {!SUBSCRIPTION_MANAGE_URL && Platform.OS === 'web' ? (
            <Text style={styles.cardTextMuted}>{t('settings.subscriptionUrlMissing')}</Text>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('settings.accountHint')}</Text>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.staffTitle')}</Text>
        <Text style={styles.hint}>{t('settings.staffHint')}</Text>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          onPress={() => navigation.navigate('StaffVenues')}
        >
          <Text style={styles.actionRowText}>{t('settings.staffOpen')}</Text>
          <Text style={styles.actionRowChev}>›</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.social')}</Text>
        <Text style={styles.hint}>{t('settings.friendInviteHint')}</Text>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          onPress={() => navigation.navigate('Friends')}
        >
          <Text style={styles.actionRowText}>{t('settings.openFriends')}</Text>
          <Text style={styles.actionRowChev}>›</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
          onPress={() => navigation.navigate('MyVenueReports')}
        >
          <Text style={styles.actionRowText}>{t('settings.openMyVenueReports')}</Text>
          <Text style={styles.actionRowChev}>›</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionRow,
            pressed && styles.actionRowPressed,
            friendLinkBusy && styles.actionRowDisabled,
          ]}
          onPress={() => void shareFriendLink()}
          disabled={friendLinkBusy}
        >
          <Text style={styles.actionRowText}>
            {friendLinkBusy ? '…' : t('settings.friendInviteLink')}
          </Text>
          <Text style={styles.actionRowChev}>›</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.about')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTextMuted}>{t('settings.version', { version: appVersion })}</Text>
          <Text style={[styles.cardText, { marginTop: 10 }]}>Cafe Social — venue-locked games.</Text>
        </View>

        <Pressable
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await setBackgroundApiToken(null);
              await signOut();
              navigation.replace('Login');
            } finally {
              setBusy(false);
            }
          }}
          style={[styles.logoutBtn, busy && styles.logoutBtnDisabled]}
          disabled={busy}
        >
          <Text style={styles.logoutText}>{busy ? t('settings.signingOut') : t('settings.signOut')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 16 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 8 },
  sectionSpacer: { marginTop: 22 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  langList: { marginTop: 12, gap: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langRowActive: { borderColor: colors.honey, backgroundColor: colors.surface },
  langRowPressed: { opacity: 0.92 },
  langName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  check: { color: colors.honey, fontWeight: '900', fontSize: 18 },
  privacyLoading: { marginTop: 16, alignItems: 'center' },
  toggleCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  toggleLabel: { color: colors.textSecondary, fontWeight: '700', fontSize: 15, flex: 1, paddingRight: 12 },
  pushFootnote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  card: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  cardTextMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    marginTop: 28,
    backgroundColor: colors.surface,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { color: colors.error, fontWeight: '800' },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionRowPressed: { opacity: 0.9 },
  actionRowDisabled: { opacity: 0.55 },
  actionRowText: { color: colors.textSecondary, fontWeight: '800', fontSize: 15 },
  actionRowChev: { color: colors.textMuted, fontSize: 20, fontWeight: '300' },
  linkRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.honeyMuted,
  },
  linkText: { color: colors.honeyDark, fontWeight: '800', fontSize: 14 },
  paywallLead: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  pendingStrip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pendingStripText: { color: colors.honeyDark, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  followUpStrip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followUpStripText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  refreshStatusBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  refreshStatusBtnText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  offeringsIssueStrip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.honeyMuted,
    borderWidth: 1,
    borderColor: colors.honey,
  },
  offeringsIssueTitle: { color: colors.honeyDark, fontWeight: '900', fontSize: 13, marginBottom: 6 },
  offeringsIssueBody: { color: colors.honey, fontSize: 12, lineHeight: 17 },
  packageHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10, fontStyle: 'italic' },

    });
}
