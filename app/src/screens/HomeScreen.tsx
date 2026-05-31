import { useAuth, useUser } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { setBackgroundApiToken } from '../lib/backgroundApiToken';
import type { MeSummaryDto } from '../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../lib/onboardingStorage';
import { buildVenueAccessQuery, fetchDetectedVenue } from '../lib/venueDetectClient';
import type { Coordinates } from '../lib/locationForDetect';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function daysUntilExpiry(iso: string): number {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

type RetentionActionRowProps = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle: string;
    onPress: () => void;
    accessibilityLabel: string;
    accent?: boolean;
    badge?: string;
    colors: AppColors;
    styles: {
        retentionActionRow: object;
        retentionActionRowAccent: object;
        retentionCardPressed: object;
        retentionActionIcon: object;
        retentionActionIconAccent: object;
        retentionActionText: object;
        retentionActionTitleRow: object;
        retentionActionTitle: object;
        retentionActionBadge: object;
        retentionActionBadgeText: object;
        retentionActionSubtitle: object;
    };
};

function RetentionActionRow({
    icon,
    title,
    subtitle,
    onPress,
    accessibilityLabel,
    accent,
    badge,
    colors,
    styles,
}: RetentionActionRowProps) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.retentionActionRow,
                accent && styles.retentionActionRowAccent,
                pressed && styles.retentionCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <View style={[styles.retentionActionIcon, accent && styles.retentionActionIconAccent]}>
                <Ionicons name={icon} size={18} color={accent ? colors.honeyDark : colors.honey} />
            </View>
            <View style={styles.retentionActionText}>
                <View style={styles.retentionActionTitleRow}>
                    <Text style={styles.retentionActionTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    {badge ? (
                        <View style={styles.retentionActionBadge}>
                            <Text style={styles.retentionActionBadgeText}>{badge}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.retentionActionSubtitle} numberOfLines={2}>
                    {subtitle}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
    );
}

type Venue = { id: string; name: string; isPremium: boolean; locked?: boolean };
type VenueAccess = {
    venueId: string;
    isPremium: boolean;
    /** Present when venue is admin-locked (no play). */
    locked?: boolean;
    visitedBefore: boolean;
    subscriptionActive: boolean;
    canEnterVenueContext: boolean;
    /** Staff moderation ban at this venue — blocks venue play and redemptions. */
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

type VenueRedeemableReward = {
    redemptionId: string;
    perkTitle: string;
    status: string;
    expiresAt: string;
};

type VenueFeedItem = {
    id: string;
    kind: string;
    title: string;
    subtitle: string | null;
    actorUsername: string | null;
    createdAt: string;
};

type VenueEngagement = {
    visitsThisWeek: number;
    distinctVenuesVisitedLast30Days: number;
    badges: string[];
    atVenue?: {
        visitDaysLast30Days: number;
        visitDaysThisWeek: number;
    };
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
        user?.firstName ||
        user?.primaryEmailAddress?.emailAddress ||
        t('home.guestName');

    const [detectedVenue, setDetectedVenue] = useState<Venue | null>(null);
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [loadingVenue, setLoadingVenue] = useState(true);
    const [venueError, setVenueError] = useState<string | null>(null);
    const [venueChallenges, setVenueChallenges] = useState<VenueChallenge[]>([]);
    const [loadingChallenges, setLoadingChallenges] = useState(false);
    const [meSummary, setMeSummary] = useState<MeSummaryDto | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [publicCard, setPublicCard] = useState<VenuePublicCard | null>(null);
    const [detectCoords, setDetectCoords] = useState<Coordinates | null>(null);
    const [venueEngagement, setVenueEngagement] = useState<VenueEngagement | null>(null);
    const [venueRewards, setVenueRewards] = useState<VenueRedeemableReward[]>([]);
    const [venueFeed, setVenueFeed] = useState<VenueFeedItem[]>([]);
    const [venueDailyWord, setVenueDailyWord] = useState<VenueDailyWordState | null>(null);
    const [loadingRetention, setLoadingRetention] = useState(false);

    const scale = useRef(new Animated.Value(1)).current;
    const unlockPulse = useRef(new Animated.Value(1)).current;
    const playScale = Animated.multiply(scale, unlockPulse);
    const prevLockedRef = useRef<boolean | null>(null);

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

    useEffect(() => {
        if (loadingVenue) return;
        const was = prevLockedRef.current;
        if (was === true && !locked) {
            unlockPulse.setValue(1);
            Animated.sequence([
                Animated.spring(unlockPulse, {
                    toValue: 1.07,
                    useNativeDriver: true,
                    friction: 6,
                    tension: 140,
                }),
                Animated.spring(unlockPulse, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 7,
                    tension: 120,
                }),
            ]).start();
        }
        prevLockedRef.current = locked;
    }, [locked, loadingVenue, unlockPulse]);

    const venueAdminLocked = useMemo(
        () => Boolean(access?.locked || detectedVenue?.locked),
        [access?.locked, detectedVenue?.locked],
    );

    const canPlayVenueContext = Boolean(detectedVenue && access?.canEnterVenueContext);
    const canPlayGlobal = Boolean(meSummary?.subscriptionActive);
    const gamesPlayable = canPlayVenueContext || canPlayGlobal;

    const needsExplicitCheckIn = Boolean(
        access?.requiresExplicitCheckIn &&
            access?.isPhysicallyAtVenue &&
            !access?.hasExplicitCheckIn,
    );

    const venueGamesLockedExplanation = useMemo(() => {
        if (!locked || !detectedVenue) return '';
        if (access?.bannedFromVenue) return t('home.bannedFromVenue');
        if (venueAdminLocked) return t('home.venueTemporarilyUnavailable');
        if (needsExplicitCheckIn) return t('home.explicitCheckInRequired');
        return detectedVenue.isPremium
            ? t('home.lockedHintPremium')
            : t('home.lockedHintStandard');
    }, [
        locked,
        detectedVenue,
        venueAdminLocked,
        access?.bannedFromVenue,
        needsExplicitCheckIn,
        t,
    ]);

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

    const loadRetention = useCallback(async () => {
        if (!detectedVenue?.id || !access?.canEnterVenueContext || !isLoaded) {
            setVenueEngagement(null);
            setVenueRewards([]);
            setVenueFeed([]);
            setVenueDailyWord(null);
            return;
        }

        setLoadingRetention(true);
        try {
            const token = await getTokenRef.current();
            if (!token) return;

            const venueId = detectedVenue.id;
            const engagementQs = `?venueId=${encodeURIComponent(venueId)}`;
            const dailyQs = new URLSearchParams({
                scope: 'venue',
                venueId,
            });
            if (detectCoords) {
                dailyQs.set('lat', String(detectCoords.lat));
                dailyQs.set('lng', String(detectCoords.lng));
            }

            const [engagement, rewards, feed, daily] = await Promise.all([
                apiGet<VenueEngagement>(`/players/me/engagement${engagementQs}`, token).catch(
                    () => null,
                ),
                apiGet<VenueRedeemableReward[]>(
                    `/venue-context/${encodeURIComponent(venueId)}/perks/my-rewards`,
                    token,
                ).catch(() => [] as VenueRedeemableReward[]),
                apiGet<VenueFeedItem[]>(
                    `/social/venues/${encodeURIComponent(venueId)}/feed?limit=3`,
                    token,
                ).catch(() => [] as VenueFeedItem[]),
                detectCoords
                    ? apiGet<VenueDailyWordState>(
                          `/words/daily?${dailyQs.toString()}`,
                          token,
                      ).catch(() => null)
                    : Promise.resolve(null),
            ]);

            setVenueEngagement(engagement);
            setVenueRewards(Array.isArray(rewards) ? rewards : []);
            setVenueFeed(Array.isArray(feed) ? feed : []);
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
        } finally {
            setLoadingRetention(false);
        }
    }, [
        access?.canEnterVenueContext,
        detectCoords,
        detectedVenue?.id,
        isLoaded,
    ]);

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
            navigation.navigate('ChooseGame', {
                venueId: detectedVenue.id,
                challengeId: activeChallenge?.id,
            });
            return;
        }
        if (canPlayGlobal) {
            navigation.navigate('ChooseGame', {});
        }
    };

    const showFirstVisitGuide = Boolean(
        detectedVenue && access?.canEnterVenueContext && access?.visitedBefore === false,
    );
    const featuredOffer = publicCard?.featuredOffer;
    const showFeaturedOfferCard = Boolean(
        detectedVenue &&
            featuredOffer &&
            (featuredOffer.title?.trim() || featuredOffer.body?.trim()),
    );

    const activeChallenge = useMemo(
        () => venueChallenges.find((c) => !c.isCompleted) ?? venueChallenges[0] ?? null,
        [venueChallenges],
    );

    const redeemableRewards = useMemo(
        () => venueRewards.filter((r) => r.status === 'REDEEMABLE'),
        [venueRewards],
    );

    const primaryRedeemable = useMemo(() => {
        if (redeemableRewards.length === 0) return null;
        return [...redeemableRewards].sort(
            (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
        )[0]!;
    }, [redeemableRewards]);

    const challengeProgressPct = useMemo(() => {
        if (!activeChallenge || activeChallenge.targetCount <= 0) return 0;
        return Math.min(1, activeChallenge.progressCount / activeChallenge.targetCount);
    }, [activeChallenge]);

    const showRetentionStack = Boolean(
        detectedVenue && access?.canEnterVenueContext && !loadingVenue && !venueError,
    );

    const challengeLine =
        locked
            ? venueAdminLocked
                ? t('home.venueTemporarilyUnavailableShort')
                : needsExplicitCheckIn
                  ? t('home.explicitCheckInChallengeLine')
                  : t('home.unlockToStart')
            : loadingChallenges
                ? t('home.loadingChallenge')
                : activeChallenge
                    ? activeChallenge.resetsWeekly
                        ? t('home.challengeProgressWeekly', {
                            title: activeChallenge.title,
                            current: activeChallenge.progressCount,
                            target: activeChallenge.targetCount,
                        })
                        : t('home.challengeProgress', {
                            title: activeChallenge.title,
                            current: activeChallenge.progressCount,
                            target: activeChallenge.targetCount,
                        })
                    : t('home.noChallenges');

    const venueHubOpenable = Boolean(detectedVenue && !loadingVenue && !venueError);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.screen}>
                <View style={styles.headerBlock}>
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
                            accessibilityRole="button"
                            accessibilityLabel={t('home.navSettings')}
                        >
                            <Ionicons name="settings-outline" size={22} color={colors.text} />
                        </Pressable>
                    </View>

                    <Pressable
                        disabled={!venueHubOpenable}
                        onPress={() =>
                            detectedVenue &&
                            navigation.navigate('VenueHub', {
                                venueId: detectedVenue.id,
                                venueName: detectedVenue.name,
                            })
                        }
                        style={({ pressed }) => [
                            styles.venueCapsule,
                            venueHubOpenable && pressed && styles.venueCapsulePressed,
                        ]}
                        accessibilityRole={venueHubOpenable ? 'button' : 'none'}
                        accessibilityLabel={
                            venueHubOpenable
                                ? t('home.venueHubA11y', { name: detectedVenue?.name ?? '' })
                                : undefined
                        }
                    >
                        <View style={styles.venueRow}>
                            <Ionicons name="location-sharp" size={20} color={colors.honey} />
                            <View style={styles.venueRowMain}>
                                {loadingVenue ? (
                                    <View style={styles.venueRowLoading}>
                                        <ActivityIndicator color={colors.primary} size="small" />
                                        <Text style={styles.venueRowMeta}>{t('home.detectingVenue')}</Text>
                                    </View>
                                ) : venueError ? (
                                    <View>
                                        <Text style={styles.venueRowError} numberOfLines={2}>
                                            {venueError}
                                        </Text>
                                        {!isLikelyNetworkFailure(new Error(venueError)) ? (
                                            <Text style={styles.venueRowMeta} numberOfLines={2}>
                                                {t('home.venueErrorLocationHint')}
                                            </Text>
                                        ) : null}
                                    </View>
                                ) : detectedVenue ? (
                                    <Text style={styles.venueRowName} numberOfLines={1}>
                                        {detectedVenue.name}
                                        {detectedVenue.isPremium ? t('home.premiumSuffix') : ''}
                                    </Text>
                                ) : (
                                    <View style={styles.venueRowNoVenue}>
                                        <Text style={styles.venueRowMeta} numberOfLines={1}>
                                            {t('home.noVenueShort')}
                                        </Text>
                                        <Pressable
                                            onPress={() => navigation.navigate('PartnerVenuesMap')}
                                            style={({ pressed }) => [
                                                styles.mapChip,
                                                pressed && styles.mapChipPressed,
                                            ]}
                                        >
                                            <Text style={styles.mapChipText}>{t('home.findVenuesCta')}</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
                            {venueHubOpenable ? (
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            ) : null}
                        </View>
                    </Pressable>

                    <View style={styles.statsHighlightRow}>
                        <View style={styles.statHighlightCard}>
                            <Text style={styles.statHighlightLabel}>{t('home.statXp')}</Text>
                            <Text style={styles.statHighlightValue}>
                                {loadingSummary
                                    ? '…'
                                    : meSummary == null
                                      ? '—'
                                      : meSummary.nextTierXpThreshold != null
                                        ? `${meSummary.xp} / ${meSummary.nextTierXpThreshold}`
                                        : String(meSummary.xp)}
                            </Text>
                            {!loadingSummary && meSummary ? (
                                <Text style={styles.statHighlightSub} numberOfLines={1}>
                                    {meSummary.nextTierName
                                        ? t('home.xpTowardNext', { nextTier: meSummary.nextTierName })
                                        : t('home.xpMaxTier')}
                                </Text>
                            ) : null}
                        </View>
                        <View style={styles.statHighlightCard}>
                            <Text style={styles.statHighlightLabel}>{t('home.statTier')}</Text>
                            <Text style={styles.statHighlightValue}>
                                {loadingSummary ? '…' : meSummary?.tier ?? '—'}
                            </Text>
                        </View>
                    </View>

                    {detectedVenue && !loadingVenue && !venueError && (locked || access?.bannedFromVenue) ? (
                        <View style={styles.venueStatusBlock}>
                            {locked ? (
                                <Text
                                    style={
                                        venueAdminLocked
                                            ? styles.venueStatusPaused
                                            : styles.venueStatusLocked
                                    }
                                    numberOfLines={2}
                                >
                                    {venueGamesLockedExplanation}
                                </Text>
                            ) : null}
                            {access?.bannedFromVenue ? (
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.banAppealBtnCompact,
                                        pressed && styles.banAppealBtnPressed,
                                    ]}
                                    onPress={() =>
                                        navigation.navigate('BanAppeal', {
                                            venueId: detectedVenue.id,
                                            venueName: detectedVenue.name,
                                        })
                                    }
                                >
                                    <Text style={styles.banAppealBtnText}>{t('home.banAppealCta')}</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : !detectedVenue && !loadingVenue && !venueError ? (
                        <Text style={styles.noVenueHint} numberOfLines={2}>
                            {t('home.noVenueYet')}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.body}>
                    <ScrollView
                        style={styles.bodyScroll}
                        contentContainerStyle={styles.bodyScrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {showRetentionStack ? (
                            <View style={styles.venuePanel}>
                                <Pressable
                                    onPress={() =>
                                        detectedVenue &&
                                        navigation.navigate('VenueHub', {
                                            venueId: detectedVenue.id,
                                            venueName: detectedVenue.name,
                                        })
                                    }
                                    style={({ pressed }) => [
                                        styles.venuePanelHeader,
                                        pressed && styles.retentionCardPressed,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('home.retentionPanelHubA11y', {
                                        name: detectedVenue?.name ?? '',
                                    })}
                                >
                                    <View style={styles.venuePanelHeaderText}>
                                        <Text style={styles.venuePanelKicker}>
                                            {t('home.retentionPanelKicker')}
                                        </Text>
                                        <Text style={styles.venuePanelTitle} numberOfLines={1}>
                                            {detectedVenue?.name}
                                        </Text>
                                    </View>
                                    <View style={styles.venuePanelHeaderLink}>
                                        <Text style={styles.venuePanelHubLink}>
                                            {t('home.retentionPanelHub')}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={14} color={colors.honeyDark} />
                                    </View>
                                </Pressable>

                                {venueEngagement?.atVenue || loadingRetention ? (
                                    <View style={styles.venueStatPills}>
                                        <View style={styles.venueStatPill}>
                                            <Text style={styles.venueStatPillValue}>
                                                {loadingRetention && !venueEngagement
                                                    ? '…'
                                                    : venueEngagement?.atVenue?.visitDaysThisWeek ?? 0}
                                            </Text>
                                            <Text style={styles.venueStatPillLabel}>
                                                {t('home.venueVisitDaysWeekLabel')}
                                            </Text>
                                        </View>
                                        <View style={styles.venueStatPillDivider} />
                                        <View style={styles.venueStatPill}>
                                            <Text style={styles.venueStatPillValue}>
                                                {loadingRetention && !venueEngagement
                                                    ? '…'
                                                    : venueEngagement?.atVenue?.visitDaysLast30Days ?? 0}
                                            </Text>
                                            <Text style={styles.venueStatPillLabel}>
                                                {t('home.venueVisitDays30dLabel')}
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}

                                {loadingChallenges && !activeChallenge ? (
                                    <View style={styles.venuePanelChallenge}>
                                        <ActivityIndicator color={colors.primary} size="small" />
                                    </View>
                                ) : activeChallenge ? (
                                    <View style={styles.venuePanelChallenge}>
                                        <View style={styles.venuePanelChallengeHead}>
                                            <Ionicons name="trophy-outline" size={16} color={colors.honey} />
                                            <Text style={styles.venuePanelChallengeTitle}>
                                                {t('home.challengeTitle')}
                                            </Text>
                                        </View>
                                        <Text style={styles.venuePanelChallengeBody} numberOfLines={2}>
                                            {challengeLine}
                                        </Text>
                                        {activeChallenge.rewardTitle ? (
                                            <Text style={styles.venuePanelChallengeReward} numberOfLines={1}>
                                                {t('home.challengeRewardHint', {
                                                    reward: activeChallenge.rewardTitle,
                                                })}
                                            </Text>
                                        ) : null}
                                        {activeChallenge.targetCount > 0 ? (
                                            <View style={styles.challengeProgressTrack}>
                                                <View
                                                    style={[
                                                        styles.challengeProgressFill,
                                                        {
                                                            width: `${Math.round(challengeProgressPct * 100)}%`,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        ) : null}
                                        {!activeChallenge.isCompleted ? (
                                            <Pressable
                                                onPress={handlePlay}
                                                style={({ pressed }) => [
                                                    styles.venuePanelChallengeCta,
                                                    pressed && styles.retentionCardPressed,
                                                ]}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('home.challengeContinueCta')}
                                            >
                                                <Text style={styles.venuePanelChallengeCtaText}>
                                                    {t('home.challengeContinueCta')}
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                ) : null}

                                {primaryRedeemable || venueDailyWord ? (
                                <View style={styles.venuePanelActions}>
                                    {primaryRedeemable ? (
                                        <RetentionActionRow
                                            icon="pricetag"
                                            accent
                                            title={t('home.unredeemedPerkTitle')}
                                            subtitle={
                                                redeemableRewards.length === 1
                                                    ? daysUntilExpiry(primaryRedeemable.expiresAt) <= 3
                                                        ? t('home.unredeemedPerkExpiring', {
                                                              title: primaryRedeemable.perkTitle,
                                                              days: daysUntilExpiry(
                                                                  primaryRedeemable.expiresAt,
                                                              ),
                                                          })
                                                        : primaryRedeemable.perkTitle
                                                    : t('home.unredeemedPerkCount', {
                                                          count: redeemableRewards.length,
                                                      })
                                            }
                                            badge={
                                                redeemableRewards.length > 1
                                                    ? String(redeemableRewards.length)
                                                    : undefined
                                            }
                                            onPress={() =>
                                                detectedVenue &&
                                                navigation.navigate('RedeemPerk', {
                                                    venueId: detectedVenue.id,
                                                })
                                            }
                                            accessibilityLabel={t('home.unredeemedPerkA11y')}
                                            colors={colors}
                                            styles={styles}
                                        />
                                    ) : null}

                                    {venueDailyWord ? (
                                        <RetentionActionRow
                                            icon="calendar"
                                            title={t('home.venueDailyWordTitle')}
                                            subtitle={
                                                venueDailyWord.solved
                                                    ? t('home.venueDailyWordSolved', {
                                                          streak: venueDailyWord.streak,
                                                      })
                                                    : t('home.venueDailyWordOpen', {
                                                          streak: venueDailyWord.streak,
                                                          attempts: venueDailyWord.attempts,
                                                          max: venueDailyWord.maxAttempts,
                                                      })
                                            }
                                            badge={
                                                venueDailyWord.streak > 0
                                                    ? t('home.venueDailyWordStreakBadge', {
                                                          n: venueDailyWord.streak,
                                                      })
                                                    : undefined
                                            }
                                            onPress={() => navigation.navigate('DailyWord')}
                                            accessibilityLabel={t('home.venueDailyWordA11y')}
                                            colors={colors}
                                            styles={styles}
                                        />
                                    ) : null}
                                </View>
                                ) : null}

                                {venueFeed.length > 0 ? (
                                    <View style={styles.venuePanelFeed}>
                                        <Text style={styles.venuePanelFeedTitle}>
                                            {t('home.venueFeedTitle')}
                                        </Text>
                                        {venueFeed.slice(0, 2).map((ev) => (
                                            <Text
                                                key={ev.id}
                                                style={styles.venuePanelFeedLine}
                                                numberOfLines={1}
                                            >
                                                {ev.actorUsername
                                                    ? t('home.venueFeedActor', {
                                                          user: ev.actorUsername,
                                                          action: ev.subtitle ?? ev.title,
                                                      })
                                                    : ev.title}
                                            </Text>
                                        ))}
                                    </View>
                                ) : null}

                                {loadingRetention &&
                                !venueEngagement &&
                                !activeChallenge &&
                                !primaryRedeemable &&
                                !venueDailyWord ? (
                                    <ActivityIndicator
                                        color={colors.primary}
                                        size="small"
                                        style={styles.venuePanelLoader}
                                    />
                                ) : null}

                                {!loadingRetention &&
                                !loadingChallenges &&
                                !activeChallenge &&
                                !primaryRedeemable &&
                                !venueDailyWord &&
                                venueFeed.length === 0 ? (
                                    <View style={styles.venuePanelEmptyHint}>
                                        <Text style={styles.venuePanelEmptyHintText}>
                                            {t('home.retentionPanelEmpty')}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View style={styles.challengeStrip}>
                                <Text style={styles.challengeStripTitle}>{t('home.challengeTitle')}</Text>
                                <Text style={styles.challengeStripText} numberOfLines={2}>
                                    {challengeLine}
                                </Text>
                                {activeChallenge && activeChallenge.targetCount > 0 && !locked ? (
                                    <View style={styles.challengeProgressTrack}>
                                        <View
                                            style={[
                                                styles.challengeProgressFill,
                                                {
                                                    width: `${Math.round(challengeProgressPct * 100)}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                ) : null}
                            </View>
                        )}

                        {showFeaturedOfferCard ? (
                        <View style={styles.featuredOfferCard}>
                            <Text style={styles.featuredOfferKicker}>{t('home.featuredOfferVenueKicker')}</Text>
                            {featuredOffer!.title ? (
                                <Text style={styles.featuredOfferTitle} numberOfLines={2}>
                                    {featuredOffer!.title}
                                </Text>
                            ) : null}
                            {featuredOffer!.body ? (
                                <Text style={styles.featuredOfferBody} numberOfLines={3}>
                                    {featuredOffer!.body}
                                </Text>
                            ) : null}
                            {featuredOffer!.endsAt ? (
                                <Text style={styles.featuredOfferEnds}>
                                    {t('home.featuredOfferEnds', { date: featuredOffer!.endsAt!.slice(0, 10) })}
                                </Text>
                            ) : null}
                            <View style={styles.featuredOfferActions}>
                                <Pressable
                                    onPress={() => navigation.navigate('RewardsHub')}
                                    style={({ pressed }) => [
                                        styles.featuredOfferBtn,
                                        pressed && styles.featuredOfferBtnPressed,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('home.featuredOfferRewardsCta')}
                                >
                                    <Text style={styles.featuredOfferBtnText}>
                                        {t('home.featuredOfferRewardsCta')}
                                    </Text>
                                </Pressable>
                                {access?.canEnterVenueContext && detectedVenue ? (
                                    <Pressable
                                        onPress={() =>
                                            navigation.navigate('RedeemPerk', { venueId: detectedVenue.id })
                                        }
                                        style={({ pressed }) => [
                                            styles.featuredOfferBtnSecondary,
                                            pressed && styles.featuredOfferBtnPressed,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('home.linkRedeemPerk')}
                                    >
                                        <Text style={styles.featuredOfferBtnSecondaryText}>
                                            {t('home.linkRedeemPerk')}
                                        </Text>
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    {showFirstVisitGuide ? (
                        <View style={styles.startHereCard}>
                            <Text style={styles.startHereTitle}>{t('home.startHereTitle')}</Text>
                            <Text style={styles.startHereSubtitle}>{t('home.startHereSubtitle')}</Text>
                            <View style={styles.startHereRow}>
                                <Pressable
                                    onPress={() => navigation.navigate('DailyWord')}
                                    style={({ pressed }) => [
                                        styles.startHereChip,
                                        pressed && styles.startHereChipPressed,
                                    ]}
                                >
                                    <Text style={styles.startHereChipText}>{t('home.startDailyWord')}</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        if (!detectedVenue?.id) return;
                                        const activeChallenge =
                                            venueChallenges.find((c) => !c.isCompleted) ?? venueChallenges[0];
                                        navigation.navigate('ChooseGame', {
                                            venueId: detectedVenue.id,
                                            challengeId: activeChallenge?.id,
                                        });
                                    }}
                                    style={({ pressed }) => [
                                        styles.startHereChip,
                                        pressed && styles.startHereChipPressed,
                                    ]}
                                >
                                    <Text style={styles.startHereChipText}>{t('home.startQuickPlay')}</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() =>
                                        navigation.navigate('WordLobby', {
                                            venueId: detectedVenue!.id,
                                            challengeId: venueChallenges.find((c) => !c.isCompleted)?.id,
                                        })
                                    }
                                    style={({ pressed }) => [
                                        styles.startHereChip,
                                        pressed && styles.startHereChipPressed,
                                    ]}
                                >
                                    <Text style={styles.startHereChipText}>{t('home.startWordRooms')}</Text>
                                </Pressable>
                            </View>
                            <Text style={styles.startHereSocialHint}>{t('home.startSocialHint')}</Text>
                        </View>
                    ) : null}
                    </ScrollView>

                    <View style={styles.playAreaWrap}>
                        <View style={styles.playColumn}>
                            <AnimatedPressable
                                onPress={handlePlay}
                                onPressIn={animateIn}
                                onPressOut={animateOut}
                                disabled={loadingVenue || !gamesPlayable}
                                style={[
                                    styles.playButton,
                                    { transform: [{ scale: playScale }] },
                                    (loadingVenue || !gamesPlayable) && styles.playButtonDisabled,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.play')}
                                accessibilityState={{ disabled: loadingVenue || !gamesPlayable }}
                            >
                                <Text style={styles.playText}>{t('home.play')}</Text>
                            </AnimatedPressable>
                            {/* !loadingVenue && !gamesPlayable ? (
                                <View style={styles.playLockedBlock}>
                                    <Text style={styles.playLockedHint}>
                                        {needsExplicitCheckIn
                                            ? t('home.playLockedExplicitCheckIn')
                                            : t('home.playLockedHint')}
                                    </Text> 
                                    <View style={styles.playLockedLinks}>
                                        {needsExplicitCheckIn ? (
                                            <Pressable
                                                onPress={() =>
                                                    navigation.navigate('QrScan', {
                                                        venueId: detectedVenue?.id,
                                                    })
                                                }
                                                style={({ pressed }) => [
                                                    styles.playLockedLink,
                                                    pressed && styles.playLockedLinkPressed,
                                                ]}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('home.explicitCheckInCta')}
                                            >
                                                <Text style={styles.playLockedLinkText}>
                                                    {t('home.explicitCheckInCta')}
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                        {needsExplicitCheckIn ? (
                                            <Text style={styles.playLockedSep}>·</Text>
                                        ) : null}
                                        <Pressable
                                            onPress={() => navigation.navigate('Settings')}
                                            style={({ pressed }) => [
                                                styles.playLockedLink,
                                                pressed && styles.playLockedLinkPressed,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('home.playLockedSettings')}
                                        >
                                            <Text style={styles.playLockedLinkText}>
                                                {t('home.playLockedSettings')}
                                            </Text>
                                        </Pressable>
                                        <Text style={styles.playLockedSep}>·</Text>
                                        <Pressable
                                            onPress={() => navigation.navigate('PartnerVenuesMap')}
                                            style={({ pressed }) => [
                                                styles.playLockedLink,
                                                pressed && styles.playLockedLinkPressed,
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('home.playLockedFindVenues')}
                                        >
                                            <Text style={styles.playLockedLinkText}>
                                                {t('home.playLockedFindVenues')}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : null} */}
                        </View>
                    </View>

                    <View style={styles.shortcutsArea}>
                        <View style={styles.shortcutsTopRow}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnFlex,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('DailyWord')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkDailyWord')}
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkDailyWord')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnFlex,
                                    pressed && styles.shortcutBtnPressed,
                                    !gamesPlayable && styles.shortcutBtnDisabled,
                                ]}
                                disabled={!gamesPlayable}
                                onPress={() =>
                                    navigation.navigate('WordLobby', {
                                        venueId: detectedVenue?.id,
                                        challengeId: venueChallenges.find((c) => !c.isCompleted)?.id,
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkWordRooms')}
                                accessibilityState={{ disabled: !gamesPlayable }}
                            >
                                <Ionicons name="chatbubbles-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkWordRooms')}
                                </Text>
                            </Pressable>
                        </View>

                        <View style={styles.shortcutsGrid}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('Friends')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkFriends')}
                            >
                                <Ionicons name="people-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkFriends')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('Parties')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkParties')}
                            >
                                <Ionicons name="balloon-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkParties')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('RedeemInvite', {})}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkInbox')}
                            >
                                <Ionicons name="notifications-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={2}>
                                    {t('home.linkInbox')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('PartnerVenuesMap')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkPartnerMap')}
                            >
                                <Ionicons name="map-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkPartnerMap')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                    !detectedVenue && styles.shortcutBtnDisabled,
                                ]}
                                disabled={!detectedVenue}
                                onPress={() =>
                                    navigation.navigate('PeopleHere', {
                                        venueId: detectedVenue!.id,
                                        venueName: detectedVenue!.name,
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkPeopleHere')}
                                accessibilityState={{ disabled: !detectedVenue }}
                            >
                                <Ionicons name="navigate-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkPeopleHere')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                    !detectedVenue && styles.shortcutBtnDisabled,
                                ]}
                                disabled={!detectedVenue}
                                onPress={() =>
                                    navigation.navigate('RedeemPerk', { venueId: detectedVenue!.id })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkRedeemPerk')}
                                accessibilityState={{ disabled: !detectedVenue }}
                            >
                                <Ionicons name="pricetag-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkRedeemPerk')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                ]}
                                onPress={() => navigation.navigate('RewardsHub')}
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkRewardsHub')}
                            >
                                <Ionicons name="gift-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkRewardsHub')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.shortcutBtn,
                                    styles.shortcutBtnGrid,
                                    pressed && styles.shortcutBtnPressed,
                                    !detectedVenue && styles.shortcutBtnDisabled,
                                ]}
                                disabled={!detectedVenue}
                                onPress={() =>
                                    navigation.navigate('SubmitReceipt', {
                                        venueId: detectedVenue!.id,
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={t('home.linkReceipt')}
                                accessibilityState={{ disabled: !detectedVenue }}
                            >
                                <Ionicons name="receipt-outline" size={18} color={colors.honey} />
                                <Text style={styles.shortcutLabel} numberOfLines={1}>
                                    {t('home.linkReceipt')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <View style={styles.bottomNav}>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Challenges')}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.navChallenges')}
                    >
                        <Text style={styles.navIcon} accessibilityElementsHidden>
                            <Ionicons name="trophy-outline" size={22} color={colors.primary} />
                        </Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Leaderboard')}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.navLeaderboard')}
                    >
                        <Text style={styles.navIcon} accessibilityElementsHidden>
                            <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
                        </Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('Profile')}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.navProfile')}
                    >
                        <Text style={styles.navIcon} accessibilityElementsHidden>
                            <Ionicons name="person-outline" size={22} color={colors.primary} />
                        </Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                        onPress={() => navigation.navigate('DiscoverHub')}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.navDiscoverHub')}
                    >
                        <Text style={styles.navIcon} accessibilityElementsHidden>
                            <Ionicons name="compass-outline" size={22} color={colors.primary} />
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

function createStyles(colors: AppColors) {
    return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
        paddingHorizontal: 24,
    },
    headerBlock: {
        flexShrink: 0,
        paddingBottom: 6,
    },
    header: {
        paddingTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    leftHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgElevated },
    avatarFallback: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarFallbackText: { fontSize: 18 },
    headerText: { flexDirection: 'column' },
    appTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
    welcome: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    settingsBtn: {
        padding: 10,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    venueCapsule: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 8,
        paddingHorizontal: 11,
        marginBottom: 8,
    },
    venueCapsulePressed: { opacity: 0.92 },
    venueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    venueRowMain: { flex: 1, minWidth: 0 },
    venueRowLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    venueRowMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    venueRowError: { color: colors.error, fontSize: 12, fontWeight: '600' },
    venueRowName: { color: colors.text, fontSize: 16, fontWeight: '800' },
    venueRowNoVenue: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    mapChip: {
        backgroundColor: colors.honeyMuted,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    mapChipPressed: { opacity: 0.88 },
    mapChipText: { color: colors.honeyDark, fontWeight: '800', fontSize: 11 },
    statsHighlightRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    statHighlightCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    statHighlightLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    statHighlightValue: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: '900',
        marginTop: 2,
    },
    statHighlightSub: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    venueStatusBlock: { marginTop: 2 },
    venueStatusLocked: { color: colors.error, fontSize: 11, fontWeight: '700', lineHeight: 15 },
    venueStatusPaused: { color: colors.honeyDark, fontSize: 11, fontWeight: '600', lineHeight: 15 },
    noVenueHint: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
    banAppealBtnCompact: {
        alignSelf: 'flex-start',
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: colors.warningBg,
        borderWidth: 1,
        borderColor: colors.warningBorder,
    },
    banAppealBtnPressed: { opacity: 0.9 },
    banAppealBtnText: { color: colors.warning, fontWeight: '800', fontSize: 12 },
    body: {
        flex: 1,
        minHeight: 0,
        width: '100%',
        justifyContent: 'flex-start',
    },
    bodyScroll: {
        flexShrink: 1,
        flexGrow: 0,
        maxHeight: '46%',
    },
    bodyScrollContent: {
        paddingBottom: 6,
    },
    challengeStrip: {
        flexShrink: 0,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingVertical: 7,
        paddingHorizontal: 10,
    },
    challengeStripTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
    challengeStripText: { color: colors.textSecondary, fontSize: 11, marginTop: 4, lineHeight: 15 },
    challengeProgressTrack: {
        marginTop: 8,
        height: 5,
        borderRadius: 3,
        backgroundColor: colors.bgElevated,
        overflow: 'hidden',
    },
    challengeProgressFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    venuePanel: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        overflow: 'hidden',
    },
    venuePanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    venuePanelHeaderText: { flex: 1, minWidth: 0 },
    venuePanelKicker: {
        color: colors.honeyDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.35,
        textTransform: 'uppercase',
    },
    venuePanelTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '900',
        marginTop: 2,
    },
    venuePanelHeaderLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
    },
    venuePanelHubLink: {
        color: colors.honeyDark,
        fontSize: 11,
        fontWeight: '800',
    },
    venueStatPills: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    venueStatPill: { flex: 1, alignItems: 'center' },
    venueStatPillValue: {
        color: colors.primary,
        fontSize: 18,
        fontWeight: '900',
    },
    venueStatPillLabel: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.2,
    },
    venueStatPillDivider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
    },
    venuePanelChallenge: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 6,
    },
    venuePanelChallengeHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    venuePanelChallengeTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '900',
    },
    venuePanelChallengeBody: {
        color: colors.textSecondary,
        fontSize: 11,
        lineHeight: 15,
    },
    venuePanelChallengeReward: {
        color: colors.honeyDark,
        fontSize: 11,
        fontWeight: '700',
    },
    venuePanelChallengeCta: {
        alignSelf: 'flex-start',
        marginTop: 2,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: colors.honeyMuted,
    },
    venuePanelChallengeCtaText: {
        color: colors.honeyDark,
        fontSize: 11,
        fontWeight: '800',
    },
    venuePanelActions: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        gap: 4,
    },
    retentionActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    retentionActionRowAccent: {
        backgroundColor: colors.honeyMuted,
    },
    retentionActionIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgElevated,
    },
    retentionActionIconAccent: {
        backgroundColor: colors.surface,
    },
    retentionActionText: { flex: 1, minWidth: 0 },
    retentionActionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    retentionActionTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '900',
        flexShrink: 1,
    },
    retentionActionBadge: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 999,
        backgroundColor: colors.primaryMuted,
    },
    retentionActionBadgeText: {
        color: colors.primaryDark,
        fontSize: 10,
        fontWeight: '800',
    },
    retentionActionSubtitle: {
        color: colors.textSecondary,
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15,
    },
    retentionCardPressed: { opacity: 0.92 },
    venuePanelFeed: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    venuePanelFeedTitle: {
        color: colors.textMuted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    venuePanelFeedLine: {
        color: colors.textSecondary,
        fontSize: 11,
        lineHeight: 16,
        marginTop: 2,
    },
    venuePanelLoader: {
        paddingVertical: 12,
    },
    venuePanelEmptyHint: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    venuePanelEmptyHintText: {
        color: colors.textMuted,
        fontSize: 11,
        lineHeight: 15,
        textAlign: 'center',
    },
    featuredOfferCard: {
        marginTop: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.honey,
        backgroundColor: colors.surface,
    },
    featuredOfferKicker: {
        color: colors.honeyDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    featuredOfferTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 6 },
    featuredOfferBody: { color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
    featuredOfferEnds: { color: colors.textMuted, fontSize: 10, marginTop: 8 },
    featuredOfferActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    featuredOfferBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: colors.primary,
    },
    featuredOfferBtnSecondary: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    featuredOfferBtnPressed: { opacity: 0.88 },
    featuredOfferBtnText: { color: colors.textInverse, fontSize: 12, fontWeight: '800' },
    featuredOfferBtnSecondaryText: { color: colors.link, fontSize: 12, fontWeight: '800' },
    startHereCard: {
        marginTop: 10,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
    },
    startHereTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
    startHereSubtitle: { color: colors.textSecondary, fontSize: 11, marginTop: 4, lineHeight: 15 },
    startHereRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    startHereChip: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    startHereChipPressed: { opacity: 0.9 },
    startHereChipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
    startHereSocialHint: { color: colors.textMuted, fontSize: 10, marginTop: 10, lineHeight: 14 },
    playAreaWrap: {
        flex: 1,
        minHeight: 112,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playColumn: { alignItems: 'center', maxWidth: '100%' },
    playLockedBlock: { marginTop: 14, paddingHorizontal: 12, alignItems: 'center' },
    playLockedHint: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 15,
    },
    playLockedLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 6,
    },
    playLockedLink: { paddingVertical: 4, paddingHorizontal: 6 },
    playLockedLinkPressed: { opacity: 0.85 },
    playLockedLinkText: { color: colors.link, fontSize: 12, fontWeight: '800' },
    playLockedSep: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    playButton: {
        width: 120,
        height: 120,
        borderRadius: 72,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        transform: [{ scale: 1 }],
    },
    playButtonDisabled: { opacity: 0.55 },
    playText: {
        color: colors.textInverse,
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1,
    },
    shortcutsArea: {
        flexShrink: 0,
        width: '100%',
        paddingTop: 8,
        paddingBottom: 6,
    },
    shortcutsTopRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    shortcutsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignContent: 'flex-start',
    },
    shortcutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        paddingVertical: 9,
        paddingHorizontal: 12,
        minHeight: 40,
    },
    shortcutBtnFlex: { flex: 1 },
    shortcutBtnGrid: { width: '48%', marginBottom: 5 },
    shortcutBtnPressed: { opacity: 0.92 },
    shortcutBtnDisabled: { opacity: 0.45 },
    shortcutLabel: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
        flex: 1,
        textAlign: 'left',
    },
    bottomNav: {
        flexShrink: 0,
        flexDirection: 'row',
        gap: 10,
        paddingTop: 8,
        paddingBottom: 10,
        marginHorizontal: -24,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
    },
    navItem: {
        flex: 1,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navItemPressed: { opacity: 0.85 },
    navIcon: {
        fontSize: 18,
    },
    });
}