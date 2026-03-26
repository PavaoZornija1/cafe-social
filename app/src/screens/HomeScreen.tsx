import { useAuth, useUser } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { openOrderingOrMenu } from '../lib/openOrderingLinks';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Venue = { id: string; name: string; isPremium: boolean };
type VenueAccess = {
    venueId: string;
    isPremium: boolean;
    hasQrUnlock: boolean;
    subscriptionActive: boolean;
    canEnterVenueContext: boolean;
};

type VenueChallenge = {
    id: string;
    title: string;
    description: string | null;
    rewardVenueSpecific: boolean;
    locationRequired: boolean;
    targetCount: number;
    progressCount: number;
    isCompleted: boolean;
    resetsWeekly?: boolean;
};

type VenueFeedItem = {
    id: string;
    kind: string;
    title: string;
    subtitle: string | null;
    actorUsername: string | null;
    createdAt: string;
};

type MeSummary = {
    playerId?: string;
    xp: number;
    tier: string;
    completedChallenges: number;
    venuesUnlocked: number;
};

type VenuePublicCard = {
    id: string;
    name: string;
    menuUrl: string | null;
    orderingUrl: string | null;
    featuredOffer: {
        title: string | null;
        body: string | null;
        endsAt: string | null;
    } | null;
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

export default function HomeScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const { user } = useUser();
    const { isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    const displayName =
        user?.firstName ||
        user?.primaryEmailAddress?.emailAddress ||
        t('home.guestName');

    const [detectedVenue, setDetectedVenue] = useState<Venue | null>(null);
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [loadingVenue, setLoadingVenue] = useState(true);
    const [venueError, setVenueError] = useState<string | null>(null);
    const qrPromptShownRef = useRef(false);
    const [venueChallenges, setVenueChallenges] = useState<VenueChallenge[]>([]);
    const [loadingChallenges, setLoadingChallenges] = useState(false);
    const [meSummary, setMeSummary] = useState<MeSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [venueFeed, setVenueFeed] = useState<VenueFeedItem[]>([]);
    const [loadingFeed, setLoadingFeed] = useState(false);
    const [publicCard, setPublicCard] = useState<VenuePublicCard | null>(null);
    const [loadingPublicCard, setLoadingPublicCard] = useState(false);
    const [friendsVisit, setFriendsVisit] = useState<FriendsVisitSummary | null>(null);
    const [loadingFriendsVisit, setLoadingFriendsVisit] = useState(false);
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [loadingEngagement, setLoadingEngagement] = useState(false);

    const scale = useRef(new Animated.Value(1)).current;
    const animateIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 30,
            bounciness: 6,
        }).start();
    };
    const animateOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 24,
            bounciness: 8,
        }).start();
    };

    const locked = useMemo(() => {
        if (!access) return false;
        return !access.canEnterVenueContext;
    }, [access]);

    const loadMeSummary = useCallback(async () => {
        if (!isLoaded) return;
        setLoadingSummary(true);
        try {
            const token = await getTokenRef.current();
            if (!token) {
                setMeSummary(null);
                return;
            }
            const s = await apiGet<MeSummary>('/players/me/summary', token);
            setMeSummary(s);
        } catch {
            setMeSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    }, [isLoaded]);

    const loadEngagement = useCallback(async () => {
        if (!isLoaded) return;
        setLoadingEngagement(true);
        try {
            const token = await getTokenRef.current();
            if (!token) {
                setEngagement(null);
                return;
            }
            const e = await apiGet<Engagement>('/players/me/engagement', token);
            setEngagement(e);
        } catch {
            setEngagement(null);
        } finally {
            setLoadingEngagement(false);
        }
    }, [isLoaded]);

    useFocusEffect(
        useCallback(() => {
            void loadMeSummary();
            void loadEngagement();
        }, [loadMeSummary, loadEngagement]),
    );

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setLoadingVenue(true);
            setVenueError(null);

            try {
                const detected = await fetchDetectedVenue();
                if (cancelled) return;
                setDetectedVenue(detected);

                if (!detected) {
                    setAccess(null);
                    return;
                }

                if (!isLoaded) return;

                const token = await getTokenRef.current();
                if (!token) throw new Error('Not authenticated');

                const a = await apiGet<VenueAccess>(
                    `/venue-context/${encodeURIComponent(detected.id)}/access`,
                    token,
                );
                if (cancelled) return;
                setAccess(a);

                if (a && !a.canEnterVenueContext && !qrPromptShownRef.current) {
                    qrPromptShownRef.current = true;
                    navigation.navigate('QrScan', { venueId: detected.id });
                }
            } catch (e) {
                if (cancelled) return;
                setVenueError((e as Error).message || t('home.loadVenueError'));
            } finally {
                if (!cancelled) setLoadingVenue(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [isLoaded, navigation, t]);

    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!detectedVenue) {
                setPublicCard(null);
                return;
            }
            setLoadingPublicCard(true);
            try {
                const card = await apiGet<VenuePublicCard>(
                    `/venues/${encodeURIComponent(detectedVenue.id)}/public-card`,
                );
                if (!cancelled) setPublicCard(card);
            } catch {
                if (!cancelled) setPublicCard(null);
            } finally {
                if (!cancelled) setLoadingPublicCard(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
        };
    }, [detectedVenue?.id]);

    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!detectedVenue || !isLoaded) {
                setFriendsVisit(null);
                return;
            }
            setLoadingFriendsVisit(true);
            try {
                const token = await getTokenRef.current();
                if (!token) {
                    setFriendsVisit(null);
                    return;
                }
                const s = await apiGet<FriendsVisitSummary>(
                    `/social/venues/${encodeURIComponent(detectedVenue.id)}/friends-visit-summary`,
                    token,
                );
                if (!cancelled) setFriendsVisit(s);
            } catch {
                if (!cancelled) setFriendsVisit(null);
            } finally {
                if (!cancelled) setLoadingFriendsVisit(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
        };
    }, [detectedVenue?.id, isLoaded]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!detectedVenue) {
                setVenueChallenges([]);
                return;
            }

            // User should not see challenges until the venue context is unlocked.
            if (!access?.canEnterVenueContext) {
                setVenueChallenges([]);
                return;
            }

            if (!isLoaded) return;

            try {
                setLoadingChallenges(true);
                const token = await getTokenRef.current();
                if (!token) throw new Error('Not authenticated');

                const list = await apiGet<VenueChallenge[]>(
                    `/venue-context/${encodeURIComponent(detectedVenue.id)}/challenges`,
                    token,
                );
                if (cancelled) return;
                setVenueChallenges(list);
            } catch {
                if (cancelled) return;
                setVenueChallenges([]);
            } finally {
                if (!cancelled) setLoadingChallenges(false);
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [access?.canEnterVenueContext, detectedVenue?.id, isLoaded]);

    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!detectedVenue || !access?.canEnterVenueContext || !isLoaded) {
                setVenueFeed([]);
                return;
            }
            try {
                setLoadingFeed(true);
                const token = await getTokenRef.current();
                if (!token) return;
                const list = await apiGet<VenueFeedItem[]>(
                    `/social/venues/${encodeURIComponent(detectedVenue.id)}/feed?limit=15`,
                    token,
                );
                if (!cancelled) setVenueFeed(list);
            } catch {
                if (!cancelled) setVenueFeed([]);
            } finally {
                if (!cancelled) setLoadingFeed(false);
            }
        }
        void run();
        return () => {
            cancelled = true;
        };
    }, [access?.canEnterVenueContext, detectedVenue?.id, isLoaded]);

    useEffect(() => {
        let cancelled = false;
        async function presence() {
            if (!isLoaded) return;
            try {
                const token = await getTokenRef.current();
                if (!token || cancelled) return;
                const venueId = detectedVenue?.id ?? null;
                await apiPost(
                    '/social/me/presence',
                    { venueId: venueId ?? null },
                    token,
                );
            } catch {
                /* non-blocking */
            }
        }
        void presence();
        return () => {
            cancelled = true;
        };
    }, [detectedVenue?.id, isLoaded]);

    const handlePlay = () => {
        const activeChallenge = venueChallenges.find((c) => !c.isCompleted) ?? venueChallenges[0];
        navigation.navigate('ChooseGame', {
          venueId: detectedVenue?.id,
          challengeId: activeChallenge?.id,
        });
    };

    const badgeLabel = (key: string): string => {
        if (key === 'regular_this_week') return t('home.badgeRegularWeek');
        if (key === 'venue_explorer') return t('home.badgeVenueExplorer');
        return key;
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.screen}>
                <View style={styles.header}>
                    <View style={styles.leftHeader}>
                        {user?.imageUrl ? (
                            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarFallbackText}>👤</Text>
                            </View>
                        )}
                        <View style={styles.headerText}>
                            <Text style={styles.appTitle}>{t('home.appTitle')}</Text>
                            <Text style={styles.welcome}>
                                {t('home.welcome', { name: displayName })}
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => navigation.navigate('Settings')}
                        style={styles.settingsBtn}
                    >
                        <Text style={styles.settingsIcon}>⚙️</Text>
                    </Pressable>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>{t('home.statXp')}</Text>
                        <Text style={styles.statValue}>
                            {loadingSummary ? '…' : meSummary?.xp ?? '—'}
                        </Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>{t('home.statTier')}</Text>
                        <Text style={styles.statValue}>
                            {loadingSummary ? '…' : meSummary?.tier ?? '—'}
                        </Text>
                    </View>
                </View>

                <View style={styles.contextCard}>
                    <Text style={styles.cardTitle}>{t('home.currentVenue')}</Text>
                    {loadingVenue ? (
                        <View style={styles.contextLoading}>
                            <ActivityIndicator color="#a78bfa" />
                            <Text style={styles.cardSub}>{t('home.detectingVenue')}</Text>
                        </View>
                    ) : venueError ? (
                        <Text style={styles.cardSubError}>{venueError}</Text>
                    ) : detectedVenue ? (
                        <View>
                            <Text style={styles.contextName}>
                                {detectedVenue.name}
                                {detectedVenue.isPremium ? t('home.premiumSuffix') : ''}
                            </Text>
                            {locked ? (
                                <Text style={styles.lockedHint}>{t('home.lockedHint')}</Text>
                            ) : (
                                <Text style={styles.unlockedHint}>{t('home.unlockedHint')}</Text>
                            )}
                        </View>
                    ) : (
                        <Text style={styles.cardSub}>{t('home.noVenueYet')}</Text>
                    )}
                </View>

                {detectedVenue ? (
                    <View style={styles.partnerCard}>
                        <Text style={styles.partnerTitle}>
                            {t('home.partnerOffers', { name: detectedVenue.name })}
                        </Text>
                        {loadingPublicCard && !publicCard ? (
                            <ActivityIndicator color="#a78bfa" style={{ marginVertical: 10 }} />
                        ) : null}
                        {publicCard?.featuredOffer?.title ? (
                            <View style={styles.featuredBox}>
                                <Text style={styles.featuredLabel}>{t('home.featuredOffer')}</Text>
                                <Text style={styles.featuredTitle}>{publicCard.featuredOffer.title}</Text>
                                {publicCard.featuredOffer.body ? (
                                    <Text style={styles.featuredBody}>{publicCard.featuredOffer.body}</Text>
                                ) : null}
                            </View>
                        ) : null}
                        {publicCard ? (
                            <View style={styles.partnerLinks}>
                                {publicCard.orderingUrl?.trim() ? (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.partnerLinkBtn,
                                            pressed && styles.quickLinkPressed,
                                        ]}
                                        onPress={() =>
                                            void openOrderingOrMenu(publicCard.orderingUrl, null)
                                        }
                                    >
                                        <Text style={styles.partnerLinkText}>{t('home.openOrdering')}</Text>
                                    </Pressable>
                                ) : null}
                                {publicCard.menuUrl?.trim() ? (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.partnerLinkBtn,
                                            pressed && styles.quickLinkPressed,
                                        ]}
                                        onPress={() =>
                                            void openOrderingOrMenu(null, publicCard.menuUrl)
                                        }
                                    >
                                        <Text style={styles.partnerLinkText}>{t('home.openMenu')}</Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        ) : null}
                        {friendsVisit && friendsVisit.friendsWithVisitsLast30Days > 0 ? (
                            <Text style={styles.friendsVenueLine}>
                                {loadingFriendsVisit
                                    ? '…'
                                    : t('home.friendsVisitedVenue', {
                                          count: friendsVisit.friendsWithVisitsLast30Days,
                                      })}
                            </Text>
                        ) : null}
                        {engagement && !loadingEngagement ? (
                            <View style={styles.engagementRow}>
                                <Text style={styles.engagementMeta}>
                                    {t('home.visitsThisWeek', { n: engagement.visitsThisWeek })}
                                </Text>
                                <View style={styles.badgeRow}>
                                    {engagement.badges.map((b) => (
                                        <View key={b} style={styles.badgeChip}>
                                            <Text style={styles.badgeChipText}>{badgeLabel(b)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <View style={styles.quickLinks}>
                    <Pressable
                        style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
                        onPress={() => navigation.navigate('Friends')}
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkFriends')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
                        onPress={() => navigation.navigate('Parties')}
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkParties')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.quickLink,
                            pressed && styles.quickLinkPressed,
                            !detectedVenue && styles.quickLinkDisabled,
                        ]}
                        disabled={!detectedVenue}
                        onPress={() =>
                            navigation.navigate('PeopleHere', {
                                venueId: detectedVenue!.id,
                                venueName: detectedVenue!.name,
                            })
                        }
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkPeopleHere')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
                        onPress={() => navigation.navigate('RedeemInvite', {})}
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkRedeemInvite')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
                        onPress={() => navigation.navigate('DailyWord')}
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkDailyWord')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.quickLink,
                            pressed && styles.quickLinkPressed,
                            !detectedVenue && styles.quickLinkDisabled,
                        ]}
                        disabled={!detectedVenue}
                        onPress={() =>
                            navigation.navigate('RedeemPerk', { venueId: detectedVenue!.id })
                        }
                    >
                        <Text style={styles.quickLinkText}>{t('home.linkRedeemPerk')}</Text>
                    </Pressable>
                </View>

                {detectedVenue && access?.canEnterVenueContext ? (
                    <View style={styles.feedCard}>
                        <Text style={styles.feedTitle}>{t('home.venueFeedTitle')}</Text>
                        {loadingFeed ? (
                            <ActivityIndicator color="#a78bfa" style={{ marginVertical: 8 }} />
                        ) : venueFeed.length === 0 ? (
                            <Text style={styles.feedEmpty}>{t('home.venueFeedEmpty')}</Text>
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

                <View style={styles.challengeBar}>
                    <Text style={styles.challengeTitle}>{t('home.challengeTitle')}</Text>
                    <Text style={styles.challengeText}>
                        {locked
                            ? t('home.unlockToStart')
                            : loadingChallenges
                                ? t('home.loadingChallenge')
                                : venueChallenges[0]
                                    ? venueChallenges[0].resetsWeekly
                                        ? t('home.challengeProgressWeekly', {
                                              title: venueChallenges[0].title,
                                              current: venueChallenges[0].progressCount,
                                              target: venueChallenges[0].targetCount,
                                          })
                                        : t('home.challengeProgress', {
                                              title: venueChallenges[0].title,
                                              current: venueChallenges[0].progressCount,
                                              target: venueChallenges[0].targetCount,
                                          })
                                    : t('home.noChallenges')}
                    </Text>
                </View>

                <View style={styles.playArea}>
                    <AnimatedPressable
                        onPress={handlePlay}
                        onPressIn={animateIn}
                        onPressOut={animateOut}
                        disabled={loadingVenue}
                        style={[
                            styles.playButton,
                            { transform: [{ scale }] },
                            loadingVenue && styles.playButtonDisabled,
                        ]}
                    >
                        <Text style={styles.playText}>
                            {t('home.play')}
                        </Text>
                    </AnimatedPressable>

                    {locked && detectedVenue?.id && (
                        <Pressable
                            onPress={() => navigation.navigate('QrScan', { venueId: detectedVenue.id })}
                            style={styles.scanBtn}
                        >
                            <Text style={styles.scanBtnText}>{t('home.scanQrUnlock')}</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.bottomNav}>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Challenges')}
                    >
                        <Text style={styles.navText}>{t('home.navChallenges')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Leaderboard')}
                    >
                        <Text style={styles.navText}>{t('home.navLeaderboard')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Profile')}
                    >
                        <Text style={styles.navText}>{t('home.navProfile')}</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Settings')}
                    >
                        <Text style={styles.navText}>{t('home.navSettings')}</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#050816' },
    screen: {
        flex: 1,
        backgroundColor: '#050816',
        paddingHorizontal: 24,
    },
    header: {
        paddingTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    leftHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#111827' },
    avatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#111827',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: { fontSize: 18 },
    headerText: { flexDirection: 'column' },
    appTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
    welcome: { color: '#d4d4d8', fontSize: 13, marginTop: 2 },
    settingsBtn: {
        padding: 10,
        borderRadius: 14,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    settingsIcon: { fontSize: 16 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    statCard: {
        flex: 1,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
        borderRadius: 16,
        padding: 14,
    },
    statLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
    statValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 6 },
    contextCard: {
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    cardTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
    contextLoading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8 },
    cardSub: { marginTop: 8, color: '#9ca3af', fontSize: 13 },
    cardSubError: { marginTop: 8, color: '#f87171', fontSize: 13 },
    contextName: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 10 },
    lockedHint: { marginTop: 8, color: '#fca5a5', fontSize: 13, fontWeight: '700' },
    unlockedHint: { marginTop: 8, color: '#a78bfa', fontSize: 13, fontWeight: '700' },
    partnerCard: {
        backgroundColor: '#0b1220',
        borderWidth: 1,
        borderColor: '#312e81',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    partnerTitle: { color: '#e9d5ff', fontSize: 13, fontWeight: '900' },
    featuredBox: {
        marginTop: 12,
        backgroundColor: '#111827',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#4c1d95',
    },
    featuredLabel: { color: '#c4b5fd', fontSize: 11, fontWeight: '800', marginBottom: 6 },
    featuredTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
    featuredBody: { color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 18 },
    partnerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    partnerLinkBtn: {
        backgroundColor: '#312e81',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    partnerLinkText: { color: '#e9d5ff', fontWeight: '800', fontSize: 13 },
    friendsVenueLine: { color: '#93c5fd', fontSize: 12, marginTop: 12, fontWeight: '700' },
    engagementRow: { marginTop: 12 },
    engagementMeta: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    badgeChip: {
        backgroundColor: '#14532d',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeChipText: { color: '#bbf7d0', fontSize: 11, fontWeight: '800' },
    quickLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    quickLink: {
        flexGrow: 1,
        minWidth: '30%',
        backgroundColor: '#0b1220',
        borderWidth: 1,
        borderColor: '#1e3a5f',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    quickLinkPressed: { opacity: 0.88 },
    quickLinkDisabled: { opacity: 0.45 },
    quickLinkText: { color: '#93c5fd', fontWeight: '800', fontSize: 11, textAlign: 'center' },
    feedCard: {
        backgroundColor: '#0b1220',
        borderWidth: 1,
        borderColor: '#182238',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    feedTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginBottom: 8 },
    feedEmpty: { color: '#64748b', fontSize: 12 },
    feedRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    feedLine: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
    feedSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
    challengeBar: {
        backgroundColor: '#0b1220',
        borderWidth: 1,
        borderColor: '#182238',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    challengeTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
    challengeText: { color: '#9ca3af', fontSize: 13, marginTop: 8, lineHeight: 18 },
    playArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingBottom: 10,
    },
    playButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#7c3aed',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7c3aed',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        transform: [{ scale: 1 }],
    },
    playButtonDisabled: { opacity: 0.55 },
    playText: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: 1,
    },
    scanBtn: {
        backgroundColor: '#111827',
        borderColor: '#1f2937',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    scanBtnText: { color: '#a5b4fc', fontWeight: '800' },
    bottomNav: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 10,
        paddingBottom: 18,
    },
    navItem: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1f2937',
        paddingVertical: 14,
        alignItems: 'center',
    },
    navItemPressed: { opacity: 0.85 },
    navText: { color: '#f9fafb', fontWeight: '900', fontSize: 12 },
});