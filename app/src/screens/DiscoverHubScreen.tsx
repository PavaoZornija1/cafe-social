import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import type { MeSummaryDto } from '../lib/meSummary';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
type Props = NativeStackScreenProps<RootStackParamList, 'DiscoverHub'>;

type Engagement = {
    visitsThisWeek: number;
    distinctVenuesVisitedLast30Days: number;
    badges: string[];
};

export default function DiscoverHubScreen({ navigation }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    const [loading, setLoading] = useState(true);
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [summary, setSummary] = useState<MeSummaryDto | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!isLoaded) return;
        setLoading(true);
        setLoadErr(null);
        try {
            const token = await getTokenRef.current();
            if (!token) {
                setEngagement(null);
                setSummary(null);
                return;
            }
            const [eng, sum] = await Promise.all([
                apiGet<Engagement>('/players/me/engagement', token).catch(() => null),
                apiGet<MeSummaryDto>('/players/me/summary', token).catch(() => null),
            ]);
            setEngagement(eng);
            setSummary(sum);
        } catch (e) {
            setLoadErr(
                isLikelyNetworkFailure(e)
                    ? t('home.venueErrorNetwork')
                    : (e as Error).message || t('discoverHub.loadError'),
            );
        } finally {
            setLoading(false);
        }
    }, [isLoaded, t]);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const badgeLabel = (key: string): string => {
        if (key === 'regular_this_week') return t('home.badgeRegularWeek');
        if (key === 'venue_explorer') return t('home.badgeVenueExplorer');
        return key;
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.back}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back')}
                >
                    <Text style={styles.backText}>{t('common.back')}</Text>
                </Pressable>
                <Text style={styles.title}>{t('discoverHub.title')}</Text>
            </View>
            <Text style={styles.sub}>{t('discoverHub.subtitle')}</Text>

            {loadErr ? <Text style={styles.errBanner}>{loadErr}</Text> : null}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {loading && !engagement && !summary ? (
                    <ActivityIndicator color={colors.honey} style={{ marginVertical: 24 }} />
                ) : null}

                <Pressable
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    onPress={() => navigation.navigate('PartnerVenuesMap')}
                    accessibilityRole="button"
                    accessibilityLabel={t('discoverHub.openMap')}
                >
                    <Ionicons name="map-outline" size={26} color={colors.honey} />
                    <View style={styles.tileText}>
                        <Text style={styles.tileTitle}>{t('discoverHub.openMap')}</Text>
                        <Text style={styles.tileBody}>{t('discoverHub.openMapHint')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    onPress={() => navigation.navigate('Challenges')}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.navChallenges')}
                >
                    <Ionicons name="trophy-outline" size={26} color={colors.honey} />
                    <View style={styles.tileText}>
                        <Text style={styles.tileTitle}>{t('discoverHub.challengesTitle')}</Text>
                        <Text style={styles.tileBody}>{t('discoverHub.challengesHint')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    onPress={() => navigation.navigate('Leaderboard')}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.navLeaderboard')}
                >
                    <Ionicons name="bar-chart-outline" size={26} color={colors.honey} />
                    <View style={styles.tileText}>
                        <Text style={styles.tileTitle}>{t('discoverHub.leaderboardTitle')}</Text>
                        <Text style={styles.tileBody}>{t('discoverHub.leaderboardHint')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                    onPress={() => navigation.navigate('QrScan', {})}
                    accessibilityRole="button"
                    accessibilityLabel={t('discoverHub.qrCheckIn')}
                >
                    <Ionicons name="qr-code-outline" size={26} color={colors.honey} />
                    <View style={styles.tileText}>
                        <Text style={styles.tileTitle}>{t('discoverHub.qrCheckIn')}</Text>
                        <Text style={styles.tileBody}>{t('discoverHub.qrCheckInHint')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>

                {summary ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('discoverHub.progressTitle')}</Text>
                        <Text style={styles.cardLine}>
                            {summary.nextTierXpThreshold != null
                                ? `${summary.xp} / ${summary.nextTierXpThreshold} · ${summary.tier}`
                                : `${summary.xp} XP · ${summary.tier}`}
                        </Text>
                        {summary.nextTierName ? (
                            <Text style={styles.cardMuted}>
                                {t('home.xpTowardNext', { nextTier: summary.nextTierName })}
                            </Text>
                        ) : (
                            <Text style={styles.cardMuted}>{t('home.xpMaxTier')}</Text>
                        )}
                    </View>
                ) : null}

                {engagement ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('discoverHub.crossVenueStats')}</Text>
                        <Text style={styles.cardLine}>
                            {t('home.visitsThisWeek', { n: engagement.visitsThisWeek })}
                        </Text>
                        {engagement.distinctVenuesVisitedLast30Days > 0 ? (
                            <Text style={styles.cardMuted}>
                                {t('venueHub.venuesExploredMonth', {
                                    n: engagement.distinctVenuesVisitedLast30Days,
                                })}
                            </Text>
                        ) : null}
                        {engagement.badges.length ? (
                            <View style={styles.badgeRow}>
                                {engagement.badges.map((b) => (
                                    <View key={b} style={styles.badge}>
                                        <Text style={styles.badgeText}>{badgeLabel(b)}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                    </View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

function createStyles(colors: AppColors) {
    return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    back: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.surface,
    },
    backText: { color: colors.textSecondary, fontWeight: '600' },
    title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
    sub: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 18,
        paddingHorizontal: 24,
        marginTop: 8,
        marginBottom: 12,
    },
    errBanner: {
        color: colors.error,
        fontSize: 13,
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
    tile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 16,
        paddingHorizontal: 14,
        marginBottom: 10,
    },
    tilePressed: { opacity: 0.9 },
    tileText: { flex: 1, minWidth: 0 },
    tileTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    tileBody: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginTop: 6,
    },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 10 },
    cardLine: { color: colors.text, fontSize: 14, fontWeight: '700' },
    cardMuted: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    badge: {
        backgroundColor: colors.successMuted,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: { color: colors.success, fontSize: 11, fontWeight: '800' },
    });
}
