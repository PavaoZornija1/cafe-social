import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseGame'>;

export default function ChooseGameScreen({ navigation, route }: Props) {
    const venueId = route.params?.venueId;

    const onOpenWordGame = () => {
        Alert.alert('Word Game', 'Development in progres');
    };

    const onOpenBrawler = () => {
        navigation.navigate('BrawlerLobby', { venueId });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.title}>Choose a Game</Text>
                <Text style={styles.subtitle}>
                    Pick one of the available games to start your session.
                </Text>

                <Pressable
                    onPress={onOpenWordGame}
                    style={({ pressed }) => [
                        styles.card,
                        styles.wordCard,
                        pressed && styles.cardPressed,
                    ]}
                >
                    <Text style={styles.cardEmoji}>🧩</Text>
                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>Word Game</Text>
                        <Text style={styles.cardDescription}>
                            Fast social guessing game with challenges and venue progression.
                        </Text>
                        <Text style={styles.cardMeta}>Tap to preview — coming soon</Text>
                    </View>
                </Pressable>

                <Pressable
                    onPress={onOpenBrawler}
                    style={({ pressed }) => [
                        styles.card,
                        styles.brawlerCard,
                        pressed && styles.cardPressed,
                    ]}
                >
                    <Text style={styles.cardEmoji}>🥊</Text>
                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>Brawler</Text>
                        <Text style={styles.cardDescription}>
                            60-75s chaotic arena battles with heroes and power-ups.
                        </Text>
                        <Text style={styles.cardMeta}>Open lobby</Text>
                    </View>
                </Pressable>

                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#050816' },
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 14 },
    title: { color: '#fff', fontSize: 28, fontWeight: '900' },
    subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 6 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 16,
    },
    wordCard: {
        backgroundColor: '#0f172a',
        borderColor: '#1d4ed8',
    },
    brawlerCard: {
        backgroundColor: '#111827',
        borderColor: '#374151',
    },
    cardPressed: { opacity: 0.88 },
    cardEmoji: { fontSize: 32 },
    cardBody: { flex: 1, gap: 4 },
    cardTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
    cardDescription: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
    cardMeta: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginTop: 3 },
    backButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151',
        backgroundColor: '#111827',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    backButtonText: { color: '#f3f4f6', fontWeight: '800' },
});

