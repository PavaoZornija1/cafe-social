import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ChooseGame'>;

export default function ChooseGameScreen({ navigation, route }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
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
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                    <Text style={styles.backText}>{t('common.back')}</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{t('chooseGame.title')}</Text>
            </View>
            <View style={styles.container}>
                <Text style={styles.subtitle}>{t('chooseGame.subtitle')}</Text>
                <Text style={styles.dailyNote}>{t('chooseGame.dailyWordNote')}</Text>

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
            </View>
        </SafeAreaView>
    );
}

function createStyles(colors: AppColors) {
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bg },
        header: {
            paddingHorizontal: 20,
            paddingTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 4,
        },
        back: {
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: colors.surface,
        },
        backText: { color: colors.textSecondary, fontWeight: '600' },
        headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900', flex: 1 },
        container: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 14 },
        subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
        dailyNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 6 },
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
            backgroundColor: colors.surface,
            borderColor: colors.primary,
        },
        brawlerCard: {
            backgroundColor: colors.surface,
            borderColor: colors.success,
        },
        cardEmoji: { fontSize: 36, marginTop: 4 },
        cardBody: { flex: 1, gap: 6 },
        cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
        cardDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
        cardMeta: { color: colors.honey, fontSize: 12, fontWeight: '700', marginTop: 4 },
        backButton: {
            marginTop: 'auto',
            marginBottom: 24,
            alignSelf: 'flex-start',
            paddingVertical: 12,
            paddingHorizontal: 16,
        },
        backButtonText: { color: colors.honey, fontWeight: '700', fontSize: 15 },
    });
}
