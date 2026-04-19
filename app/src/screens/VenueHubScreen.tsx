import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
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
import { openOrderingOrMenu } from '../lib/openOrderingLinks';
import { fetchVenuePerkTeasers, type VenuePerkPublicTeaser } from '../lib/venuePerksApi';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';

type Props = NativeStackScreenProps<RootStackParamList, 'VenueHub'>;

type VenueAccess = {
    canEnterVenueContext: boolean;
    bannedFromVenue?: boolean;
};

type VenuePublicOffer = {
    id: string;
    title: string;
    body: string | null;
    ctaUrl: string | null;
    globallyExhausted: boolean;
};

type VenuePublicCard = {
    id: string;
    name: string;
    menuUrl: string | null;
    orderingUrl: string | null;
    offers: VenuePublicOffer[];
    featuredOffer: {
        id: string;
        title: string | null;
        body: string | null;
        endsAt: string | null;
    } | null;
};

type VenueFeedItem = {
    id: string;
    kind: string;
    title: string;
    subtitle: string | null;
    actorUsername: string | null;
    createdAt: string;
};

type FriendAtVenueRow = {
    id: string;
    username: string;
    hereNow: boolean;
    lastVisitDayKey: string | null;
};

type FriendsVisitSummary = {
    friendsWithVisitsLast30Days: number;
    sinceDayKey: string;
};

type Engagement = {
    visitsThisWeek: number;
    distinctVenuesVisitedLast30Days: number;
    badges: string[];
};

export default function VenueHubScreen({ navigation, route }: Props) {
    const { t } = useTranslation();
    const { venueId, venueName } = route.params;
    const { isLoaded, getToken } = useAuth();
    const title = venueName ?? venueId;

    const [loadError, setLoadError] = useState<string | null>(null);
    const [publicCard, setPublicCard] = useState<VenuePublicCard | null>(null);
    const [loadingCard, setLoadingCard] = useState(true);
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [friendsVisit, setFriendsVisit] = useState<FriendsVisitSummary | null>(null);
    const [friendsAtVenue, setFriendsAtVenue] = useState<FriendAtVenueRow[]>([]);
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [venuePerks, setVenuePerks] = useState<VenuePerkPublicTeaser[]>([]);
    const [venueFeed, setVenueFeed] = useState<VenueFeedItem[]>([]);
    const [loadingSocial, setLoadingSocial] = useState(false);

    const loadCard = useCallback(async () => {
        setLoadingCard(true);
        setLoadError(null);
        try {
            const card = await apiGet<VenuePublicCard>(`/venues/${encodeURIComponent(venueId)}/public-card`);
            setPublicCard({
                ...card,
                offers: Array.isArray(card.offers) ? card.offers : [],
            });
        } catch (e) {
            setPublicCard(null);
            setLoadError(
                isLikelyNetworkFailure(e)
                    ? t('home.venueErrorNetwork')
                    : (e as Error).message || t('venueHub.loadError'),
            );
        } finally {
            setLoadingCard(false);
        }
    }, [venueId, t]);

    const loadAuthenticated = useCallback(async () => {
        if (!isLoaded) return;
        const token = await getToken();
        if (!token) return;
        setLoadingSocial(true);
        try {
            const a = await apiGet<VenueAccess>(
                `/venue-context/${encodeURIComponent(venueId)}/access`,
                token,
            );
            setAccess(a);

            const [fv, fat, eng, perks] = await Promise.all([
                apiGet<FriendsVisitSummary>(
                    `/social/venues/${encodeURIComponent(venueId)}/friends-visit-summary`,
                    token,
                ).catch(() => null),
                apiGet<{ friends: FriendAtVenueRow[] }>(
                    `/social/venues/${encodeURIComponent(venueId)}/friends-at-venue`,
                    token,
                ).catch(() => ({ friends: [] })),
                apiGet<Engagement>('/players/me/engagement', token).catch(() => null),
                fetchVenuePerkTeasers(venueId, token).catch(() => []),
            ]);
            setFriendsVisit(fv);
            setFriendsAtVenue(Array.isArray(fat.friends) ? fat.friends : []);
            setEngagement(eng);
            setVenuePerks(perks);

            if (a.canEnterVenueContext) {
                const feed = await apiGet<VenueFeedItem[]>(
                    `/social/venues/${encodeURIComponent(venueId)}/feed?limit=20`,
                    token,
                ).catch(() => []);
                setVenueFeed(Array.isArray(feed) ? feed : []);
            } else {
                setVenueFeed([]);
            }
        } catch {
            setAccess(null);
            setFriendsVisit(null);
            setFriendsAtVenue([]);
            setEngagement(null);
            setVenuePerks([]);
            setVenueFeed([]);
        } finally {
            setLoadingSocial(false);
        }
    }, [venueId, isLoaded, getToken]);

    useFocusEffect(
        useCallback(() => {
            void loadCard();
        }, [loadCard]),
    );

    useEffect(() => {
        void loadAuthenticated();
    }, [loadAuthenticated]);

    const badgeLabel = (key: string): string => {
        if (key === 'regular_this_week') return t('home.badgeRegularWeek');
        if (key === 'venue_explorer') return t('home.badgeVenueExplorer');
        return key;
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.topBar}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={t('venueHub.backA11y')}
                >
                    <Ionicons name="chevron-back" size={26} color="#fff" />
                </Pressable>
                <Text style={styles.topTitle} numberOfLines={1}>
                    {t('venueHub.title', { name: title })}
                </Text>
                <View style={styles.topBarSpacer} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {loadError && !loadingCard ? (
                    <Text style={styles.errorBanner}>{loadError}</Text>
                ) : null}

                {loadingCard && !publicCard ? (
                    <ActivityIndicator color="#a78bfa" style={{ marginVertical: 24 }} />
                ) : null}

                {publicCard ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('home.partnerOffers', { name: publicCard.name })}</Text>
                        {publicCard.featuredOffer?.title ? (
                            <View style={styles.featuredBox}>
                                <Text style={styles.featuredLabel}>{t('home.featuredOffer')}</Text>
                                <Text style={styles.featuredTitle}>{publicCard.featuredOffer.title}</Text>
                                {publicCard.featuredOffer.body ? (
                                    <Text style={styles.featuredBody}>{publicCard.featuredOffer.body}</Text>
                                ) : null}
                                {(() => {
                                    const hero = (publicCard.offers ?? []).find(
                                        (o) => o.id === publicCard.featuredOffer?.id,
                                    );
                                    const url = hero?.ctaUrl?.trim();
                                    if (!url || hero?.globallyExhausted) return null;
                                    return (
                                        <Pressable
                                            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                                            onPress={() => void Linking.openURL(url)}
                                        >
                                            <Text style={styles.ctaText}>{t('home.offerCta')}</Text>
                                        </Pressable>
                                    );
                                })()}
                            </View>
                        ) : null}
                        {(publicCard.offers ?? []).filter(
                            (o) => o.id !== publicCard.featuredOffer?.id && o.title?.trim(),
                        ).length ? (
                            <View style={styles.moreOffers}>
                                {(publicCard.offers ?? [])
                                    .filter((o) => o.id !== publicCard.featuredOffer?.id && o.title?.trim())
                                    .map((o) => (
                                        <View key={o.id} style={styles.offerRow}>
                                            <Text style={styles.offerTitle}>{o.title}</Text>
                                            {o.body ? <Text style={styles.offerBody}>{o.body}</Text> : null}
                                            {o.globallyExhausted ? (
                                                <Text style={styles.exhausted}>{t('home.offerExhausted')}</Text>
                                            ) : o.ctaUrl?.trim() ? (
                                                <Pressable
                                                    onPress={() => void Linking.openURL(o.ctaUrl!.trim())}
                                                    style={({ pressed }) => [styles.link, pressed && styles.ctaPressed]}
                                                >
                                                    <Text style={styles.linkText}>{t('home.offerCta')}</Text>
                                                </Pressable>
                                            ) : null}
                                        </View>
                                    ))}
                            </View>
                        ) : null}
                        <View style={styles.partnerLinks}>
                            {publicCard.orderingUrl?.trim() ? (
                                <Pressable
                                    style={({ pressed }) => [styles.pillBtn, pressed && styles.ctaPressed]}
                                    onPress={() => void openOrderingOrMenu(publicCard.orderingUrl, null)}
                                >
                                    <Text style={styles.pillBtnText}>{t('home.openOrdering')}</Text>
                                </Pressable>
                            ) : null}
                            {publicCard.menuUrl?.trim() ? (
                                <Pressable
                                    style={({ pressed }) => [styles.pillBtn, pressed && styles.ctaPressed]}
                                    onPress={() => void openOrderingOrMenu(null, publicCard.menuUrl)}
                                >
                                    <Text style={styles.pillBtnText}>{t('home.openMenu')}</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                ) : null}

                {friendsVisit && friendsVisit.friendsWithVisitsLast30Days > 0 ? (
                    <Text style={styles.friendsLine}>
                        {t('home.friendsVisitedVenue', {
                            count: friendsVisit.friendsWithVisitsLast30Days,
                        })}
                    </Text>
                ) : null}

                {friendsAtVenue.length > 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('home.friendsAtVenueTitle')}</Text>
                        {loadingSocial ? (
                            <ActivityIndicator color="#a78bfa" style={{ marginTop: 8 }} />
                        ) : (
                            friendsAtVenue.map((f) => (
                                <View key={f.id} style={styles.friendRow}>
                                    <View style={styles.friendMain}>
                                        <Text style={styles.friendName}>{f.username}</Text>
                                        <View style={styles.friendMeta}>
                                            {f.hereNow ? (
                                                <Text style={styles.herePill}>{t('home.friendHereNow')}</Text>
                                            ) : f.lastVisitDayKey ? (
                                                <Text style={styles.friendMetaText}>
                                                    {t('home.friendLastVisitDay', { day: f.lastVisitDayKey })}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <Pressable
                                        style={({ pressed }) => [styles.reportBtn, pressed && styles.ctaPressed]}
                                        onPress={() =>
                                            navigation.navigate('ReportPlayer', {
                                                venueId,
                                                venueName: title,
                                                reportedPlayerId: f.id,
                                                reportedUsername: f.username,
                                            })
                                        }
                                    >
                                        <Text style={styles.reportText}>{t('home.reportAtVenue')}</Text>
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </View>
                ) : null}

                {engagement ? (
                    <View style={styles.card}>
                        <Text style={styles.metaLine}>
                            {t('home.visitsThisWeek', { n: engagement.visitsThisWeek })}
                        </Text>
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

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('home.venuePerksTitle')}</Text>
                    {loadingSocial && venuePerks.length === 0 ? (
                        <ActivityIndicator color="#a78bfa" style={{ marginTop: 8 }} />
                    ) : venuePerks.length === 0 ? (
                        <Text style={styles.muted}>{t('home.venuePerksEmpty')}</Text>
                    ) : (
                        venuePerks.slice(0, 12).map((p) => (
                            <View key={p.id} style={styles.perkRow}>
                                <Text style={styles.perkTitle} numberOfLines={2}>
                                    {p.title}
                                </Text>
                                {p.redeemedByYou ? (
                                    <Text style={styles.perkPill}>{t('home.venuePerksRedeemed')}</Text>
                                ) : p.fullyRedeemed ? (
                                    <Text style={styles.mutedSmall}>—</Text>
                                ) : null}
                            </View>
                        ))
                    )}
                </View>

                {access?.canEnterVenueContext ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('home.venueFeedTitle')}</Text>
                        {venueFeed.length === 0 ? (
                            <Text style={styles.muted}>{t('home.venueFeedEmpty')}</Text>
                        ) : (
                            venueFeed.map((ev) => (
                                <View key={ev.id} style={styles.feedRow}>
                                    <Text style={styles.feedLine}>
                                        {ev.actorUsername
                                            ? t('home.venueFeedActor', {
                                                  user: ev.actorUsername,
                                                  action: ev.subtitle ?? ev.title,
                                              })
                                            : ev.title}
                                    </Text>
                                    <Text style={styles.feedSub}>{ev.title}</Text>
                                </View>
                            ))
                        )}
                    </View>
                ) : null}

                {access?.bannedFromVenue ? (
                    <Pressable
                        style={({ pressed }) => [styles.appealBtn, pressed && styles.ctaPressed]}
                        onPress={() =>
                            navigation.navigate('BanAppeal', { venueId, venueName: title })
                        }
                    >
                        <Text style={styles.appealText}>{t('home.banAppealCta')}</Text>
                    </Pressable>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#050816' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    backBtn: { padding: 8, borderRadius: 12 },
    backBtnPressed: { opacity: 0.8 },
    topTitle: {
        flex: 1,
        color: '#fff',
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
    },
    topBarSpacer: { width: 42 },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    errorBanner: {
        color: '#f87171',
        fontSize: 13,
        marginBottom: 12,
        lineHeight: 18,
    },
    card: {
        backgroundColor: '#0b1220',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1e293b',
        padding: 14,
        marginBottom: 14,
    },
    cardTitle: { color: '#fff', fontSize: 14, fontWeight: '900', marginBottom: 10 },
    featuredBox: {
        backgroundColor: '#111827',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#4c1d95',
    },
    featuredLabel: { color: '#c4b5fd', fontSize: 11, fontWeight: '800', marginBottom: 6 },
    featuredTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
    featuredBody: { color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 18 },
    cta: {
        alignSelf: 'flex-start',
        marginTop: 12,
        backgroundColor: '#312e81',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { color: '#e9d5ff', fontWeight: '800', fontSize: 12 },
    moreOffers: { marginTop: 12, gap: 10 },
    offerRow: {
        backgroundColor: '#111827',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    offerTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
    offerBody: { color: '#94a3b8', fontSize: 12, marginTop: 6, lineHeight: 17 },
    exhausted: { color: '#fca5a5', fontSize: 12, marginTop: 8, fontWeight: '700' },
    link: { alignSelf: 'flex-start', marginTop: 8 },
    linkText: { color: '#a78bfa', fontWeight: '800', fontSize: 12 },
    partnerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    pillBtn: {
        backgroundColor: '#312e81',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    pillBtnText: { color: '#e9d5ff', fontWeight: '800', fontSize: 13 },
    friendsLine: { color: '#93c5fd', fontSize: 12, fontWeight: '700', marginBottom: 12 },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    friendMain: { flex: 1, minWidth: 0 },
    friendName: { color: '#fff', fontSize: 13, fontWeight: '800' },
    friendMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    herePill: {
        color: '#bbf7d0',
        fontSize: 10,
        fontWeight: '800',
        backgroundColor: '#14532d',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        overflow: 'hidden',
        alignSelf: 'flex-start',
    },
    friendMetaText: { color: '#64748b', fontSize: 11, fontWeight: '600' },
    reportBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: '#334155',
    },
    reportText: { color: '#fca5a5', fontSize: 11, fontWeight: '800' },
    metaLine: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    badge: {
        backgroundColor: '#14532d',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: { color: '#bbf7d0', fontSize: 11, fontWeight: '800' },
    perkRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    perkTitle: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', flex: 1 },
    perkPill: {
        color: '#86efac',
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: '#14532d',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    muted: { color: '#64748b', fontSize: 12, marginTop: 4, lineHeight: 17 },
    mutedSmall: { color: '#64748b', fontSize: 12, fontWeight: '700' },
    feedRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    feedLine: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
    feedSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
    appealBtn: {
        alignSelf: 'stretch',
        marginTop: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#422006',
        borderWidth: 1,
        borderColor: '#ca8a04',
        alignItems: 'center',
    },
    appealText: { color: '#fde68a', fontWeight: '800', fontSize: 13 },
});
