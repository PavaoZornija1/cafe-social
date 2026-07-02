import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState, useMemo, useRef } from 'react';
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
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
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
    const [loadingCard, setLoadingCard] = useState(true);
    const [access, setAccess] = useState<VenueAccess | null>(null);
    const [friendsVisit, setFriendsVisit] = useState<FriendsVisitSummary | null>(null);
    const [friendsAtVenue, setFriendsAtVenue] = useState<FriendAtVenueRow[]>([]);
    const [engagement, setEngagement] = useState<Engagement | null>(null);
    const [venuePerks, setVenuePerks] = useState<VenuePerkPublicTeaser[]>([]);
    const [venueFeed, setVenueFeed] = useState<VenueFeedItem[]>([]);
    const [loadingSocial, setLoadingSocial] = useState(false);
    const [hubChallenges, setHubChallenges] = useState<HubVenueChallenge[]>([]);
    const [peopleHereCount, setPeopleHereCount] = useState(0);
    const [myVenueRewards, setMyVenueRewards] = useState<VenueRedeemableReward[]>([]);

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
        const token = await getTokenRef.current();
        if (!token) {
            setHubChallenges([]);
            setPeopleHereCount(0);
            setMyVenueRewards([]);
            return;
        }
        setLoadingSocial(true);
        try {
            const a = await apiGet<VenueAccess>(
                `/venue-context/${encodeURIComponent(venueId)}/access`,
                token,
            );
            setAccess(a);

            const [fv, fat, eng, perks, chList, peopleList, rewardsList] = await Promise.all([
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
            ]);
            setFriendsVisit(fv);
            setFriendsAtVenue(Array.isArray(fat.friends) ? fat.friends : []);
            setEngagement(eng);
            setVenuePerks(perks);
            setHubChallenges(Array.isArray(chList) ? chList : []);
            setPeopleHereCount(Array.isArray(peopleList) ? peopleList.length : 0);
            setMyVenueRewards(Array.isArray(rewardsList) ? rewardsList : []);

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
            setHubChallenges([]);
            setPeopleHereCount(0);
            setMyVenueRewards([]);
        } finally {
            setLoadingSocial(false);
        }
    }, [venueId, isLoaded]);

    useFocusEffect(
        useCallback(() => {
            void loadCard();
        }, [loadCard]),
    );

    useFocusEffect(
        useCallback(() => {
            void loadAuthenticated();
        }, [loadAuthenticated]),
    );

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
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
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
                    <ActivityIndicator color={colors.honey} style={{ marginVertical: 24 }} />
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
                        {loadingSocial ? (
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
                            {loadingSocial ? (
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
                            {loadingSocial && hubChallenges.length === 0 ? (
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
                            {loadingSocial && myVenueRewards.length === 0 ? (
                                <ActivityIndicator color={colors.honey} style={{ marginTop: 8 }} />
                            ) : myVenueRewards.filter((r) => r.status === 'REDEEMABLE').length === 0 ? (
                                <Text style={styles.muted}>{t('venueHub.myRewardsHereEmpty')}</Text>
                            ) : (
                                <>
                                    {myVenueRewards
                                        .filter((r) => r.status === 'REDEEMABLE')
                                        .slice(0, 4)
                                        .map((r) => (
                                            <View key={r.redemptionId} style={styles.rewardRow}>
                                                <View style={styles.rewardMain}>
                                                    <Text style={styles.hubChallengeTitle} numberOfLines={2}>
                                                        {r.perkTitle}
                                                    </Text>
                                                    <Text style={styles.hubChallengeMeta}>
                                                        {t('perk.rewardExpires')} {r.expiresAt.slice(0, 10)}
                                                    </Text>
                                                </View>
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        styles.redeemMiniBtn,
                                                        pressed && styles.ctaPressed,
                                                    ]}
                                                    onPress={() =>
                                                        navigation.navigate('RedeemPerk', { venueId })
                                                    }
                                                >
                                                    <Text style={styles.redeemMiniBtnText}>
                                                        {t('venueHub.perkRedeemCta')}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                    <Pressable
                                        style={({ pressed }) => [styles.link, styles.linkSpaced, pressed && styles.ctaPressed]}
                                        onPress={() => navigation.navigate('RewardsHub')}
                                    >
                                        <Text style={styles.linkText}>
                                            {t('venueHub.myRewardsSeeCrossVenue')}
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
                    {loadingSocial && venuePerks.length === 0 ? (
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
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: { padding: 8, borderRadius: 12 },
    backBtnPressed: { opacity: 0.8 },
    topTitle: {
        flex: 1,
        color: colors.text,
        fontSize: 17,
        fontWeight: '900',
        textAlign: 'center',
    },
    topBarSpacer: { width: 42 },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 32 },
    errorBanner: {
        color: colors.error,
        fontSize: 13,
        marginBottom: 12,
        lineHeight: 18,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 14,
    },
    cardTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 10 },
    featuredBox: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#4c1d95',
    },
    featuredLabel: { color: '#c4b5fd', fontSize: 11, fontWeight: '800', marginBottom: 6 },
    featuredTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    featuredBody: { color: colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
    cta: {
        alignSelf: 'flex-start',
        marginTop: 12,
        backgroundColor: colors.honeyMuted,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    ctaPressed: { opacity: 0.88 },
    ctaText: { color: colors.honeyDark, fontWeight: '800', fontSize: 12 },
    moreOffers: { marginTop: 12, gap: 10 },
    offerRow: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    offerTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    offerBody: { color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
    exhausted: { color: colors.error, fontSize: 12, marginTop: 8, fontWeight: '700' },
    link: { alignSelf: 'flex-start', marginTop: 8 },
    linkText: { color: colors.honey, fontWeight: '800', fontSize: 12 },
    partnerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    pillBtn: {
        backgroundColor: colors.honeyMuted,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    pillBtnSpaced: { marginTop: 12, alignSelf: 'flex-start' },
    pillBtnText: { color: colors.honeyDark, fontWeight: '800', fontSize: 13 },
    locationLine: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
    mapBtn: {
        marginTop: 12,
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    mapBtnText: { color: colors.link, fontWeight: '800', fontSize: 13 },
    hubChallengeRow: {
        marginTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    hubChallengeTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
    hubChallengeMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
    hubRewardHint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, fontWeight: '600' },
    rewardRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    rewardMain: { flex: 1, minWidth: 0 },
    redeemMiniBtn: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.honeyMuted,
    },
    redeemMiniBtnText: { color: colors.honeyDark, fontSize: 12, fontWeight: '800' },
    linkSpaced: { marginTop: 12 },
    friendsLine: { color: colors.honey, fontSize: 12, fontWeight: '700', marginBottom: 12 },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
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
        borderRadius: 8,
        overflow: 'hidden',
        alignSelf: 'flex-start',
    },
    friendMetaText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
    reportBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    reportText: { color: colors.error, fontSize: 11, fontWeight: '800' },
    metaLine: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    badge: {
        backgroundColor: colors.successMuted,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    badgeText: { color: colors.success, fontSize: 11, fontWeight: '800' },
    perkRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    perkTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', flex: 1 },
    perkPill: {
        color: colors.success,
        fontSize: 11,
        fontWeight: '800',
        backgroundColor: colors.successMuted,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
    },
    muted: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
    mutedSmall: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    feedRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    feedLine: { color: colors.text, fontSize: 12, fontWeight: '700' },
    feedSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    appealBtn: {
        alignSelf: 'stretch',
        marginTop: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: colors.warningBg,
        borderWidth: 1,
        borderColor: '#ca8a04',
        alignItems: 'center',
    },
    appealText: { color: colors.honeyDark, fontWeight: '800', fontSize: 13 },

    });
}

