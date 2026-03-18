import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'WordLobby'>;

type Difficulty = 'easy' | 'normal' | 'hard';

export default function WordLobbyScreen({ navigation, route }: Props) {
  const { venueId, challengeId } = route.params;
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  const difficultyLabel = useMemo(() => {
    if (difficulty === 'easy') return 'Easy: sentence hint';
    if (difficulty === 'normal') return 'Normal: word hints';
    return 'Hard: emoji hints';
  }, [difficulty]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Word Game</Text>
        <Text style={styles.subtitle}>Venue: {venueId}</Text>

        <Text style={styles.sectionTitle}>Choose difficulty</Text>
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setDifficulty('easy')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'easy' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>Easy</Text>
          </Pressable>
          <Pressable
            onPress={() => setDifficulty('normal')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'normal' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>Normal</Text>
          </Pressable>
          <Pressable
            onPress={() => setDifficulty('hard')}
            style={({ pressed }) => [
              styles.segment,
              pressed && styles.segmentPressed,
              difficulty === 'hard' && styles.segmentActive,
            ]}
          >
            <Text style={styles.segmentText}>Hard</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{difficultyLabel}</Text>
          <Text style={styles.cardSub}>
            Solo mode for MVP. When you finish the session, we’ll update your in-venue challenge.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            navigation.navigate('WordGame', {
              venueId,
              challengeId,
              difficulty,
              mode: 'solo',
              sessionWordsCount: 5,
            });
          }}
          style={styles.playBtn}
        >
          <Text style={styles.playBtnText}>Start Solo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#9ca3af', marginTop: 8, fontSize: 13 },
  sectionTitle: { color: '#fff', fontWeight: '900', marginTop: 22, marginBottom: 10, fontSize: 14 },
  segmentRow: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  segmentPressed: { opacity: 0.9 },
  segmentActive: { borderColor: '#a78bfa', backgroundColor: '#0b1220' },
  segmentText: { color: '#f9fafb', fontWeight: '900' },
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { color: '#fff', fontWeight: '900' },
  cardSub: { color: '#9ca3af', marginTop: 8, lineHeight: 18, fontSize: 13 },
  playBtn: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});

