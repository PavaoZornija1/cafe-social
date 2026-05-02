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
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { setBackgroundApiToken } from '../lib/backgroundApiToken';
import { syncVenueGeofenceMonitoring } from '../lib/venueGeofenceTask';
import type { MeSummaryDto } from '../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../lib/onboardingStorage';
import { buildVenueAccessQuery, fetchDetectedVenue } from '../lib/venueDetectClient';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
        if (Platform.OS === 'web') return;
        let cancelled = false;

        async function run() {
            if (!detectedVenue?.id || !publicCard?.geofence) {
                await syncVenueGeofenceMonitoring(null);
                return;
            }
            const g = publicCard.geofence;
            if (
                typeof g.latitude !== 'number' ||
                typeof g.longitude !== 'number' ||
                typeof g.radiusMeters !== 'number'
            ) {
                await syncVenueGeofenceMonitoring(null);
                return;
            }
            if (cancelled) return;
            await syncVenueGeofenceMonitoring({
                venueId: detectedVenue.id,
                latitude: g.latitude,
                longitude: g.longitude,
                radiusMeters: g.radiusMeters,
            });
        }

        void run();
        return () => {
            cancelled = true;
            void syncVenueGeofenceMonitoring(null);
        };
    }, [
        detectedVenue?.id,
        publicCard?.geofence?.latitude,
        publicCard?.geofence?.longitude,
        publicCard?.geofence?.radiusMeters,
    ]);

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

    const challengeLine =
        locked
            ? venueAdminLocked
                ? t('home.venueTemporarilyUnavailableShort')
                : needsExplicitCheckIn
                  ? t('home.explicitCheckInChallengeLine')
                  : t('home.unlockToStart')
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
                                    <Text style={styles.venueRowError} numberOfLines={2}>
                                        {venueError}
                                    </Text>
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
                    <View style={styles.challengeStrip}>
                        <Text style={styles.challengeStripTitle}>{t('home.challengeTitle')}</Text>
                        <Text style={styles.challengeStripText} numberOfLines={2}>
                            {challengeLine}
                        </Text>
                    </View>

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
                            {!loadingVenue && !gamesPlayable ? (
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
                            ) : null}
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
    playAreaWrap: {
        flex: 1,
        minHeight: 0,
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