import { useAuth, useUser } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import HomeDashboardHeader from '../components/home/HomeDashboardHeader';
import ExplicitCheckInBanner from '../components/home/ExplicitCheckInBanner';
import HomeHeroCard from '../components/home/HomeHeroCard';
import HomeRewardsSection from '../components/home/HomeRewardsSection';
import HomeVenueDailyWordChip from '../components/home/HomeVenueDailyWordChip';
import HomeVenueStrip from '../components/home/HomeVenueStrip';
import type { FriendAtVenueRow } from '../components/home/types';
import { apiGet, apiPost } from '../lib/api';
import { needsExplicitCheckInBanner } from '../lib/explicitCheckIn';
import { emitPlatformQuestProgressChanged } from '../lib/platformQuestEvents';
import { setBackgroundApiToken } from '../lib/backgroundApiToken';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import type { Coordinates } from '../lib/locationForDetect';
import type { MeSummaryDto } from '../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../lib/onboardingStorage';
import { buildVenueAccessQuery, fetchDetectedVenue } from '../lib/venueDetectClient';
import type { TabScreenProps } from '../navigation/screenProps';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { spacing } from '../theme/tokens';

type Props = TabScreenProps<'HomeTab'>;

type Venue = { id: string; name: string; isPremium: boolean; locked?: boolean };
type VenueAccess = {
    venueId: string;
    isPremium: boolean;
    locked?: boolean;
    visitedBefore: boolean;
    subscriptionActive: boolean;
    canEnterVenueContext: boolean;
    bannedFromVenue?: boolean;
    requiresExplicitCheckIn?: boolean;
    isPhysicallyAtVenue?: boolean;
    hasExplicitCheckIn?: boolean;
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
    rewardPerkId: string | null;
    rewardTitle: string | null;
};

type VenuePublicOffer = {
    id: string;
    title: string;
    body: string | null;
    imageUrl: string | null;
    ctaUrl: string | null;
    isFeatured: boolean;
    validFrom: string | null;
    validTo: string | null;
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
    geofence?: {
        latitude: number;
        longitude: number;
        radiusMeters: number;
    };
    requiresExplicitCheckIn?: boolean;
};

type VenueDailyWordState = {
    solved: boolean;
    streak: number;
    attempts: number;
    maxAttempts: number;
};

export default function HomeScreen({ navigation }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { user } = useUser();
    const { isLoaded, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    const displayName =
        [user?.firstName, user?.primaryEmailAddress?.emailAddress].find(
            (value) => typeof value === 'string' && value.trim().length > 0,
        )?.trim() ?? t('home.guestName');

    const [detectedVenue, setDetectedVenue] = useState<Venue | null>(null);
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [loadingVenue, setLoadingVenue] = useState(true);
    const [venueError, setVenueError] = useState<string | null>(null);
    const [venueChallenges, setVenueChallenges] = useState<VenueChallenge[]>([]);
    const [meSummary, setMeSummary] = useState<MeSummaryDto | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [publicCard, setPublicCard] = useState<VenuePublicCard | null>(null);
    const [detectCoords, setDetectCoords] = useState<Coordinates | null>(null);
    const [venueDailyWord, setVenueDailyWord] = useState<VenueDailyWordState | null>(null);
    const [friendsAtVenue, setFriendsAtVenue] = useState<FriendAtVenueRow[]>([]);

    const canPlayVenueContext = Boolean(detectedVenue && access?.canEnterVenueContext);
    const canPlayGlobal = Boolean(meSummary?.subscriptionActive);
    const gamesPlayable = canPlayVenueContext || canPlayGlobal;

    const loadMeSummary = useCallback(async () => {
        if (!isLoaded) return;
        setLoadingSummary(true);
        try {
            const token = await getTokenRef.current();
            if (!token) {
                setMeSummary(null);
                void setBackgroundApiToken(null);
                return;
            }
            void setBackgroundApiToken(token);
            const s = await apiGet<MeSummaryDto>('/players/me/summary', token);
            await syncOnboardingFromServerSummary(s);
            setMeSummary(s);
        } catch {
            setMeSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    }, [isLoaded]);

    useFocusEffect(
        useCallback(() => {
            void loadMeSummary();
        }, [loadMeSummary]),
    );

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setLoadingVenue(true);
            setVenueError(null);

            try {
                const { venue, coords } = await fetchDetectedVenue();
                if (cancelled) return;
                setDetectedVenue(venue);
                setDetectCoords(coords);

                if (!venue) {
                    setAccess(null);
                    return;
                }

                if (!isLoaded) return;

                const token = await getTokenRef.current();
                if (!token) throw new Error('Not authenticated');

                const accessQs = buildVenueAccessQuery(coords);
                const a = await apiGet<VenueAccess>(
                    `/venue-context/${encodeURIComponent(venue.id)}/access${accessQs}`,
                    token,
                );
                if (cancelled) return;
                setAccess(a);
            } catch (e) {
                if (cancelled) return;
                setVenueError(
                    isLikelyNetworkFailure(e)
                        ? t('home.venueErrorNetwork')
                        : (e as Error).message || t('home.loadVenueError'),
                );
            } finally {
                if (!cancelled) setLoadingVenue(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [isLoaded, t]);

    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!detectedVenue) {
                setPublicCard(null);
                return;
            }
            try {
                const card = await apiGet<VenuePublicCard>(
                    `/venues/${encodeURIComponent(detectedVenue.id)}/public-card`,
                );
                if (!cancelled) {
                    setPublicCard({
                        ...card,
                        offers: Array.isArray(card.offers) ? card.offers : [],
                    });
                }
            } catch {
                if (!cancelled) setPublicCard(null);
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
            if (!detectedVenue) {
                setVenueChallenges([]);
                return;
            }

            if (!access?.canEnterVenueContext) {
                setVenueChallenges([]);
                return;
            }

            if (!isLoaded) return;

            try {
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
            }
        }

        run();

        return () => {
            cancelled = true;
        };
    }, [access?.canEnterVenueContext, detectedVenue?.id, isLoaded]);

    const loadRetention = useCallback(async () => {
        if (!detectedVenue?.id || !access?.canEnterVenueContext || !isLoaded) {
            setVenueDailyWord(null);
            setFriendsAtVenue([]);
            return;
        }

        try {
            const token = await getTokenRef.current();
            if (!token) return;

            const venueId = detectedVenue.id;
            const dailyQs = new URLSearchParams({
                scope: 'venue',
                venueId,
            });
            if (detectCoords) {
                dailyQs.set('lat', String(detectCoords.lat));
                dailyQs.set('lng', String(detectCoords.lng));
            }

            const [daily, friendsPayload] = await Promise.all([
                detectCoords
                    ? apiGet<VenueDailyWordState>(
                          `/words/daily?${dailyQs.toString()}`,
                          token,
                      ).catch(() => null)
                    : Promise.resolve(null),
                apiGet<{ friends: FriendAtVenueRow[] }>(
                    `/social/venues/${encodeURIComponent(venueId)}/friends-at-venue`,
                    token,
                ).catch(() => ({ friends: [] })),
            ]);

            setVenueDailyWord(
                daily
                    ? {
                          solved: daily.solved,
                          streak: daily.streak,
                          attempts: daily.attempts,
                          maxAttempts: daily.maxAttempts,
                      }
                    : null,
            );
            setFriendsAtVenue(
                Array.isArray(friendsPayload.friends)
                    ? friendsPayload.friends.filter((f) => f.hereNow)
                    : [],
            );
        } catch {
            setVenueDailyWord(null);
            setFriendsAtVenue([]);
        }
    }, [access?.canEnterVenueContext, detectCoords, detectedVenue?.id, isLoaded]);

    useFocusEffect(
        useCallback(() => {
            void loadRetention();
        }, [loadRetention]),
    );

    useEffect(() => {
        void loadRetention();
    }, [loadRetention]);

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
                if (venueId) {
                    emitPlatformQuestProgressChanged();
                }
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
        if (!gamesPlayable) return;
        if (canPlayVenueContext && detectedVenue?.id) {
            const activeChallenge = venueChallenges.find((c) => !c.isCompleted) ?? venueChallenges[0];
            navigation.navigate('PlayTab', {
                venueId: detectedVenue.id,
                challengeId: activeChallenge?.id,
            });
            return;
        }
        if (canPlayGlobal) {
            navigation.navigate('PlayTab', {});
        }
    };

    const openVenueHub = () => {
        if (!detectedVenue) return;
        navigation.navigate('VenueHub', {
            venueId: detectedVenue.id,
            venueName: detectedVenue.name,
        });
    };

    const streak = venueDailyWord?.streak ?? 0;
    const showCheckInBanner = needsExplicitCheckInBanner(access);
    const openQrCheckIn = useCallback(() => {
        if (!detectedVenue) return;
        navigation.navigate('QrScan', { venueId: detectedVenue.id });
    }, [detectedVenue, navigation]);

    const rewardOffers = useMemo(
        () => (publicCard?.offers ?? []).filter((o) => !o.globallyExhausted).slice(0, 8),
        [publicCard?.offers],
    );

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <HomeDashboardHeader
                    colors={colors}
                    displayName={displayName}
                    avatarUrl={user?.imageUrl}
                    xp={meSummary?.xp ?? null}
                    loadingXp={loadingSummary}
                    onSettings={() => navigation.navigate('Settings')}
                    onDiscover={() => navigation.navigate('DiscoverHub')}
                />

                <HomeVenueStrip
                    colors={colors}
                    loading={loadingVenue}
                    error={venueError}
                    venue={detectedVenue}
                    access={access}
                    menuUrl={publicCard?.menuUrl ?? null}
                    needsCheckIn={showCheckInBanner}
                    onVenuePress={openVenueHub}
                    onFindVenues={() => navigation.navigate('VenuesTab')}
                    onCheckIn={openQrCheckIn}
                />

                {showCheckInBanner ? (
                    <ExplicitCheckInBanner colors={colors} onScan={openQrCheckIn} />
                ) : null}

                {venueDailyWord && detectedVenue && access?.canEnterVenueContext ? (
                    <HomeVenueDailyWordChip
                        colors={colors}
                        streak={venueDailyWord.streak}
                        solved={venueDailyWord.solved}
                        attempts={venueDailyWord.attempts}
                        maxAttempts={venueDailyWord.maxAttempts}
                        onPress={() => navigation.navigate('DailyWord')}
                    />
                ) : null}

                {access?.bannedFromVenue && detectedVenue ? (
                    <Pressable
                        onPress={() =>
                            navigation.navigate('BanAppeal', {
                                venueId: detectedVenue!.id,
                                venueName: detectedVenue!.name,
                            })
                        }
                        style={({ pressed }) => [styles.banBanner, pressed && styles.pressed]}
                        accessibilityRole="button"
                    >
                        <Text style={styles.banBannerText}>{t('home.banAppealCta')}</Text>
                    </Pressable>
                ) : null}

                <HomeHeroCard
                    colors={colors}
                    displayName={displayName}
                    streak={streak}
                    friendsHere={friendsAtVenue}
                    disabled={loadingVenue || !gamesPlayable}
                    onPlay={handlePlay}
                />

                <HomeRewardsSection
                    colors={colors}
                    lifetimeXp={meSummary?.xp ?? null}
                    offers={rewardOffers}
                    onSeeAll={() => {
                        if (detectedVenue) {
                            openVenueHub();
                        } else {
                            navigation.navigate('RewardsHub');
                        }
                    }}
                    onOfferPress={() => openVenueHub()}
                    onBrowseVenues={() => navigation.navigate('VenuesTab')}
                />
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
            gap: spacing.lg,
        },
        banBanner: {
            backgroundColor: colors.warningBg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.warningBorder,
            borderRadius: 12,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
        },
        banBannerText: {
            color: colors.warning,
            fontSize: 13,
            fontWeight: '800',
            textAlign: 'center',
        },
        pressed: { opacity: 0.9 },
    });
}
