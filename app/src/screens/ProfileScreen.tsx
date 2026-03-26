import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import type { MeSummaryDto } from '../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../lib/onboardingStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type PerkRedemptionRow = {
  id: string;
  redeemedAt: string;
  perk: { title: string; subtitle: string | null; code: string };
};

export default function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MeSummaryDto | null>(null);
  const [redemptions, setRedemptions] = useState<PerkRedemptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setSummary(null);
        setRedemptions([]);
        return;
      }
      const [s, r] = await Promise.all([
        apiGet<MeSummaryDto>('/players/me/summary', token),
        apiGet<PerkRedemptionRow[]>('/players/me/perk-redemptions', token),
      ]);
      await syncOnboardingFromServerSummary(s);
      setSummary(s);
      setRedemptions(Array.isArray(r) ? r.slice(0, 15) : []);
    } catch {
      setError(t('profile.loadError'));
      setSummary(null);
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shareFriendLink = async () => {
    setSharing(true);
    try {
      const token = await getTokenRef.current();
      await createAndShareFriendInviteLink(token, t);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('friends.friendLinkFailed'));
    } finally {
      setSharing(false);
    }
  };

  const formatRedeemed = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <Text style={styles.subtitle}>{t('profile.subtitle')}</Text>

        <View style={styles.linkRow}>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
            onPress={() => navigation.navigate('Friends')}
          >
            <Text style={styles.linkBtnText}>{t('profile.openFriends')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
            onPress={() => void shareFriendLink()}
            disabled={sharing}
          >
            <Text style={styles.linkBtnText}>
              {sharing ? '…' : t('profile.shareFriendLink')}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : summary ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.xp')}</Text>
              <Text style={styles.value}>{summary.xp}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.tier')}</Text>
              <Text style={styles.value}>{summary.tier}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.completedChallenges')}</Text>
              <Text style={styles.value}>{summary.completedChallenges}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.venuesUnlocked')}</Text>
              <Text style={styles.value}>{summary.venuesUnlocked}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('profile.recentPerksTitle')}</Text>
        <Text style={styles.sectionHint}>{t('profile.recentPerksHint')}</Text>
        {loading ? null : redemptions.length === 0 ? (
          <Text style={styles.muted}>{t('profile.recentPerksEmpty')}</Text>
        ) : (
          <View style={styles.list}>
            {redemptions.map((row) => (
              <View key={row.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{row.perk.title}</Text>
                {row.perk.subtitle ? (
                  <Text style={styles.listSub}>{row.perk.subtitle}</Text>
                ) : null}
                <Text style={styles.listMeta}>
                  {t('profile.redeemedAt', { when: formatRedeemed(row.redeemedAt) })} · {row.perk.code}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9ca3af', marginTop: 8, fontSize: 14, lineHeight: 20 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  linkBtn: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4c1d95',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  linkBtnPressed: { opacity: 0.88 },
  linkBtnText: { color: '#c4b5fd', fontWeight: '800', fontSize: 13 },
  center: { marginTop: 24, alignItems: 'center' },
  card: {
    marginTop: 20,
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  value: { color: '#fff', fontSize: 16, fontWeight: '900' },
  error: { color: '#f87171', marginTop: 16, fontSize: 14 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 28 },
  sectionHint: { color: '#6b7280', fontSize: 12, marginTop: 6, lineHeight: 17 },
  muted: { color: '#6b7280', marginTop: 10, fontSize: 13 },
  list: { marginTop: 12, gap: 10 },
  listItem: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  listTitle: { color: '#f4f4f5', fontSize: 15, fontWeight: '800' },
  listSub: { color: '#9ca3af', fontSize: 13, marginTop: 4, lineHeight: 18 },
  listMeta: { color: '#6b7280', fontSize: 11, marginTop: 8, fontWeight: '600' },
});
