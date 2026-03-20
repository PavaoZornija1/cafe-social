import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Leaderboard'>;

type Row = {
  venueXp: number;
  player: { id: string; username: string };
};

export default function LeaderboardScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [venueName, setVenueName] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const detected = await fetchDetectedVenue();
      if (!detected) {
        setVenueId(null);
        setVenueName(null);
        setRows([]);
        setMeId(null);
        return;
      }
      setVenueId(detected.id);
      setVenueName(detected.name);

      const token = await getTokenRef.current();
      if (!token) {
        setRows([]);
        setMeId(null);
        return;
      }
      const [board, summary] = await Promise.all([
        apiGet<Row[]>(
          `/venues/${encodeURIComponent(detected.id)}/leaderboard/xp`,
          token,
        ),
        apiGet<{ playerId: string }>('/players/me/summary', token),
      ]);
      setRows(board);
      setMeId(summary.playerId);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('leaderboard.title')}</Text>
      </View>
      <Text style={styles.subtitle}>{t('leaderboard.subtitle')}</Text>

      {!venueId ? (
        <Text style={styles.placeholder}>{t('leaderboard.emptyVenue')}</Text>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : (
        <>
          <Text style={styles.venueLine}>
            {venueName ?? venueId}
          </Text>
          <FlatList
            data={rows}
            keyExtractor={(item) => item.player.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.placeholder}>{t('leaderboard.emptyBoard')}</Text>
            }
            renderItem={({ item, index }) => {
              const isMe = meId != null && item.player.id === meId;
              return (
                <View style={[styles.row, isMe && styles.rowMe]}>
                  <Text style={styles.rank}>#{index + 1}</Text>
                  <View style={styles.rowMid}>
                    <Text style={styles.name}>
                      {item.player.username}
                      {isMe ? ` (${t('leaderboard.you')})` : ''}
                    </Text>
                  </View>
                  <Text style={styles.xp}>
                    {item.venueXp} {t('leaderboard.xp')}
                  </Text>
                </View>
              );
            }}
          />
        </>
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
    marginBottom: 8,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  subtitle: {
    color: '#9ca3af',
    paddingHorizontal: 24,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  venueLine: {
    color: '#a78bfa',
    fontWeight: '800',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  placeholder: {
    color: '#9ca3af',
    marginTop: 10,
    paddingHorizontal: 24,
    fontSize: 14,
    lineHeight: 20,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  rowMe: { borderColor: '#6d28d9' },
  rank: { color: '#6b7280', fontWeight: '800', width: 36 },
  rowMid: { flex: 1 },
  name: { color: '#f9fafb', fontWeight: '700' },
  xp: { color: '#e9d5ff', fontWeight: '800' },
});
