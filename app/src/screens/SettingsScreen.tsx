import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth, useClerk } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
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
import SettingsNavRow from '../components/settings/SettingsNavRow';
import ScreenHeader from '../components/ScreenHeader';
import type { RootStackParamList } from '../navigation/type';
import { LANGUAGE_OPTIONS, type AppLanguage, setAppLanguage } from '../i18n';
import { useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { invalidateMeSummary, useMeSummaryQuery } from '../query';
import {
  getFeedbackPrefs,
  loadFeedbackPrefs,
  setBackgroundMusicEnabled as persistBackgroundMusicEnabled,
  setHapticsEnabled as persistHapticsEnabled,
  setSoundEffectsEnabled as persistSoundEffectsEnabled,
  syncBackgroundMusicForRoute,
  triggerFeedbackPreview,
} from '../lib/feedback';
import { navigationRef } from '../navigation/navigationRef';
import { getActiveRouteName } from '../navigation/getActiveRouteName';
import { revokeBackgroundApiToken } from '../lib/backgroundTokenSync';
import { unregisterExpoPushTokenFromBackend } from '../lib/expoPush';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import { fetchOwnerVenues } from '../lib/ownerStaffApi';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../lib/legalUrls';
import {
  getPreferredPackageOrder,
  isRevenueCatNativeConfigured,
  pickPrimaryPackage,
  signOutRevenueCat,
} from '../lib/revenuecat';
import { getVenuePlayBudgetIapCatalog } from '../lib/venuePlayBudgetCatalog';
import { promptVenuePlayTimePurchaseDialog } from '../lib/venuePlayBudgetPurchaseUi';
import { SUBSCRIPTION_MANAGE_URL } from '../lib/subscriptionUrl';
import {
  getLocationPermissionSummary,
  openAppSettings,
  promptOpenSettingsForAlways,
  requestAlwaysLocationPermissions,
  type LocationPermissionSummary,
} from '../lib/locationPermissions';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type MeSummary = {
  discoverable: boolean;
  totalPrivacy: boolean;
  partnerMarketingPush: boolean;
  matchActivityPush: boolean;
  emailNotifications: boolean;
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
  const queryClient = useQueryClient();
  const meQuery = useMeSummaryQuery({ refetchOnScreenFocus: false });
  const [busy, setBusy] = useState(false);
  const privacyPending = !meQuery.data && meQuery.isPending;
  const [discoverable, setDiscoverable] = useState(true);
  const [totalPrivacy, setTotalPrivacy] = useState(false);
  const [partnerMarketingPush, setPartnerMarketingPush] = useState(true);
  const [matchActivityPush, setMatchActivityPush] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [friendLinkBusy, setFriendLinkBusy] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [rcBusy, setRcBusy] = useState(false);
  const [subscriptionPendingSync, setSubscriptionPendingSync] = useState(false);
  const [subscriptionPendingFollowUp, setSubscriptionPendingFollowUp] = useState(false);
  const [offeringsIssue, setOfferingsIssue] = useState<'none' | 'no_current' | 'no_packages'>('none');
  const [locationPerms, setLocationPerms] = useState<LocationPermissionSummary | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(
    () => getFeedbackPrefs().soundEffectsEnabled,
  );
  const [hapticsEnabled, setHapticsEnabledState] = useState(
    () => getFeedbackPrefs().hapticsEnabled,
  );
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(
    () => getFeedbackPrefs().backgroundMusicEnabled,
  );
  const [hasStaffVenues, setHasStaffVenues] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';
  const rcNative = isRevenueCatNativeConfigured();
  const packageOrder = getPreferredPackageOrder();
  const switchTrackOn = colors.primary;
  const switchTrackOff = colors.borderStrong;
  const switchThumb = colors.surface;

  const applyMeSummary = useCallback((s: MeSummaryDto) => {
    const nextDiscoverable = s.discoverable ?? true;
    const nextTotalPrivacy = s.totalPrivacy ?? false;
    const nextPartnerMarketingPush = s.partnerMarketingPush ?? true;
    const nextMatchActivityPush = s.matchActivityPush ?? true;
    const nextEmailNotifications = s.emailNotifications ?? true;
    const nextSubscriptionActive = s.subscriptionActive ?? false;
    setDiscoverable((prev) => (prev === nextDiscoverable ? prev : nextDiscoverable));
    setTotalPrivacy((prev) => (prev === nextTotalPrivacy ? prev : nextTotalPrivacy));
    setPartnerMarketingPush((prev) =>
      prev === nextPartnerMarketingPush ? prev : nextPartnerMarketingPush,
    );
    setMatchActivityPush((prev) => (prev === nextMatchActivityPush ? prev : nextMatchActivityPush));
    setEmailNotifications((prev) =>
      prev === nextEmailNotifications ? prev : nextEmailNotifications,
    );
    setSubscriptionActive((prev) =>
      prev === nextSubscriptionActive ? prev : nextSubscriptionActive,
    );
  }, []);

  useEffect(() => {
    if (meQuery.data) {
      applyMeSummary(meQuery.data);
    }
  }, [meQuery.data, applyMeSummary]);

  useEffect(() => {
    void loadFeedbackPrefs();
  }, []);

  const refreshSubscriptionOnly = useCallback(
    async (silent: boolean): Promise<boolean> => {
      if (!isLoaded) return false;
      try {
        const result = await meQuery.refetch();
        const active = result.data?.subscriptionActive ?? false;
        setSubscriptionActive(active);
        return active;
      } catch {
        if (!silent) Alert.alert(t('common.error'), t('settings.privacyLoadError'));
        return false;
      }
    },
    [isLoaded, meQuery, t],
  );

  const loadPrivacy = useCallback(async (): Promise<boolean> => {
    if (!isLoaded) return false;
    let active = false;
    try {
      const result = await meQuery.refetch();
      const s = result.data;
      if (!s) return false;
      applyMeSummary(s);
      active = s.subscriptionActive ?? false;
    } catch {
      Alert.alert(t('common.error'), t('settings.privacyLoadError'));
    }
    return active;
  }, [isLoaded, meQuery, applyMeSummary, t]);

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

  const refreshLocationPerms = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setLocationPerms(await getLocationPermissionSummary());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void meQuery.refetch();
      void refreshLocationPerms();
      void (async () => {
        if (!isLoaded) return;
        try {
          const token = await getTokenRef.current();
          if (!token) {
            setHasStaffVenues(false);
            return;
          }
          const data = await fetchOwnerVenues(token);
          setHasStaffVenues(data.venues.length > 0);
        } catch {
          setHasStaffVenues(false);
        }
      })();
    }, [isLoaded, meQuery, refreshLocationPerms]),
  );

  const locationStatusKey = (() => {
    if (!locationPerms) return null;
    if (locationPerms.hasAlways) return 'settings.locationStatusAlways';
    if (locationPerms.hasWhenInUse) return 'settings.locationStatusWhenInUse';
    if (locationPerms.foreground === Location.PermissionStatus.DENIED) {
      return 'settings.locationStatusDenied';
    }
    return 'settings.locationStatusNotDetermined';
  })();

  const onRequestAlwaysLocation = async () => {
    if (Platform.OS === 'web') return;
    setLocationBusy(true);
    try {
      const perms = await requestAlwaysLocationPermissions();
      await refreshLocationPerms();
      if (perms.foregroundGranted && !perms.backgroundGranted) {
        promptOpenSettingsForAlways(
          t('settings.locationAlwaysNeededTitle'),
          t('settings.locationAlwaysNeededBody'),
          t('settings.locationOpenSettings'),
          t('common.cancel'),
        );
      }
    } finally {
      setLocationBusy(false);
    }
  };

  const persistPrivacy = async (patch: Partial<MeSummary>) => {
    const token = await getTokenRef.current();
    if (!token) return;
    setPrivacySaving(true);
    try {
      await apiPatch('/players/me/settings', patch, token);
      await invalidateMeSummary(queryClient);
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
    if (!isLoaded || privacyPending) return;
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

  const deleteMyAccount = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        Alert.alert(t('common.error'), t('settings.deleteAccountError'));
        return;
      }
      await unregisterExpoPushTokenFromBackend(() => getTokenRef.current());
      await revokeBackgroundApiToken(() => Promise.resolve(token));
      await apiDelete<{ ok: true }>('/players/me', token);
      await signOutRevenueCat();
      try {
        await signOut();
      } catch {
        // Clerk session may already be invalid after server-side user delete.
      }
      navigation.replace('Login');
    } catch (e) {
      Alert.alert(
        t('common.error'),
        (e as Error).message?.trim() || t('settings.deleteAccountError'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
                <Text style={[styles.langName, active && styles.langNameActive]}>{nativeName}</Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.privacy')}</Text>
        <Text style={styles.hint}>{t('settings.privacyHint')}</Text>
        <View style={styles.toggleCard}>
          {privacyPending ? (
            <View style={styles.toggleRowLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('settings.discoverable')}</Text>
            <Switch
              value={discoverable}
              disabled={privacyPending || privacySaving || totalPrivacy}
              onValueChange={(v) => {
                setDiscoverable(v);
                void persistPrivacy({ discoverable: v });
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <Text style={styles.toggleLabel}>{t('settings.totalPrivacy')}</Text>
            <Switch
              value={totalPrivacy}
              disabled={privacyPending || privacySaving}
              onValueChange={(v) => {
                setTotalPrivacy(v);
                void persistPrivacy({ totalPrivacy: v });
              }}
              trackColor={{ true: colors.error, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.location')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('settings.locationHint')}</Text>
          <Text style={styles.cardTextSecondary}>{t('settings.locationGeofenceHint')}</Text>
          {Platform.OS !== 'web' && locationStatusKey ? (
            <Text style={styles.locationStatus}>{t(locationStatusKey)}</Text>
          ) : null}
          {Platform.OS !== 'web' && locationPerms && !locationPerms.hasAlways ? (
            <Pressable
              style={[styles.secondaryBtn, locationBusy && styles.btnDisabled]}
              disabled={locationBusy}
              onPress={() => void onRequestAlwaysLocation()}
            >
              {locationBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryBtnText}>{t('settings.locationEnableAlways')}</Text>
              )}
            </Pressable>
          ) : null}
          {Platform.OS !== 'web' ? (
            <Pressable style={styles.linkBtn} onPress={openAppSettings}>
              <Text style={styles.linkBtnText}>{t('settings.locationOpenSettings')}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.notifications')}</Text>
        <Text style={styles.hint}>{t('settings.notificationsHint')}</Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{t('settings.pushMatchActivity')}</Text>
            <Switch
              value={matchActivityPush}
              disabled={privacyPending || privacySaving}
              onValueChange={(v) => {
                setMatchActivityPush(v);
                void persistPrivacy({ matchActivityPush: v });
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <Text style={styles.toggleLabel}>{t('settings.pushPartnerMarketing')}</Text>
            <Switch
              value={partnerMarketingPush}
              disabled={privacyPending || privacySaving}
              onValueChange={(v) => {
                setPartnerMarketingPush(v);
                void persistPrivacy({ partnerMarketingPush: v });
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <Text style={styles.toggleLabel}>{t('settings.emailSocialActivity')}</Text>
            <Switch
              value={emailNotifications}
              disabled={privacyPending || privacySaving}
              onValueChange={(v) => {
                setEmailNotifications(v);
                void persistPrivacy({ emailNotifications: v });
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <Text style={styles.pushFootnote}>{t('settings.pushPartnerFootnote')}</Text>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.feedbackTitle')}</Text>
        <Text style={styles.hint}>{t('settings.feedbackHint')}</Text>
        <View style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelStack}>
              <Text style={styles.toggleLabel}>{t('settings.soundEffects')}</Text>
              <Text style={styles.toggleSub}>{t('settings.soundEffectsHint')}</Text>
            </View>
            <Switch
              value={soundEffectsEnabled}
              onValueChange={(v) => {
                setSoundEffectsEnabled(v);
                void persistSoundEffectsEnabled(v);
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View style={styles.toggleLabelStack}>
              <Text style={styles.toggleLabel}>{t('settings.haptics')}</Text>
              <Text style={styles.toggleSub}>{t('settings.hapticsHint')}</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(v) => {
                setHapticsEnabledState(v);
                void persistHapticsEnabled(v);
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          <View style={[styles.toggleRow, styles.toggleRowBorder]}>
            <View style={styles.toggleLabelStack}>
              <Text style={styles.toggleLabel}>{t('settings.backgroundMusic')}</Text>
              <Text style={styles.toggleSub}>{t('settings.backgroundMusicHint')}</Text>
            </View>
            <Switch
              value={backgroundMusicEnabled}
              onValueChange={(v) => {
                setBackgroundMusicEnabled(v);
                void persistBackgroundMusicEnabled(v);
                if (v) {
                  syncBackgroundMusicForRoute(
                    getActiveRouteName(navigationRef.getRootState()),
                  );
                }
              }}
              trackColor={{ true: switchTrackOn, false: switchTrackOff }}
              thumbColor={switchThumb}
            />
          </View>
          {Platform.OS !== 'web' ? (
            <Pressable
              style={({ pressed }) => [styles.feedbackTestBtn, pressed && styles.pressed]}
              onPress={() => triggerFeedbackPreview()}
            >
              <Text style={styles.feedbackTestBtnText}>{t('settings.testFeedback')}</Text>
            </Pressable>
          ) : null}
        </View>

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
            <Text style={styles.cardTextMuted}>{t('settings.privacyUrlMissing')}</Text>
          )}
          {TERMS_OF_SERVICE_URL ? (
            <Pressable
              style={({ pressed }) => [styles.linkRow, pressed && styles.actionRowPressed]}
              onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}
            >
              <Text style={styles.linkText}>{t('settings.termsLink')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.cardTextMuted}>{t('settings.termsUrlMissing')}</Text>
          )}
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.subscription')}</Text>
        <Text style={styles.hint}>{t('settings.subscriptionHint')}</Text>
        {!subscriptionActive ? (
          <View style={styles.card}>
            <Text style={styles.sectionInnerLabel}>{t('settings.subscriptionBenefitsTitle')}</Text>
            <Text style={styles.bulletText}>• {t('settings.subscriptionBenefitPlay')}</Text>
            <Text style={styles.bulletText}>• {t('settings.subscriptionBenefitParties')}</Text>
            <Text style={styles.bulletText}>• {t('settings.subscriptionBenefitGlobal')}</Text>
            <Text style={[styles.cardTextMuted, styles.bulletFootnote]}>
              {t('settings.subscriptionBenefitFootnote')}
            </Text>
          </View>
        ) : null}
        {(rcNative && Platform.OS !== 'web') || SUBSCRIPTION_MANAGE_URL ? (
          <Text style={styles.paywallLead}>{t('settings.subscriptionPaywallLead')}</Text>
        ) : null}
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {privacyPending
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
                disabled={privacyPending}
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
                  disabled={rcBusy || privacyPending}
                  style={({ pressed }) => [
                    styles.linkRow,
                    pressed && styles.actionRowPressed,
                    (rcBusy || privacyPending) && styles.actionRowDisabled,
                  ]}
                  onPress={() => void openRevenueCatSubscribe()}
                >
                  <Text style={styles.linkText}>
                    {rcBusy ? '…' : t('settings.subscriptionSubscribe')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={rcBusy || privacyPending}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && styles.actionRowPressed,
                  (rcBusy || privacyPending) && styles.actionRowDisabled,
                ]}
                onPress={() => void restoreRevenueCat()}
              >
                <Text style={styles.linkText}>{t('settings.subscriptionRestore')}</Text>
              </Pressable>
              <Pressable
                disabled={rcBusy || privacyPending}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && styles.actionRowPressed,
                  (rcBusy || privacyPending) && styles.actionRowDisabled,
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

        {Platform.OS !== 'web' &&
        rcNative &&
        getVenuePlayBudgetIapCatalog().length > 0 &&
        !subscriptionActive ? (
          <>
            <Text style={[styles.sectionLabel, styles.sectionSpacer]}>
              {t('settings.venuePlayBudgetSection')}
            </Text>
            <Text style={styles.hint}>{t('settings.venuePlayBudgetHint')}</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>{t('settings.venuePlayBudgetLead')}</Text>
              <Text style={styles.cardTextSecondary}>{t('settings.venuePlayBudgetFairPlay')}</Text>
              <Pressable
                disabled={rcBusy || privacyPending}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && styles.actionRowPressed,
                  (rcBusy || privacyPending) && styles.actionRowDisabled,
                ]}
                onPress={() =>
                  void promptVenuePlayTimePurchaseDialog({
                    t,
                    getToken: () => getTokenRef.current(),
                  })
                }
              >
                <Text style={styles.linkText}>{t('settings.venuePlayBudgetBuy')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('memberCard.title')}</Text>
        <Text style={styles.hint}>{t('settings.memberCardHint')}</Text>
        <View style={styles.navList}>
        <SettingsNavRow
          colors={colors}
          label={t('settings.openMemberCard')}
          onPress={() => navigation.navigate('MemberCard')}
        />
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.account')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>{t('settings.accountHint')}</Text>
          <Text style={[styles.cardTextMuted, styles.bulletFootnote]}>
            {t('settings.deleteAccountSubscriptionNote')}
          </Text>
          <Pressable
            disabled={busy}
            style={({ pressed }) => [
              styles.deleteAccountBtn,
              pressed && styles.actionRowPressed,
              busy && styles.actionRowDisabled,
            ]}
            onPress={() => {
              if (busy) return;
              Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountBody'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('settings.deleteAccountContinue'),
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      t('settings.deleteAccountConfirmTitle'),
                      t('settings.deleteAccountConfirmBody'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('settings.deleteAccountConfirmAction'),
                          style: 'destructive',
                          onPress: () => void deleteMyAccount(),
                        },
                      ],
                    );
                  },
                },
              ]);
            }}
          >
            <Text style={styles.deleteAccountBtnText}>
              {busy ? t('settings.deletingAccount') : t('settings.deleteAccount')}
            </Text>
          </Pressable>
        </View>

        {hasStaffVenues ? (
          <>
            <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.staffTitle')}</Text>
            <Text style={styles.hint}>{t('settings.staffHint')}</Text>
            <View style={styles.navList}>
              <SettingsNavRow
                colors={colors}
                label={t('settings.staffOpen')}
                onPress={() => navigation.navigate('StaffVenues')}
              />
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.social')}</Text>
        <Text style={styles.hint}>{t('settings.friendInviteHint')}</Text>
        <View style={styles.navList}>
        <SettingsNavRow
          colors={colors}
          label={t('settings.openFriends')}
          onPress={() => navigation.navigate('MainTabs', { screen: 'FriendsTab' })}
        />
        <SettingsNavRow
          colors={colors}
          label={t('settings.openMyVenueReports')}
          onPress={() => navigation.navigate('MyVenueReports')}
        />
        <SettingsNavRow
          colors={colors}
          label={friendLinkBusy ? '…' : t('settings.friendInviteLink')}
          onPress={() => void shareFriendLink()}
          disabled={friendLinkBusy}
        />
        </View>

        <Text style={[styles.sectionLabel, styles.sectionSpacer]}>{t('settings.about')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTextMuted}>{t('settings.version', { version: appVersion })}</Text>
          <Text style={[styles.cardText, styles.aboutTagline]}>Cafe Social — venue-locked games.</Text>
          <Text style={[styles.cardTextMuted, styles.aboutTagline]}>{t('settings.glossaryTitle')}</Text>
          <Text style={styles.cardTextMuted}>{t('settings.glossaryChallenges')}</Text>
          <Text style={styles.cardTextMuted}>{t('settings.glossaryPerks')}</Text>
          <Text style={styles.cardTextMuted}>{t('settings.glossaryOffers')}</Text>
          <Text style={styles.cardTextMuted}>{t('settings.glossaryPlatform')}</Text>
          <Text style={[styles.cardTextMuted, styles.aboutTagline]}>{t('settings.glossaryStaff')}</Text>
        </View>

        <Pressable
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await unregisterExpoPushTokenFromBackend(() => getTokenRef.current());
              await revokeBackgroundApiToken(() => getTokenRef.current());
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
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
      marginTop: spacing.xs,
    },
    sectionSpacer: { marginTop: spacing.xl },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    sectionInnerLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    langList: { marginTop: spacing.md, gap: spacing.sm },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    langRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    langRowPressed: { opacity: 0.92 },
    langName: { color: colors.text, fontWeight: '700', fontSize: 16 },
    langNameActive: { color: colors.primaryDark },
    toggleRowLoading: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    toggleCard: {
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    toggleRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    toggleLabel: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
      flex: 1,
      paddingRight: spacing.md,
    },
    toggleLabelStack: {
      flex: 1,
      paddingRight: spacing.md,
      gap: 2,
    },
    toggleSub: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
    },
    feedbackTestBtn: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      marginTop: spacing.xs,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
    },
    feedbackTestBtnText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    pushFootnote: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      paddingTop: spacing.xs,
    },
    card: {
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    cardText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    cardTextSecondary: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: spacing.md,
    },
    cardTextMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    locationStatus: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: spacing.md,
    },
    bulletText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    bulletFootnote: { marginTop: spacing.sm },
    aboutTagline: { marginTop: spacing.md },
    secondaryBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primaryMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(37, 97, 233, 0.25)',
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryBtnText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
    btnDisabled: { opacity: 0.6 },
    linkBtn: { marginTop: spacing.md, paddingVertical: spacing.sm },
    linkBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    navList: { marginTop: spacing.md, gap: spacing.sm },
    deleteAccountBtn: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    deleteAccountBtnText: { color: colors.error, fontWeight: '800', fontSize: 14 },
    logoutBtn: {
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderColor: colors.error,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radii.xl,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    logoutBtnDisabled: { opacity: 0.6 },
    logoutText: { color: colors.error, fontWeight: '800', fontSize: 15 },
    pressed: { opacity: 0.92 },
    actionRowPressed: { opacity: 0.92 },
    actionRowDisabled: { opacity: 0.55 },
    linkRow: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(37, 97, 233, 0.22)',
    },
    linkText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
    paywallLead: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: spacing.sm,
    },
    pendingStrip: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.warningBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
    },
    pendingStripText: {
      color: colors.honeyDark,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    followUpStrip: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    followUpStripText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    refreshStatusBtn: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: colors.primaryMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(37, 97, 233, 0.22)',
    },
    refreshStatusBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
    offeringsIssueStrip: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.honeyMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.honey,
    },
    offeringsIssueTitle: {
      color: colors.honeyDark,
      fontWeight: '900',
      fontSize: 13,
      marginBottom: spacing.sm,
    },
    offeringsIssueBody: { color: colors.honey, fontSize: 12, lineHeight: 17 },
    packageHint: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },
  });
}
