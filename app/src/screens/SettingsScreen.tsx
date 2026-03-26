import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth, useClerk } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { LANGUAGE_OPTIONS, type AppLanguage, setAppLanguage } from '../i18n';
import { apiGet, apiPatch } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../lib/legalUrls';
import { SUBSCRIPTION_MANAGE_URL } from '../lib/subscriptionUrl';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type MeSummary = {
  discoverable: boolean;
  totalPrivacy: boolean;
  partnerMarketingPush: boolean;
  matchActivityPush: boolean;
  subscriptionActive?: boolean;
};

export default function SettingsScreen({ navigation }: Props) {
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
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';

  const loadPrivacy = useCallback(async () => {
    if (!isLoaded) return;
    setPrivacyLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const s = await apiGet<MeSummary>('/players/me/summary', token);
      setDiscoverable(s.discoverable);
      setTotalPrivacy(s.totalPrivacy);
      setPartnerMarketingPush(s.partnerMarketingPush ?? true);
      setMatchActivityPush(s.matchActivityPush ?? true);
      setSubscriptionActive(s.subscriptionActive ?? false);
    } catch {
      Alert.alert(t('common.error'), t('settings.privacyLoadError'));
    } finally {
      setPrivacyLoading(false);
    }
  }, [isLoaded, t]);

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
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {privacyLoading
              ? '…'
              : subscriptionActive
                ? t('settings.subscriptionActive')
                : t('settings.subscriptionInactive')}
          </Text>
          {SUBSCRIPTION_MANAGE_URL ? (
            <Pressable
              style={({ pressed }) => [styles.linkRow, pressed && styles.actionRowPressed]}
              onPress={() => void Linking.openURL(SUBSCRIPTION_MANAGE_URL)}
            >
              <Text style={styles.linkText}>{t('settings.subscriptionOpen')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.cardTextMuted}>{t('settings.subscriptionUrlMissing')}</Text>
          )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, paddingTop: 16 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#111827' },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sectionLabel: { color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 8 },
  sectionSpacer: { marginTop: 22 },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 6, lineHeight: 18 },
  langList: { marginTop: 12, gap: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langRowActive: { borderColor: '#a78bfa', backgroundColor: '#0b1220' },
  langRowPressed: { opacity: 0.92 },
  langName: { color: '#f9fafb', fontWeight: '700', fontSize: 16 },
  check: { color: '#a78bfa', fontWeight: '900', fontSize: 18 },
  privacyLoading: { marginTop: 16, alignItems: 'center' },
  toggleCard: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleRowBorder: { borderTopWidth: 1, borderTopColor: '#1f2937' },
  toggleLabel: { color: '#e5e7eb', fontWeight: '700', fontSize: 15, flex: 1, paddingRight: 12 },
  pushFootnote: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  card: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
  },
  cardText: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  cardTextMuted: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    marginTop: 28,
    backgroundColor: '#111827',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { color: '#fca5a5', fontWeight: '800' },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionRowPressed: { opacity: 0.9 },
  actionRowDisabled: { opacity: 0.55 },
  actionRowText: { color: '#e5e7eb', fontWeight: '800', fontSize: 15 },
  actionRowChev: { color: '#6b7280', fontSize: 20, fontWeight: '300' },
  linkRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  linkText: { color: '#a5b4fc', fontWeight: '800', fontSize: 14 },
});
