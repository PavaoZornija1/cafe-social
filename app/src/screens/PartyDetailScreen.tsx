import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '../components/ScreenHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PartyDetail'>;

type PartyMember = {
  playerId: string;
  player: { id: string; username: string };
};

type Party = {
  id: string;
  name: string | null;
  creatorId: string;
  leaderId: string;
  maxMembers: number;
  members: PartyMember[];
};

type PlayContext = {
  venueName: string | null;
  subscriber: boolean;
};

export default function PartyDetailScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { partyId, justCreated } = route.params;
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [playContext, setPlayContext] = useState<PlayContext | null>(null);

  const openPartyPlay = useCallback(
    async (screen: 'WordLobby' | 'BrawlerLobby') => {
      const { venue } = await fetchDetectedVenue();
      navigation.navigate(screen, {
        partyId,
        ...(venue?.id ? { venueId: venue.id } : {}),
      });
    },
    [navigation, partyId],
  );

  const loadPlayContext = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setPlayContext(null);
        return;
      }
      const [{ venue }, summary] = await Promise.all([
        fetchDetectedVenue(),
        apiGet<{ subscriptionActive?: boolean }>('/players/me/summary', token),
      ]);
      setPlayContext({
        venueName: venue?.name?.trim() || null,
        subscriber: summary.subscriptionActive === true,
      });
    } catch {
      setPlayContext(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setParty(null);
        return;
      }
      const [p, summary] = await Promise.all([
        apiGet<Party>(`/parties/${partyId}`, token),
        apiGet<{ playerId: string }>('/players/me/summary', token),
      ]);
      setParty(p);
      setMeId(summary.playerId);
    } catch {
      setParty(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, partyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadPlayContext();
    }, [load, loadPlayContext]),
  );

  const isLeader = party && meId ? party.leaderId === meId : false;
  const showWelcome = Boolean(justCreated || (party && party.members.length === 1 && isLeader));
  const playContextLine = useMemo(() => {
    if (!playContext) return null;
    if (playContext.venueName) {
      return t('parties.playAtVenue', { venue: playContext.venueName });
    }
    if (playContext.subscriber) {
      return t('parties.playGlobalSubscriber');
    }
    return t('parties.playNeedVenue');
  }, [playContext, t]);

  const inviteLink = async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    setBusy(true);
    try {
      const res = await apiPost<{
        token: string;
        inviteId: string;
        expiresAt: string;
        maxUses: number;
      }>(`/parties/${partyId}/invite-link`, {}, token);
      const url = `cafesocial://redeem?token=${encodeURIComponent(res.token)}`;
      const message = t('parties.shareInviteMessage', {
        url,
        raw: res.token,
      });
      await Share.share({ message, title: 'Cafe Social' });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const meshFriends = async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    setBusy(true);
    try {
      const res = await apiPost<{ requestsSent: number }>(
        `/parties/${partyId}/mesh-friend-requests`,
        {},
        token,
      );
      Alert.alert('', t('parties.meshDone', { n: res.requestsSent }));
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const kickMember = (targetPlayerId: string, username: string) => {
    Alert.alert(
      t('parties.kickTitle'),
      t('parties.kickConfirm', { name: username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('parties.kick'),
          style: 'destructive',
          onPress: () => void doKick(targetPlayerId),
        },
      ],
    );
  };

  const doKick = async (targetPlayerId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    setBusy(true);
    try {
      const res = await apiPost<{ dissolved?: boolean }>(
        `/parties/${partyId}/kick`,
        { targetPlayerId },
        token,
      );
      if (res.dissolved) {
        Alert.alert('', t('parties.partyEnded'));
        navigation.goBack();
        return;
      }
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const confirmTransfer = (newLeaderId: string, username: string) => {
    Alert.alert(
      t('parties.transferTitle'),
      t('parties.transferConfirm', { name: username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: () => void doTransfer(newLeaderId),
        },
      ],
    );
  };

  const doTransfer = async (newLeaderId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    setBusy(true);
    try {
      await apiPost(`/parties/${partyId}/transfer-leadership`, { newLeaderId }, token);
      setTransferOpen(false);
      Alert.alert('', t('parties.transferDone'));
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    setBusy(true);
    try {
      const res = await apiPost<{ dissolved?: boolean }>(
        `/parties/${partyId}/leave`,
        {},
        token,
      );
      if (res.dissolved) {
        Alert.alert('', t('parties.partyEnded'));
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(t('parties.leaveTitle'), t('parties.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('parties.leave'), style: 'destructive', onPress: () => void leave() },
    ]);
  };

  const transferCandidates =
    party && meId ? party.members.filter((m) => m.playerId !== meId) : [];

  const partyTitle = party?.name?.trim() || t('parties.unnamed');

  if (!isLoaded || loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={partyTitle}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!party) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('parties.unnamed')}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back')}
        />
        <View style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.textMuted} />
          <Text style={styles.errorTitle}>{t('parties.loadFailed')}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
            onPress={() => void load()}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={partyTitle}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="people-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('parties.heroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{partyTitle}</Text>
          <Text style={styles.heroMeta}>
            {t('parties.memberCount', {
              current: party.members.length,
              max: party.maxMembers,
            })}
          </Text>
          {meId && party.creatorId === meId && (
            <View style={styles.roleChip}>
              <Ionicons name="sparkles" size={11} color={colors.honeyDark} />
              <Text style={styles.roleChipText}>{t('parties.youAreCreator')}</Text>
            </View>
          )}
          {isLeader && (
            <View style={styles.roleChip}>
              <Ionicons name="star" size={11} color={colors.honeyDark} />
              <Text style={styles.roleChipText}>{t('parties.youAreLeader')}</Text>
            </View>
          )}
        </View>

        {showWelcome && isLeader ? (
          <View style={styles.welcomeCard}>
            <View style={styles.cardAccent} />
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="checkmark-circle" size={22} color={colors.textInverse} />
              </View>
              <Text style={styles.cardTitle}>{t('parties.detailJustCreatedTitle')}</Text>
            </View>
            <Text style={styles.cardHint}>{t('parties.detailJustCreatedHint')}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                busy && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
              disabled={busy}
              onPress={() => void inviteLink()}
            >
              {busy ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={colors.textInverse} />
                  <Text style={styles.primaryBtnText}>{t('parties.generateInviteLink')}</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('parties.members')}</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{party.members.length}</Text>
          </View>
        </View>

        {party.members.length === 1 && isLeader ? (
          <Text style={styles.soloHint}>{t('parties.waitingForFriends')}</Text>
        ) : null}

        {party.members.map((item) => {
          const canKick = isLeader && meId != null && item.playerId !== meId;
          return (
            <View key={item.playerId} style={styles.memberRow}>
              <View style={styles.memberIconWrap}>
                <Ionicons name="person" size={18} color={colors.textInverse} />
              </View>
              <View style={styles.memberMain}>
                <Text style={styles.memberName}>{item.player.username}</Text>
                {item.playerId === party.leaderId ? (
                  <View style={styles.leaderChip}>
                    <Ionicons name="star" size={10} color={colors.honeyDark} />
                    <Text style={styles.leaderChipText}>{t('parties.leaderTag')}</Text>
                  </View>
                ) : null}
              </View>
              {canKick ? (
                <Pressable
                  style={({ pressed }) => [styles.kickBtn, pressed && styles.pressed]}
                  disabled={busy}
                  onPress={() => kickMember(item.playerId, item.player.username)}
                >
                  <Text style={styles.kickBtnText}>{t('parties.kick')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <View style={styles.playCard}>
          <View style={styles.cardAccent} />
          <Text style={styles.playTitle}>{t('parties.playTogether')}</Text>
          <Text style={styles.playHint}>{t('parties.playTogetherHint')}</Text>
          {playContextLine ? (
            <View style={styles.venueRow}>
              <Ionicons
                name={playContext?.venueName ? 'location' : 'globe-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.venueText}>{playContextLine}</Text>
            </View>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
            disabled={busy}
            onPress={() => void openPartyPlay('WordLobby')}
          >
            <Ionicons name="game-controller-outline" size={18} color={colors.honey} />
            <Text style={styles.playBtnText}>{t('parties.playWord')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
            disabled={busy}
            onPress={() => void openPartyPlay('BrawlerLobby')}
          >
            <Ionicons name="flash-outline" size={18} color={colors.honey} />
            <Text style={styles.playBtnText}>{t('parties.playBrawler')}</Text>
          </Pressable>
        </View>

        {isLeader ? (
          <View style={styles.leaderCard}>
            {!showWelcome ? (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  busy && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={busy}
                onPress={() => void inviteLink()}
              >
                <Ionicons name="share-outline" size={18} color={colors.textInverse} />
                <Text style={styles.primaryBtnText}>{t('parties.generateInviteLink')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              disabled={busy}
              onPress={() => void meshFriends()}
            >
              <Ionicons name="heart-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('parties.meshFriendRequests')}</Text>
            </Pressable>
            {transferCandidates.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                disabled={busy}
                onPress={() => setTransferOpen(true)}
              >
                <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>{t('parties.transferLeadership')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
          disabled={busy}
          onPress={confirmLeave}
        >
          <Ionicons name="exit-outline" size={18} color={colors.error} />
          <Text style={styles.dangerBtnText}>{t('parties.leaveParty')}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={transferOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTransferOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalDim} onPress={() => setTransferOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('parties.transferPick')}</Text>
            {transferCandidates.map((m) => (
              <Pressable
                key={m.playerId}
                style={styles.modalRow}
                onPress={() => confirmTransfer(m.playerId, m.player.username)}
              >
                <Text style={styles.modalRowText}>{m.player.username}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setTransferOpen(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
      gap: spacing.sm,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pressed: { opacity: 0.88 },
    btnDisabled: { opacity: 0.6 },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.sm,
    },
    heroGradient: { ...StyleSheet.absoluteFillObject },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 22,
      fontWeight: '900',
      lineHeight: 28,
    },
    heroMeta: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      fontWeight: '600',
    },
    roleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    roleChipText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    welcomeCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
    },
    cardHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '900',
    },
    countPill: {
      minWidth: 26,
      height: 26,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    countPillText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    soloHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.md,
    },
    memberIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberMain: { flex: 1, gap: 4 },
    memberName: { color: colors.text, fontWeight: '800', fontSize: 15 },
    leaderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.honeyMuted,
    },
    leaderChipText: {
      color: colors.honeyDark,
      fontSize: 11,
      fontWeight: '800',
    },
    kickBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      backgroundColor: '#3f1d1d',
      borderWidth: 1,
      borderColor: colors.error,
    },
    kickBtnText: { color: colors.error, fontWeight: '800', fontSize: 12 },
    playCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    playTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      marginTop: spacing.xs,
    },
    playHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    venueRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    venueText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
    },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: '#4c1d95',
      paddingVertical: 14,
      borderRadius: radii.lg,
    },
    playBtnText: { color: colors.honey, fontWeight: '800' },
    leaderCard: { gap: spacing.sm, marginTop: spacing.sm },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: radii.lg,
    },
    primaryBtnText: { color: colors.textInverse, fontWeight: '800' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 14,
      borderRadius: radii.lg,
    },
    secondaryBtnText: { color: colors.primary, fontWeight: '800' },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.error,
      paddingVertical: 14,
      borderRadius: radii.lg,
      marginTop: spacing.md,
    },
    dangerBtnText: { color: colors.error, fontWeight: '800' },
    errorCard: {
      margin: spacing.xl,
      padding: spacing.xl,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      gap: spacing.md,
    },
    errorTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    retryBtn: {
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
    },
    retryBtnText: { color: colors.textInverse, fontWeight: '800' },
    modalWrap: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalDim: { ...StyleSheet.absoluteFillObject },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 16 },
    modalRow: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalRowText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
    modalCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
    modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  });
}
