import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseGame'>;

export default function ChooseGameScreen({ navigation, route }: Props) {
    const { t } = useTranslation();
    const venueId = route.params?.venueId;
    const challengeId = route.params?.challengeId;
    const hasVenueContext = Boolean(venueId);

    const onOpenWordGame = () => {
        navigation.navigate('WordLobby', { venueId, challengeId });
    };

    const onOpenBrawler = () => {
        if (!venueId) return;
        navigation.navigate('BrawlerLobby', { venueId });
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.title}>{t('chooseGame.title')}</Text>
                <Text style={styles.subtitle}>{t('chooseGame.subtitle')}</Text>

                <Pressable
                    onPress={onOpenWordGame}
                    style={({ pressed }) => [styles.card, styles.wordCard, pressed && styles.cardPressed]}
                >
                    <Text style={styles.cardEmoji}>🧩</Text>
                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{t('chooseGame.wordTitle')}</Text>
                        <Text style={styles.cardDescription}>{t('chooseGame.wordDescription')}</Text>
                        <Text style={styles.cardMeta}>
                            {hasVenueContext ? t('chooseGame.wordCtaVenue') : t('chooseGame.wordCtaGlobal')}
                        </Text>
                    </View>
                </Pressable>

                <Pressable
                    onPress={onOpenBrawler}
                    disabled={!hasVenueContext}
                    style={({ pressed }) => [
                        styles.card,
                        styles.brawlerCard,
                        !hasVenueContext && styles.cardDisabled,
                        pressed && styles.cardPressed,
                    ]}
                >
                    <Text style={styles.cardEmoji}>🥊</Text>
                    <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{t('chooseGame.brawlerTitle')}</Text>
                        <Text style={styles.cardDescription}>{t('chooseGame.brawlerDescription')}</Text>
                        <Text style={styles.cardMeta}>
                            {hasVenueContext ? t('chooseGame.brawlerCta') : t('chooseGame.brawlerNeedVenue')}
                        </Text>
                    </View>
                </Pressable>

                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>{t('common.back')}</Text>
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
        borderRadius: 18,
        padding: 16,
        flexDirection: 'row',
        gap: 14,
        alignItems: 'flex-start',
        borderWidth: 1,
    },
    cardDisabled: { opacity: 0.45 },
    cardPressed: { opacity: 0.92 },
    wordCard: {
        backgroundColor: '#111827',
        borderColor: '#4c1d95',
    },
    brawlerCard: {
        backgroundColor: '#111827',
        borderColor: '#14532d',
    },
    cardEmoji: { fontSize: 36, marginTop: 4 },
    cardBody: { flex: 1, gap: 6 },
    cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    cardDescription: { color: '#9ca3af', fontSize: 13, lineHeight: 19 },
    cardMeta: { color: '#a78bfa', fontSize: 12, fontWeight: '700', marginTop: 4 },
    backButton: {
        marginTop: 'auto',
        marginBottom: 24,
        alignSelf: 'flex-start',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    backButtonText: { color: '#a78bfa', fontWeight: '700', fontSize: 15 },
});
