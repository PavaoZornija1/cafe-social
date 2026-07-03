import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import ExplicitCheckInBanner from '../components/home/ExplicitCheckInBanner';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { venueInitial } from '../lib/geo';
import { needsExplicitCheckInBanner } from '../lib/explicitCheckIn';
import { openOrderingOrMenu } from '../lib/openOrderingLinks';
import {
    fetchMyVenueRewards,
    fetchVenuePerkTeasers,
    type VenuePerkPublicTeaser,
    type VenueRedeemableReward,
} from '../lib/venuePerksApi';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'VenueHub'>;

type VenueAccess = {
    canEnterVenueContext: boolean;
    bannedFromVenue?: boolean;
    requiresExplicitCheckIn?: boolean;
    hasExplicitCheckIn?: boolean;
    isPhysicallyAtVenue?: boolean;
};

type LeaderboardPreviewRow = {
    venueXp: number;
    player: { id: string; username: string };
};

type VenuePublicOffer = {
    id: string;
    title: string;
    body: string | null;
    ctaUrl: string | null;
    globallyExhausted: boolean;
};

type VenuePublicGeofence = {
    latitude: number;
    longitude: number;
    radiusMeters: number;
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
    geofence?: VenuePublicGeofence;
    requiresExplicitCheckIn?: boolean;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    region?: string | null;
};

type HubVenueChallenge = {
    id: string;
    title: string;
    description: string | null;
    targetCount: number;
    progressCount: number;
    isCompleted: boolean;
    rewardTitle: string | null;
};

type PeopleHereRow = {
    id: string;
    username: string;
    relationship: 'friend' | 'stranger';
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

function venueAddressLines(card: VenuePublicCard): string[] {
    const lines: string[] = [];
    const addr = card.address?.trim();
    if (addr) lines.push(addr);
    const locality = [card.city?.trim(), card.region?.trim()].filter(Boolean).join(', ');
    if (locality) lines.push(locality);
    const country = card.country?.trim();
    if (country) lines.push(country);
    return lines;
}

function openVenueInMaps(card: VenuePublicCard): void {
    const g = card.geofence;
    if (!g) return;
    const { latitude: lat, longitude: lng } = g;
    const q = encodeURIComponent(card.name || `${lat},${lng}`);
    const url =
        Platform.OS === 'ios'
            ? `http://maps.apple.com/?ll=${lat},${lng}&q=${q}`
            : `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;
    void Linking.openURL(url);
}

export default function VenueHubScreen({ navigation, route }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { venueId, venueName } = route.params;
    const { isLoaded, getToken, isSignedIn } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const title = venueName ?? venueId;

    const [loadError, setLoadError] = useState<string | null>(null);
    const [publicCard, setPublicCard] = useState<VenuePublicCard | null>(null);
    const [initializingCard, setInitializingCard] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const publicCardRef = useRef(publicCard);
    publicCardRef.current = publicCard;
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [friendsVisit, setFriendsVisit] = useState<FriendsVisitSummary | null>(null);
    const [friendsAtVenue, setFriendsAtVenue] = useState<FriendAtVenueRow[]>([]);
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [venuePerks, setVenuePerks] = useState<VenuePerkPublicTeaser[]>([]);
    const [venueFeed, setVenueFeed] = useState<VenueFeedItem[]>([]);
    const [refreshingSocial, setRefreshingSocial] = useState(false);
    const hasSocialDataRef = useRef(false);
    const [hubChallenges, setHubChallenges] = useState<HubVenueChallenge[]>([]);
    const [peopleHereCount, setPeopleHereCount] = useState(0);
    const [myVenueRewards, setMyVenueRewards] = useState<VenueRedeemableReward[]>([]);
    const [leaderboardPreview, setLeaderboardPreview] = useState<LeaderboardPreviewRow[]>([]);

    const displayName = publicCard?.name ?? title;
    const venueLogoInitial = venueInitial(displayName);
    const addressPreview = publicCard ? venueAddressLines(publicCard)[0] ?? null : null;

    const loadCard = useCallback(async (mode: 'initial' | 'refresh') => {
        const hasCard = Boolean(publicCardRef.current);
        if (mode === 'initial' && !hasCard) {
            setInitializingCard(true);
        } else if (mode === 'refresh') {
            setRefreshing(true);
        }
        setLoadError(null);
        try {
            const card = await apiGet<VenuePublicCard>(`/venues/${encodeURIComponent(venueId)}/public-card`);
            setPublicCard({
                ...card,
                offers: Array.isArray(card.offers) ? card.offers : [],
            });
        } catch (e) {
            if (!hasCard) setPublicCard(null);
            setLoadError(
                isLikelyNetworkFailure(e)
                    ? t('home.venueErrorNetwork')
                    : (e as Error).message || t('venueHub.loadError'),
            );
        } finally {
            setInitializingCard(false);
            setRefreshing(false);
        }
    }, [venueId, t]);

    const loadAuthenticated = useCallback(async (mode: 'initial' | 'refresh') => {
        if (!isLoaded) return;
        const token = await getTokenRef.current();
        if (!token) {
            setHubChallenges([]);
            setPeopleHereCount(0);
            setMyVenueRewards([]);
            setLeaderboardPreview([]);
            hasSocialDataRef.current = false;
            return;
        }
        if (mode === 'refresh' || hasSocialDataRef.current) {
            setRefreshingSocial(true);
        }
        try {
            const a = await apiGet<VenueAccess>(
                `/venue-context/${encodeURIComponent(venueId)}/access`,
                token,
            );
            setAccess(a);

            const [fv, fat, eng, perks, chList, peopleList, rewardsList, boardList] = await Promise.all([
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
                apiGet<HubVenueChallenge[]>(
                    `/venue-context/${encodeURIComponent(venueId)}/challenges`,
                    token,
                ).catch(() => []),
                apiGet<PeopleHereRow[]>(
                    `/social/venues/${encodeURIComponent(venueId)}/people-here`,
                    token,
                ).catch(() => []),
                fetchMyVenueRewards(venueId, token).catch(() => []),
                apiGet<LeaderboardPreviewRow[]>(
                    `/venues/${encodeURIComponent(venueId)}/leaderboard/xp`,
                    token,
                ).catch(() => []),
            ]);
            setFriendsVisit(fv);
            setFriendsAtVenue(Array.isArray(fat.friends) ? fat.friends : []);
            setEngagement(eng);
            setVenuePerks(perks);
            setHubChallenges(Array.isArray(chList) ? chList : []);
            setPeopleHereCount(Array.isArray(peopleList) ? peopleList.length : 0);
            setMyVenueRewards(Array.isArray(rewardsList) ? rewardsList : []);
            setLeaderboardPreview(Array.isArray(boardList) ? boardList.slice(0, 3) : []);
            hasSocialDataRef.current = true;

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
            if (!hasSocialDataRef.current) {
                setAccess(null);
                setFriendsVisit(null);
                setFriendsAtVenue([]);
                setEngagement(null);
                setVenuePerks([]);
                setVenueFeed([]);
                setHubChallenges([]);
                setPeopleHereCount(0);
                setMyVenueRewards([]);
                setLeaderboardPreview([]);
            }
        } finally {
            setRefreshingSocial(false);
        }
    }, [venueId, isLoaded]);

    useEffect(() => {
        setPublicCard(null);
        setLoadError(null);
        hasSocialDataRef.current = false;
    }, [venueId]);

    useEffect(() => {
        void loadCard('initial');
    }, [venueId, loadCard]);

    useFocusEffect(
        useCallback(() => {
            if (publicCardRef.current) {
                void loadCard('refresh');
            }
        }, [loadCard]),
    );

    useEffect(() => {
        void loadAuthenticated('initial');
    }, [loadAuthenticated]);

    useFocusEffect(
        useCallback(() => {
            if (hasSocialDataRef.current) {
                void loadAuthenticated('refresh');
            }
        }, [loadAuthenticated]),
    );

    const handleRefresh = useCallback(() => {
        void loadCard(publicCardRef.current ? 'refresh' : 'initial');
        void loadAuthenticated(hasSocialDataRef.current ? 'refresh' : 'initial');
    }, [loadAuthenticated, loadCard]);

    const badgeLabel = (key: string): string => {
        if (key === 'regular_this_week') return t('home.badgeRegularWeek');
        if (key === 'venue_explorer') return t('home.badgeVenueExplorer');
        return key;
    };

    const showCheckInBanner = needsExplicitCheckInBanner(access);
    const openQrCheckIn = () => navigation.navigate('QrScan', { venueId });

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.titleRow}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [styles.iconBtn, pressed && styles.ctaPressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t('venueHub.backA11y')}
                    >
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </Pressable>
                    <Text style={styles.screenTitle} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Pressable
                        onPress={handleRefresh}
                        disabled={refreshing || refreshingSocial}
                        style={({ pressed }) => [styles.iconBtn, pressed && styles.ctaPressed]}
                        accessibilityRole="button"
                        accessibilityLabel={t('venueHub.refreshA11y')}
                    >
                        {refreshing || refreshingSocial ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
                        )}
                    </Pressable>
                </View>

                <Text style={styles.subtitle}>{t('venueHub.subtitle')}</Text>

                {loadError && !publicCard ? (
                    <View style={styles.errorBlock}>
                        <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
                        <Text style={styles.errorBanner}>{loadError}</Text>
                        <Pressable style={styles.retryBtn} onPress={handleRefresh}>
                            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
                        </Pressable>
                    </View>
                ) : null}

                {initializingCard && !publicCard ? (
                    <View style={styles.centerBlock}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : null}

                {publicCard ? (
                    <View style={styles.heroCard}>
                        <LinearGradientFill
                            from={colors.heroDark}
                            to={colors.hero}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroGradient}
                        />
                        <View style={styles.heroContent}>
                            <View style={styles.heroTop}>
                                <View style={styles.heroLogo}>
                                    <Text style={styles.heroLogoText}>{venueLogoInitial}</Text>
                                </View>
                                <View style={styles.heroText}>
                                    <Text style={styles.heroName}>{publicCard.name}</Text>
                                    {addressPreview ? (
                                        <Text style={styles.heroAddress} numberOfLines={2}>
                                            {addressPreview}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                            <View style={styles.quickActions}>
                                {isSignedIn ? (
                                    <Pressable
                                        style={({ pressed }) => [styles.quickChip, pressed && styles.ctaPressed]}
                                        onPress={() => navigation.navigate('ChooseGame', { venueId })}
                                    >
                                        <Ionicons name="game-controller-outline" size={16} color={colors.textInverse} />
                                        <Text style={styles.quickChipText}>{t('venueHub.playGamesCta')}</Text>
                                    </Pressable>
                                ) : null}
                                {publicCard.geofence ? (
                                    <Pressable
                                        style={({ pressed }) => [styles.quickChip, pressed && styles.ctaPressed]}
                                        onPress={() => openVenueInMaps(publicCard)}
                                    >
                                        <Ionicons name="navigate-outline" size={16} color={colors.textInverse} />
                                        <Text style={styles.quickChipText}>{t('partnerMap.openInMaps')}</Text>
                                    </Pressable>
                                ) : null}
                                {publicCard.orderingUrl?.trim() ? (
                                    <Pressable
                                        style={({ pressed }) => [styles.quickChip, pressed && styles.ctaPressed]}
                                        onPress={() => void openOrderingOrMenu(publicCard.orderingUrl, null)}
                                    >
                                        <Ionicons name="cart-outline" size={16} color={colors.textInverse} />
                                        <Text style={styles.quickChipText}>{t('home.openOrdering')}</Text>
                                    </Pressable>
                                ) : publicCard.menuUrl?.trim() ? (
                                    <Pressable
                                        style={({ pressed }) => [styles.quickChip, pressed && styles.ctaPressed]}
                                        onPress={() => void openOrderingOrMenu(null, publicCard.menuUrl)}
                                    >
                                        <Ionicons name="restaurant-outline" size={16} color={colors.textInverse} />
                                        <Text style={styles.quickChipText}>{t('home.openMenu')}</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    </View>
                ) : null}

                {loadError && publicCard ? (
                    <Text style={styles.errorInline}>{loadError}</Text>
                ) : null}

                {showCheckInBanner ? (
                    <ExplicitCheckInBanner colors={colors} onScan={openQrCheckIn} />
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

                {publicCard?.geofence ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('venueHub.locationTitle')}</Text>
                        {(() => {
                            const locLines = venueAddressLines(publicCard);
                            return (
                                <>
                                    {locLines.map((line, i) => (
                                        <Text key={`loc-${i}`} style={styles.locationLine}>
                                            {line}
                                        </Text>
                                    ))}
                                    {locLines.length === 0 ? (
                                        <Text style={styles.muted}>{t('venueHub.locationCoordsHint')}</Text>
                                    ) : null}
                                </>
                            );
                        })()}
                        <Pressable
                            style={({ pressed }) => [styles.mapBtn, pressed && styles.ctaPressed]}
                            onPress={() => openVenueInMaps(publicCard)}
                        >
                            <Text style={styles.mapBtnText}>{t('partnerMap.openInMaps')}</Text>
                        </Pressable>
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
                        {refreshingSocial ? (
                            <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
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

                {isSignedIn ? (
                    <>
                        {leaderboardPreview.length > 0 ? (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>{t('venueHub.sectionLeaderboard')}</Text>
                                {leaderboardPreview.map((row, index) => (
                                    <View key={row.player.id} style={styles.leaderboardRow}>
                                        <Text style={styles.leaderboardRank}>{index + 1}</Text>
                                        <Text style={styles.leaderboardName} numberOfLines={1}>
                                            {row.player.username}
                                        </Text>
                                        <Text style={styles.leaderboardXp}>
                                            {t('venueHub.leaderboardXp', { xp: row.venueXp })}
                                        </Text>
                                    </View>
                                ))}
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.pillBtn,
                                        styles.pillBtnSpaced,
                                        pressed && styles.ctaPressed,
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('Leaderboard', {
                                            venueId,
                                            venueName: title,
                                            scope: 'venue',
                                        })
                                    }
                                >
                                    <Text style={styles.pillBtnText}>{t('venueHub.openLeaderboard')}</Text>
                                </Pressable>
                            </View>
                        ) : null}

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{t('venueHub.playGamesTitle')}</Text>
                            <Text style={styles.muted}>{t('venueHub.playGamesHint')}</Text>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.pillBtn,
                                    styles.pillBtnSpaced,
                                    pressed && styles.ctaPressed,
                                ]}
                                onPress={() => navigation.navigate('ChooseGame', { venueId })}
                            >
                                <Text style={styles.pillBtnText}>{t('venueHub.playGamesCta')}</Text>
                            </Pressable>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{t('venueHub.peopleHereTitle')}</Text>
                            {refreshingSocial ? (
                                <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
                            ) : (
                                <>
                                    <Text style={styles.metaLine}>
                                        {t('venueHub.peopleHereTeaser', { n: peopleHereCount })}
                                    </Text>
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.pillBtn,
                                            styles.pillBtnSpaced,
                                            pressed && styles.ctaPressed,
                                        ]}
                                        onPress={() =>
                                            navigation.navigate('PeopleHere', {
                                                venueId,
                                                venueName: title,
                                            })
                                        }
                                    >
                                        <Text style={styles.pillBtnText}>{t('home.linkPeopleHere')}</Text>
                                    </Pressable>
                                </>
                            )}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{t('venueHub.challengesAtVenueTitle')}</Text>
                            {refreshingSocial && hubChallenges.length === 0 ? (
                                <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
                            ) : hubChallenges.length === 0 ? (
                                <Text style={styles.muted}>{t('venueHub.challengesEmptyShort')}</Text>
                            ) : (
                                <>
                                    {hubChallenges.slice(0, 4).map((c) => (
                                        <View key={c.id} style={styles.hubChallengeRow}>
                                            <Text style={styles.hubChallengeTitle} numberOfLines={2}>
                                                {c.title}
                                            </Text>
                                            <Text style={styles.hubChallengeMeta}>
                                                {t('challenges.progress', {
                                                    current: c.progressCount,
                                                    target: c.targetCount,
                                                })}
                                                {c.isCompleted ? ` · ${t('challenges.done')}` : ''}
                                            </Text>
                                            {c.rewardTitle ? (
                                                <Text style={styles.hubRewardHint} numberOfLines={2}>
                                                    {t('challenges.rewardLine', { title: c.rewardTitle })}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.pillBtn,
                                            styles.pillBtnSpaced,
                                            pressed && styles.ctaPressed,
                                        ]}
                                        onPress={() =>
                                            navigation.navigate('Challenges', {
                                                venueId,
                                                venueName: title,
                                            })
                                        }
                                    >
                                        <Text style={styles.pillBtnText}>{t('venueHub.challengesSeeAll')}</Text>
                                    </Pressable>
                                </>
                            )}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>{t('venueHub.myRewardsHereTitle')}</Text>
                            {refreshingSocial && myVenueRewards.length === 0 ? (
                                <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
                            ) : myVenueRewards.filter(
                                  (r) => r.status === 'REDEEMABLE' || r.status === 'LOCKED',
                              ).length === 0 ? (
                                <Text style={styles.muted}>{t('venueHub.myRewardsHereEmpty')}</Text>
                            ) : (
                                <>
                                    {myVenueRewards
                                        .filter(
                                          (r) =>
                                            r.status === 'REDEEMABLE' || r.status === 'LOCKED',
                                        )
                                        .slice(0, 4)
                                        .map((r) => (
                                            <View key={r.redemptionId} style={styles.rewardRow}>
                                                <View style={styles.rewardMain}>
                                                    <Text style={styles.hubChallengeTitle} numberOfLines={2}>
                                                        {r.perkTitle}
                                                    </Text>
                                                    <Text style={styles.hubChallengeMeta}>
                                                        {r.status === 'LOCKED'
                                                          ? t('perkWallet.statusLocked')
                                                          : `${t('perk.rewardExpires')} ${r.expiresAt.slice(0, 10)}`}
                                                    </Text>
                                                </View>
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.redeemMiniBtn,
                                                        pressed && styles.ctaPressed,
                                                    ]}
                                                    onPress={() => navigation.navigate('PerkWallet')}
                                                >
                                                    <Text style={styles.redeemMiniBtnText}>
                                                        {t('venueHub.perkWalletCta')}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                    <Pressable
                                        style={({ pressed }) => [styles.link, styles.linkSpaced, pressed && styles.ctaPressed]}
                                        onPress={() => navigation.navigate('PerkWallet')}
                                    >
                                        <Text style={styles.linkText}>
                                            {t('venueHub.myRewardsSeeCrossVenue')}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={({ pressed }) => [styles.link, styles.linkSpaced, pressed && styles.ctaPressed]}
                                        onPress={() => navigation.navigate('SubmitReceipt', { venueId })}
                                    >
                                        <Text style={styles.linkText}>
                                            {t('venueHub.submitReceiptCta')}
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </>
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
                    {refreshingSocial && venuePerks.length === 0 ? (
                        <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
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


function createStyles(colors: AppColors) {
    return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxl,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    screenTitle: {
        flex: 1,
        color: colors.text,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    centerBlock: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    errorBlock: {
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxl,
    },
    errorBanner: {
        color: colors.error,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    errorInline: {
        color: colors.error,
        fontSize: 13,
        marginBottom: spacing.md,
        lineHeight: 18,
    },
    retryBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
    },
    retryBtnText: {
        color: colors.textInverse,
        fontWeight: '800',
        fontSize: 14,
    },
    heroCard: {
        borderRadius: radii.lg,
        overflow: 'hidden',
        marginBottom: spacing.lg,
    },
    heroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    heroContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    heroLogo: {
        width: 56,
        height: 56,
        borderRadius: radii.md,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroLogoText: {
        color: colors.textInverse,
        fontSize: 26,
        fontWeight: '900',
    },
    heroText: {
        flex: 1,
        minWidth: 0,
        gap: spacing.xs,
    },
    heroName: {
        color: colors.textInverse,
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    heroAddress: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: radii.pill,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    quickChipText: {
        color: colors.textInverse,
        fontSize: 13,
        fontWeight: '800',
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    featuredBox: {
        backgroundColor: colors.primaryMuted,
        borderRadius: radii.md,
        padding: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.primary,
    },
    featuredLabel: { color: colors.primary, fontSize: 11, fontWeight: '800', marginBottom: 6 },
    featuredTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    featuredBody: { color: colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
    cta: {
        alignSelf: 'flex-start',
        marginTop: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { color: colors.textInverse, fontWeight: '800', fontSize: 12 },
    moreOffers: { marginTop: spacing.sm, gap: spacing.sm },
    offerRow: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.md,
        padding: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    offerTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    offerBody: { color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
    exhausted: { color: colors.error, fontSize: 12, marginTop: 8, fontWeight: '700' },
    link: { alignSelf: 'flex-start', marginTop: 8 },
    linkText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
    partnerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    pillBtn: {
        backgroundColor: colors.primaryMuted,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.primary,
    },
    pillBtnSpaced: { marginTop: spacing.sm, alignSelf: 'flex-start' },
    pillBtnText: { color: colors.primaryDark, fontWeight: '800', fontSize: 13 },
    locationLine: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
    mapBtn: {
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.bgElevated,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    mapBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
    hubChallengeRow: {
        marginTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    hubChallengeTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    hubChallengeMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
    hubRewardHint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, fontWeight: '600' },
    rewardRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    rewardMain: { flex: 1, minWidth: 0 },
    redeemMiniBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.primary,
    },
    redeemMiniBtnText: { color: colors.textInverse, fontSize: 12, fontWeight: '800' },
    linkSpaced: { marginTop: spacing.sm },
    friendsLine: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: spacing.md },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    friendMain: { flex: 1, minWidth: 0 },
    friendName: { color: colors.text, fontSize: 13, fontWeight: '800' },
    friendMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    herePill: {
        color: colors.success,
        fontSize: 10,
        fontWeight: '800',
        backgroundColor: colors.successMuted,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.sm,
        overflow: 'hidden',
        alignSelf: 'flex-start',
    },
    friendMetaText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
    reportBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: radii.md,
        backgroundColor: colors.bgElevated,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    reportText: { color: colors.error, fontSize: 11, fontWeight: '800' },
    metaLine: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    badge: {
        backgroundColor: colors.successMuted,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.pill,
    },
    badgeText: { color: colors.success, fontSize: 11, fontWeight: '800' },
    perkRow: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    perkTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', flex: 1 },
    perkPill: {
        color: colors.success,
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: colors.successMuted,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.sm,
        overflow: 'hidden',
    },
    muted: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
    mutedSmall: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    feedRow: {
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    feedLine: { color: colors.text, fontSize: 12, fontWeight: '700' },
    feedSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    appealBtn: {
        alignSelf: 'stretch',
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.warningBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.warningBorder,
        alignItems: 'center',
    },
    appealText: { color: colors.warning, fontWeight: '800', fontSize: 13 },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    leaderboardRank: {
        width: 28,
        color: colors.textMuted,
        fontWeight: '800',
        fontSize: 14,
    },
    leaderboardName: {
        flex: 1,
        color: colors.text,
        fontWeight: '700',
        fontSize: 14,
    },
    leaderboardXp: {
        color: colors.primary,
        fontWeight: '800',
        fontSize: 13,
    },
    });
}

