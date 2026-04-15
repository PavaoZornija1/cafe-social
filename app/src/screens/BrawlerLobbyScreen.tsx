import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { apiGet, apiPost } from '../lib/api';
import { BRUISER_ARENA_HERO_ID } from '../brawler/bruiserSpritesheet';
import type { BrawlerArenaHeroStats, RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerLobby'>;

type BrawlerHero = {
  id: string;
  name: string;
  archetype?: string | null;
  baseHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  attackDamage: number;
  attackKnockback: number;
};

type CreateSessionResponse = {
  id: string;
  participants: Array<{ id: string }>;
};

export default function BrawlerLobbyScreen({ route, navigation }: Props) {
  const venueId = route.params?.venueId;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loadingHeroes, setLoadingHeroes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [heroes, setHeroes] = useState<BrawlerHero[]>([]);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isLoaded) return;
      setLoadingHeroes(true);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const rows = await apiGet<BrawlerHero[]>('/brawler/heroes', token);
        if (cancelled) return;
        setHeroes(rows);
        setSelectedHeroId(rows[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        Alert.alert('Error', (e as Error).message || 'Failed to load heroes');
      } finally {
        if (!cancelled) setLoadingHeroes(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const selectedHero = useMemo(
    () => heroes.find((h) => h.id === selectedHeroId) ?? null,
    [heroes, selectedHeroId],
  );

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('ChooseGame', { venueId });
  };

  const onStart = async () => {
    if (!selectedHeroId) return;
    if (!isLoaded) return;

    if (selectedHeroId !== BRUISER_ARENA_HERO_ID) {
      Alert.alert(
        'Arena',
        'The playable arena with move/jump is available for Blaze (bruiser sprites) only for now. Pick Blaze to play.',
      );
      return;
    }

    setCreating(true);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const created = await apiPost<CreateSessionResponse>(
        '/brawler/sessions',
        {
          venueId,
          participants: [
            { isBot: false, brawlerHeroId: selectedHeroId },
            { isBot: true, botName: 'Chaos Bot', brawlerHeroId: selectedHeroId },
          ],
        },
        token,
      );

      await apiPost(`/brawler/sessions/${encodeURIComponent(created.id)}/start`, {}, token);

      const heroStats: BrawlerArenaHeroStats | undefined = selectedHero
        ? {
            baseHp: selectedHero.baseHp,
            moveSpeed: selectedHero.moveSpeed,
            dashCooldownMs: selectedHero.dashCooldownMs,
            attackDamage: selectedHero.attackDamage,
            attackKnockback: selectedHero.attackKnockback,
          }
        : undefined;

      navigation.navigate('BrawlerArena', {
        heroId: selectedHeroId,
        venueId,
        heroStats,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message || 'Failed to start brawler session');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Brawler Lobby</Text>
        <Text style={styles.subtitle}>Choose your hero and start a short arena match.</Text>
        <Text style={styles.meta}>Venue: {venueId ?? 'Not set (home play)'}</Text>

        {loadingHeroes ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#a78bfa" />
            <Text style={styles.loadingText}>Loading heroes...</Text>
          </View>
        ) : (
          <View style={styles.heroList}>
            {heroes.map((hero) => {
              const selected = hero.id === selectedHeroId;
              return (
                <Pressable
                  key={hero.id}
                  onPress={() => setSelectedHeroId(hero.id)}
                  style={({ pressed }) => [
                    styles.heroCard,
                    selected && styles.heroCardSelected,
                    pressed && styles.heroCardPressed,
                  ]}
                >
                  <Text style={styles.heroName}>{hero.name}</Text>
                  <Text style={styles.heroArchetype}>{hero.archetype ?? 'All-Rounder'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedHero && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Selected Hero Stats</Text>
            <Text style={styles.statsText}>HP: {selectedHero.baseHp}</Text>
            <Text style={styles.statsText}>Move Speed: {selectedHero.moveSpeed}</Text>
            <Text style={styles.statsText}>Dash Cooldown: {selectedHero.dashCooldownMs}ms</Text>
            <Text style={styles.statsText}>Attack Damage: {selectedHero.attackDamage}</Text>
            <Text style={styles.statsText}>
              Knockback: {selectedHero.attackKnockback}
            </Text>
          </View>
        )}

        <Pressable
          onPress={onStart}
          disabled={!selectedHeroId || creating || loadingHeroes}
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.startButtonPressed,
            (!selectedHeroId || creating || loadingHeroes) && styles.startButtonDisabled,
          ]}
        >
          <Text style={styles.startButtonText}>
            {creating ? 'Loading...' : 'Enter arena'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    marginBottom: 2,
  },
  backText: { color: '#e2e8f0', fontWeight: '800', fontSize: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  meta: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  loadingText: { color: '#cbd5e1', fontSize: 13 },
  heroList: { gap: 8, marginTop: 4 },
  heroCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroCardSelected: {
    borderColor: '#a78bfa',
    backgroundColor: '#1f1638',
  },
  heroCardPressed: { opacity: 0.88 },
  heroName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroArchetype: { color: '#93c5fd', fontSize: 12, marginTop: 4 },
  statsCard: {
    marginTop: 6,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  statsTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  statsText: { color: '#cbd5e1', fontSize: 13 },
  startButton: {
    marginTop: 10,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonPressed: { opacity: 0.9 },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});

