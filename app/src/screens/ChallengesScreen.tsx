import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Challenges'>;

type Venue = { id: string; name: string; isPremium: boolean };

type VenueChallenge = {
  id: string;
  title: string;
  description: string | null;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  targetCount: number;
  progressCount: number;
  isCompleted: boolean;
};

export default function ChallengesScreen(_props: Props) {
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<VenueChallenge[]>([]);
  const [progressingId, setProgressingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const detected = await apiGet<Venue | null>('/venue-context/detect');
        if (cancelled) return;
        setVenue(detected);

        if (!detected) {
          setChallenges([]);
          return;
        }

        if (!isLoaded) return;

        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const list = await apiGet<VenueChallenge[]>(
          `/venue-context/${encodeURIComponent(detected.id)}/challenges`,
          token,
        );
        if (cancelled) return;
        setChallenges(list);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || 'Failed to load challenges');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const increment = async (challengeId: string) => {
    if (!venue) return;
    if (!isLoaded) return;

    setProgressingId(challengeId);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const detected = await apiGet<Venue | null>('/venue-context/detect');

      await apiPost<void>(
        `/venue-context/${encodeURIComponent(venue.id)}/challenges/${encodeURIComponent(challengeId)}/progress`,
        { increment: 1, detectedVenueId: detected?.id ?? null },
        token,
      );
    } catch (e) {
      setError((e as Error).message || 'Failed to progress challenge');
    } finally {
      setProgressingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Challenges</Text>
        {venue ? <Text style={styles.venueName}>{venue.name}</Text> : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.placeholder}>Loading…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : challenges.length === 0 ? (
          <Text style={styles.placeholder}>No challenges available yet.</Text>
        ) : (
          challenges.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardBadge}>{c.isCompleted ? 'Done' : 'In progress'}</Text>
              </View>
              {c.description ? <Text style={styles.cardDesc}>{c.description}</Text> : null}
              <Text style={styles.cardProgress}>
                Progress: {c.progressCount}/{c.targetCount}
              </Text>
              <Text style={styles.cardHint}>
                {c.locationRequired ? 'Requires being at the café.' : 'Works from home.'}
              </Text>

              <Pressable
                disabled={!!progressingId && progressingId !== c.id}
                onPress={() => increment(c.id)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Text style={styles.actionText}>
                  {progressingId === c.id ? 'Updating…' : 'Progress +1'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  venueName: { color: '#9ca3af', marginTop: 8, fontSize: 14, fontWeight: '600' },
  placeholder: { color: '#9ca3af', marginTop: 10, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: '#f87171', marginTop: 10, fontSize: 14, lineHeight: 20 },
  center: { alignItems: 'center', marginTop: 16, gap: 10 },
  card: {
    marginTop: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 18,
    padding: 16,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '900', flex: 1, paddingRight: 10 },
  cardBadge: {
    color: '#a78bfa',
    fontWeight: '900',
    backgroundColor: '#0b1220',
    borderColor: '#182238',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 12,
    marginTop: 2,
  },
  cardDesc: { color: '#9ca3af', marginTop: 8, fontSize: 13, lineHeight: 18 },
  cardProgress: { color: '#e5e7eb', marginTop: 10, fontSize: 14, fontWeight: '800' },
  cardHint: { color: '#a5b4fc', marginTop: 6, fontSize: 13, fontWeight: '700' },
  actionBtn: {
    marginTop: 14,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#182238',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionBtnPressed: { opacity: 0.9 },
  actionText: { color: '#9ca3af', fontWeight: '900' },
});

