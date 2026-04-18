import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
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
import type { RootStackParamList } from '../navigation/type';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Friend = { id: string; username: string };

type IncomingRow = {
  id: string;
  requestedById: string;
  playerLow: { id: string; username: string };
  playerHigh: { id: string; username: string };
};

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
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingRow[]>([]);
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
        setOutgoing([]);
        return;
      }
      const [f, inc, out, bl] = await Promise.all([
        apiGet<Friend[]>('/social/friends', token),
        apiGet<IncomingRow[]>('/social/friends/incoming', token),
        apiGet<OutgoingRow[]>('/social/friends/outgoing', token),
        apiGet<BlockedRow[]>('/players/me/blocks', token),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setBlocked(Array.isArray(bl) ? bl : []);
    } catch {
      Alert.alert(t('common.error'), t('friends.loadError'));
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('friends.title')}</Text>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.toolbarBtn, sharing && styles.toolbarBtnDisabled]}
          disabled={sharing}
          onPress={() => void shareInvite()}
        >
          <Text style={styles.toolbarBtnText}>
            {sharing ? '…' : t('friends.inviteShare')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>{t('friends.addByUsername')}</Text>
          <Text style={styles.hint}>{t('friends.addByUsernameHint')}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder={t('friends.usernamePlaceholder')}
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              editable={!requestBusy}
            />
            <Pressable
              style={[styles.sendBtn, requestBusy && styles.toolbarBtnDisabled]}
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
              <View key={f.id} style={styles.friendRow}>
                <Text style={styles.friendName}>{f.username}</Text>
                <Pressable
                  style={styles.blockBtnSmall}
                  onPress={() => blockPlayer(f.id, f.username)}
                >
                  <Text style={styles.blockBtnTextSmall}>{t('friends.block')}</Text>
                </Pressable>
              </View>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
  toolbar: { paddingHorizontal: 24, marginBottom: 12 },
  toolbarBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#4c1d95',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  toolbarBtnDisabled: { opacity: 0.6 },
  toolbarBtnText: { color: '#c4b5fd', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  section: { color: '#fff', fontSize: 16, fontWeight: '900' },
  sectionSpacer: { marginTop: 28 },
  muted: { color: '#6b7280', marginTop: 10, fontSize: 14 },
  mutedSmall: { color: '#9ca3af', fontWeight: '500', fontSize: 13 },
  card: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    gap: 12,
  },
  cardMuted: {
    marginTop: 12,
    backgroundColor: '#0b1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  name: { color: '#f9fafb', fontWeight: '700', fontSize: 15 },
  acceptBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  acceptBtnText: { color: '#fff', fontWeight: '800' },
  friendRow: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  friendName: { color: '#e5e7eb', fontWeight: '700', flex: 1 },
  incomingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  blockBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#3f1d1d',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  blockBtnText: { color: '#fca5a5', fontWeight: '800', fontSize: 13 },
  blockBtnSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#3f1d1d',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  blockBtnTextSmall: { color: '#fca5a5', fontWeight: '800', fontSize: 12 },
  blockedRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  unblockBtnText: { color: '#93c5fd', fontWeight: '800', fontSize: 12 },
  hint: { color: '#6b7280', fontSize: 13, marginTop: 6, lineHeight: 18 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  outRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#0b1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
  },
  outMain: { flex: 1 },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#3f1d1d',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  cancelBtnText: { color: '#fca5a5', fontWeight: '800', fontSize: 12 },
});
