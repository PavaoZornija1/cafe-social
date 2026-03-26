import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { useOnboardingEnforcement } from '../navigation/useOnboardingEnforcement';
import { apiGet, apiPost } from '../lib/api';

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

export default function PartyDetailScreen({ navigation, route }: Props) {
  const { partyId } = route.params;
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useOnboardingEnforcement(navigation);

  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<Party | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

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
    }, [load]),
  );

  const isLeader = party && meId ? party.leaderId === meId : false;

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
    party && meId
      ? party.members.filter((m) => m.playerId !== meId)
      : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {party?.name?.trim() || t('parties.unnamed')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : !party ? (
        <Text style={styles.err}>{t('parties.loadFailed')}</Text>
      ) : (
        <>
          <Text style={styles.meta}>
            {t('parties.memberCount', {
              current: party.members.length,
              max: party.maxMembers,
            })}
          </Text>
          {meId && party.creatorId === meId && (
            <Text style={styles.badge}>{t('parties.youAreCreator')}</Text>
          )}
          {isLeader && (
            <Text style={styles.badge}>{t('parties.youAreLeader')}</Text>
          )}

          <FlatList
            data={party.members}
            keyExtractor={(m) => m.playerId}
            style={styles.list}
            ListHeaderComponent={
              <Text style={styles.section}>{t('parties.members')}</Text>
            }
            renderItem={({ item }) => {
              const canKick =
                isLeader && meId != null && item.playerId !== meId;
              return (
                <View style={styles.memberRow}>
                  <View style={styles.memberMain}>
                    <Text style={styles.memberName}>{item.player.username}</Text>
                    {item.playerId === party.leaderId && (
                      <Text style={styles.leaderTag}>{t('parties.leaderTag')}</Text>
                    )}
                  </View>
                  {canKick && (
                    <Pressable
                      style={styles.kickBtn}
                      disabled={busy}
                      onPress={() =>
                        kickMember(item.playerId, item.player.username)
                      }
                    >
                      <Text style={styles.kickBtnText}>{t('parties.kick')}</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
          />

          <View style={styles.actions}>
            {isLeader && (
              <>
                <Pressable
                  style={styles.primaryBtn}
                  disabled={busy}
                  onPress={() => void inviteLink()}
                >
                  <Text style={styles.primaryBtnText}>
                    {t('parties.generateInviteLink')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  disabled={busy}
                  onPress={() => void meshFriends()}
                >
                  <Text style={styles.secondaryBtnText}>
                    {t('parties.meshFriendRequests')}
                  </Text>
                </Pressable>
                {transferCandidates.length > 0 && (
                  <Pressable
                    style={styles.secondaryBtn}
                    disabled={busy}
                    onPress={() => setTransferOpen(true)}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {t('parties.transferLeadership')}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            <Pressable
              style={styles.dangerBtn}
              disabled={busy}
              onPress={confirmLeave}
            >
              <Text style={styles.dangerBtnText}>{t('parties.leaveParty')}</Text>
            </Pressable>
          </View>

          <Modal
            visible={transferOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setTransferOpen(false)}
          >
            <View style={styles.modalWrap}>
              <Pressable
                style={styles.modalDim}
                onPress={() => setTransferOpen(false)}
              />
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('parties.transferPick')}</Text>
                {transferCandidates.map((m) => (
                  <Pressable
                    key={m.playerId}
                    style={styles.modalRow}
                    onPress={() =>
                      confirmTransfer(m.playerId, m.player.username)
                    }
                  >
                    <Text style={styles.modalRowText}>{m.player.username}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setTransferOpen(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
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
    marginBottom: 12,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  meta: { color: '#9ca3af', paddingHorizontal: 24, marginBottom: 6 },
  badge: { color: '#a78bfa', paddingHorizontal: 24, fontWeight: '700', fontSize: 12 },
  section: { color: '#fff', fontWeight: '800', marginBottom: 8, marginTop: 12 },
  list: { flex: 1, paddingHorizontal: 24 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 12,
  },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { color: '#f9fafb', fontWeight: '700' },
  leaderTag: { color: '#fbbf24', fontWeight: '800', fontSize: 12 },
  kickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#3f1d1d',
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  kickBtnText: { color: '#fca5a5', fontWeight: '800', fontSize: 12 },
  actions: { padding: 24, gap: 10, paddingBottom: 32 },
  primaryBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#4c1d95',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#c4b5fd', fontWeight: '800' },
  dangerBtn: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerBtnText: { color: '#fca5a5', fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  err: { color: '#f87171', padding: 24 },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalDim: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  modalRowText: { color: '#e5e7eb', fontSize: 16, fontWeight: '700' },
  modalCancel: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: '#9ca3af', fontWeight: '700' },
});
