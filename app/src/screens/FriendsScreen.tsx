import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AppNavigationProps } from '../navigation/screenProps';
import { useIsTabRoot } from '../navigation/useIsTabRoot';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import {
  fetchSocialInbox,
  type SocialInboxPartyInvite,
  type SocialInboxFriendRequest,
} from '../lib/socialInboxApi';
import { useFriendsInboxBadge } from '../context/FriendsInboxBadgeContext';
import FriendAvatarRow from '../components/friends/FriendAvatarRow';
import { PrimaryButton } from '../components/ui';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = AppNavigationProps;

type Friend = { id: string; username: string };

type IncomingRow = SocialInboxFriendRequest;

type OutgoingRow = { id: string; target: { id: string; username: string } };

type BlockedRow = {
  blockedId: string;
  createdAt: string;
  blocked: { id: string; username: string };
};

function requesterFromRow(row: IncomingRow): { id: string; username: string } {
  return row.requestedById === row.playerLow.id ? row.playerLow : row.playerHigh;
}

export default function FriendsScreen({ navigation }: Props) {
  const isTabRoot = useIsTabRoot('FriendsTab');
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { refreshPendingCount } = useFriendsInboxBadge();

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRow[]>([]);
  const [partyInvites, setPartyInvites] = useState<SocialInboxPartyInvite[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRow[]>([]);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [sharing, setSharing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setFriends([]);
        setIncoming([]);
        setPartyInvites([]);
        setOutgoing([]);
        return;
      }
      const [inbox, f, bl] = await Promise.all([
        fetchSocialInbox(token),
        apiGet<Friend[]>('/social/friends', token),
        apiGet<BlockedRow[]>('/players/me/blocks', token),
      ]);
      setFriends(f);
      setIncoming(inbox.friendRequestsIncoming);
      setPartyInvites(inbox.partyInvitesIncoming);
      setOutgoing(inbox.friendRequestsOutgoing);
      setBlocked(Array.isArray(bl) ? bl : []);
      void refreshPendingCount();
    } catch {
      Alert.alert(t('common.error'), t('friends.loadError'));
      setFriends([]);
      setIncoming([]);
      setPartyInvites([]);
      setOutgoing([]);
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t, refreshPendingCount]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shareInvite = async () => {
    setSharing(true);
    try {
      const token = await getTokenRef.current();
      await createAndShareFriendInviteLink(token, t);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('friends.friendLinkFailed'));
    } finally {
      setSharing(false);
    }
  };

  const sendByUsername = async () => {
    const name = usernameDraft.trim();
    if (name.length < 2) {
      Alert.alert(t('common.error'), t('friends.usernameTooShort'));
      return;
    }
    const token = await getTokenRef.current();
    if (!token) return;
    setRequestBusy(true);
    try {
      const res = await apiPost<{ created: boolean }>(
        '/social/friends/request-by-username',
        { username: name },
        token,
      );
      setUsernameDraft('');
      Alert.alert(
        '',
        res.created ? t('friends.requestSent') : t('friends.requestAlreadyPending'),
      );
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('friends.requestFailed'));
    } finally {
      setRequestBusy(false);
    }
  };

  const cancelOutgoing = async (friendshipId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    try {
      await apiDelete(
        `/social/friends/outgoing/${encodeURIComponent(friendshipId)}`,
        token,
      );
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    }
  };

  const accept = async (otherPlayerId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    try {
      await apiPost('/social/friends/accept', { otherPlayerId }, token);
      Alert.alert('', t('friends.accepted'));
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    }
  };

  const blockPlayer = (playerId: string, username: string) => {
    Alert.alert(
      t('friends.blockTitle'),
      t('friends.blockConfirm', { username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('friends.block'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const token = await getTokenRef.current();
              if (!token) return;
              try {
                await apiPost(`/players/me/blocks/${encodeURIComponent(playerId)}`, {}, token);
                await load();
              } catch (e) {
                Alert.alert(t('common.error'), (e as Error).message ?? t('friends.blockFailed'));
              }
            })();
          },
        },
      ],
    );
  };

  const unblockPlayer = (playerId: string) => {
    void (async () => {
      const token = await getTokenRef.current();
      if (!token) return;
      try {
        await apiDelete(`/players/me/blocks/${encodeURIComponent(playerId)}`, token);
        await load();
      } catch (e) {
        Alert.alert(t('common.error'), (e as Error).message ?? t('friends.blockFailed'));
      }
    })();
  };

  const acceptPartyInvite = async (partyId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    try {
      await apiPost(`/parties/${encodeURIComponent(partyId)}/accept-invite`, {}, token);
      Alert.alert('', t('inbox.partyJoined'));
      await load();
      navigation.navigate('PartyDetail', { partyId });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    }
  };

  const declinePartyInvite = async (partyId: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    try {
      await apiPost(`/parties/${encodeURIComponent(partyId)}/decline-invite`, {}, token);
      await load();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          {!isTabRoot ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}
        </View>

        <Text style={styles.title}>{t('friends.title')}</Text>
        <Text style={styles.subtitle}>{t('friends.subtitle')}</Text>

        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Parties')}
            accessibilityRole="button"
          >
            <Ionicons name="people-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.quickLabel}>{t('home.linkParties')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}
            onPress={() => navigation.navigate('RedeemInvite', {})}
            accessibilityRole="button"
          >
            <Ionicons name="link-outline" size={24} color={colors.honey} />
            <Text style={styles.quickLabel}>{t('home.linkRedeemInvite')}</Text>
          </Pressable>
        </View>

        <PrimaryButton
          label={sharing ? '…' : t('friends.inviteShare')}
          disabled={sharing}
          onPress={() => void shareInvite()}
          buttonStyle={styles.inviteBtn}
        />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
          <Text style={styles.section}>{t('friends.addByUsername')}</Text>
          <Text style={styles.hint}>{t('friends.addByUsernameHint')}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder={t('friends.usernamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              editable={!requestBusy}
            />
            <Pressable
              style={[styles.sendBtn, requestBusy && styles.pressed]}
              disabled={requestBusy}
              onPress={() => void sendByUsername()}
            >
              <Text style={styles.sendBtnText}>{t('friends.sendRequest')}</Text>
            </Pressable>
          </View>

          <Text style={[styles.section, styles.sectionSpacer]}>{t('friends.outgoing')}</Text>
          {outgoing.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noOutgoing')}</Text>
          ) : (
            outgoing.map((row) => (
              <View key={row.id} style={styles.outRow}>
                <View style={styles.outMain}>
                  <Text style={styles.name}>{row.target.username}</Text>
                  <Text style={styles.mutedSmall}>{t('friends.pendingTheirAccept')}</Text>
                </View>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => void cancelOutgoing(row.id)}
                >
                  <Text style={styles.cancelBtnText}>{t('friends.cancelRequest')}</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.section, styles.sectionSpacer]}>{t('inbox.sectionPartyInvites')}</Text>
          {partyInvites.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noPartyInvites')}</Text>
          ) : (
            partyInvites.map((invite) => (
              <View key={invite.id} style={styles.card}>
                <Text style={styles.name}>{invite.partyName?.trim() || t('parties.unnamed')}</Text>
                <Text style={styles.mutedSmall}>
                  {t('inbox.partyInviteMeta', {
                    user: invite.invitedBy.username,
                    current: invite.memberCount,
                    max: invite.maxMembers,
                  })}
                </Text>
                <View style={styles.incomingActions}>
                  <Pressable
                    style={styles.acceptBtn}
                    onPress={() => void acceptPartyInvite(invite.partyId)}
                  >
                    <Text style={styles.acceptBtnText}>{t('inbox.accept')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.declineBtn}
                    onPress={() => void declinePartyInvite(invite.partyId)}
                  >
                    <Text style={styles.declineBtnText}>{t('inbox.decline')}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text style={[styles.section, styles.sectionSpacer]}>{t('friends.incoming')}</Text>
          {incoming.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noIncoming')}</Text>
          ) : (
            incoming.map((row) => {
              const r = requesterFromRow(row);
              return (
                <View key={row.id} style={styles.card}>
                  <Text style={styles.name}>
                    {r.username}{' '}
                    <Text style={styles.mutedSmall}>{t('friends.wantsToConnect')}</Text>
                  </Text>
                  <View style={styles.incomingActions}>
                    <Pressable
                      style={styles.acceptBtn}
                      onPress={() => void accept(r.id)}
                    >
                      <Text style={styles.acceptBtnText}>{t('friends.accept')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.blockBtn}
                      onPress={() => blockPlayer(r.id, r.username)}
                    >
                      <Text style={styles.blockBtnText}>{t('friends.block')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text style={[styles.section, styles.sectionSpacer]}>
            {t('friends.myFriends')}
          </Text>
          {friends.length === 0 ? (
            <Text style={styles.muted}>{t('friends.noFriends')}</Text>
          ) : (
            friends.map((f) => (
              <FriendAvatarRow
                key={f.id}
                colors={colors}
                username={f.username}
                trailing={
                  <Pressable
                    style={styles.blockBtnSmall}
                    onPress={() => blockPlayer(f.id, f.username)}
                  >
                    <Text style={styles.blockBtnTextSmall}>{t('friends.block')}</Text>
                  </Pressable>
                }
              />
            ))
          )}

          <Text style={[styles.section, styles.sectionSpacer]}>{t('friends.blockedTitle')}</Text>
          <Text style={styles.hint}>{t('friends.blockedHint')}</Text>
          {blocked.length === 0 ? (
            <Text style={styles.muted}>{t('friends.blockedEmpty')}</Text>
          ) : (
            blocked.map((b) => (
              <View key={b.blockedId} style={styles.blockedRow}>
                <Text style={styles.friendName}>{b.blocked.username}</Text>
                <Pressable
                  style={styles.unblockBtn}
                  onPress={() => unblockPlayer(b.blockedId)}
                >
                  <Text style={styles.unblockBtnText}>{t('friends.unblock')}</Text>
                </Pressable>
              </View>
            ))
          )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      paddingTop: spacing.md,
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
    },
    iconBtnPlaceholder: { width: 44 },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    inviteBtn: { alignSelf: 'stretch', marginVertical: spacing.sm },
    quickRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    quickTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    quickLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    loader: { marginVertical: spacing.xxl },
    section: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: spacing.lg },
    sectionSpacer: { marginTop: spacing.xl },
    muted: { color: colors.textMuted, fontSize: 14 },
    mutedSmall: { color: colors.textMuted, fontWeight: '500', fontSize: 13 },
    hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    name: { color: colors.text, fontWeight: '700', fontSize: 15 },
    acceptBtn: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: radii.md,
    },
    acceptBtnText: { color: colors.textInverse, fontWeight: '800' },
    blockBtnSmall: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    blockBtnTextSmall: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    sendBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      justifyContent: 'center',
    },
    sendBtnText: { color: colors.textInverse, fontWeight: '800' },
    outRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    outMain: { flex: 1 },
    cancelBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      backgroundColor: colors.bgElevated,
    },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
    incomingActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    blockBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
    },
    blockBtnText: { color: colors.error, fontWeight: '700' },
    declineBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    declineBtnText: { color: colors.textSecondary, fontWeight: '700' },
    blockedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    friendName: { color: colors.text, fontWeight: '700', flex: 1 },
    unblockBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: radii.sm,
      backgroundColor: colors.primaryMuted,
    },
    unblockBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    pressed: { opacity: 0.92 },
  });
}
