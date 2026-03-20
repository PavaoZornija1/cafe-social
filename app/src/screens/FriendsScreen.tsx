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
import { apiGet, apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Friend = { id: string; username: string };

type IncomingRow = {
  id: string;
  requestedById: string;
  playerLow: { id: string; username: string };
  playerHigh: { id: string; username: string };
};

function requesterFromRow(row: IncomingRow): { id: string; username: string } {
  return row.requestedById === row.playerLow.id ? row.playerLow : row.playerHigh;
}

export default function FriendsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRow[]>([]);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setFriends([]);
        setIncoming([]);
        return;
      }
      const [f, inc] = await Promise.all([
        apiGet<Friend[]>('/social/friends', token),
        apiGet<IncomingRow[]>('/social/friends/incoming', token),
      ]);
      setFriends(f);
      setIncoming(inc);
    } catch {
      Alert.alert(t('common.error'), t('friends.loadError'));
      setFriends([]);
      setIncoming([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const accept = async (otherPlayerId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    try {
      await apiPost('/social/friends/accept', { otherPlayerId }, token);
      Alert.alert('', t('friends.accepted'));
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('friends.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>{t('friends.incoming')}</Text>
          {incoming.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noIncoming')}</Text>
          ) : (
            incoming.map((row) => {
              const r = requesterFromRow(row);
              return (
                <View key={row.id} style={styles.card}>
                  <Text style={styles.name}>
                    {r.username}{' '}
                    <Text style={styles.mutedSmall}>{t('friends.wantsToConnect')}</Text>
                  </Text>
                  <Pressable
                    style={styles.acceptBtn}
                    onPress={() => void accept(r.id)}
                  >
                    <Text style={styles.acceptBtnText}>{t('friends.accept')}</Text>
                  </Pressable>
                </View>
              );
            })
          )}

          <Text style={[styles.section, styles.sectionSpacer]}>
            {t('friends.myFriends')}
          </Text>
          {friends.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noFriends')}</Text>
          ) : (
            friends.map((f) => (
              <View key={f.id} style={styles.friendRow}>
                <Text style={styles.friendName}>{f.username}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  section: { color: '#fff', fontSize: 16, fontWeight: '900' },
  sectionSpacer: { marginTop: 28 },
  muted: { color: '#6b7280', marginTop: 10, fontSize: 14 },
  mutedSmall: { color: '#9ca3af', fontWeight: '500', fontSize: 13 },
  card: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    gap: 12,
  },
  name: { color: '#f9fafb', fontWeight: '700', fontSize: 15 },
  acceptBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  acceptBtnText: { color: '#fff', fontWeight: '800' },
  friendRow: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  friendName: { color: '#e5e7eb', fontWeight: '700' },
});
