import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type MeSummary = {
  playerId?: string;
  xp: number;
  tier: string;
  completedChallenges: number;
  venuesUnlocked: number;
};

export default function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MeSummary | null>(null);
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
        return;
      }
      const s = await apiGet<MeSummary>('/players/me/summary', token);
      setSummary(s);
    } catch {
      setError(t('profile.loadError'));
      setSummary(null);
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

        <Text style={styles.placeholder}>{t('profile.comingHistory')}</Text>
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
  placeholder: { color: '#6b7280', marginTop: 24, fontSize: 13, lineHeight: 18 },
});
