import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Parties'>;

type PartyMember = {
  playerId: string;
  player: { id: string; username: string };
};

type PartyListItem = {
  id: string;
  name: string | null;
  creatorId: string;
  leaderId: string;
  maxMembers: number;
  members: PartyMember[];
};

export default function PartiesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<PartyListItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setParties([]);
        return;
      }
      const list = await apiGet<PartyListItem[]>('/parties/mine', token);
      setParties(list);
    } catch {
      setParties([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createParty = async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    setCreating(true);
    try {
      const name = newName.trim() || undefined;
      const created = await apiPost<PartyListItem>(
        '/parties',
        name ? { name } : {},
        token,
      );
      setNewName('');
      navigation.navigate('PartyDetail', { partyId: created.id });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('parties.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('parties.title')}</Text>
      </View>

      <View style={styles.createRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder={t('parties.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <Pressable
          onPress={() => void createParty()}
          disabled={creating}
          style={[styles.createBtn, creating && styles.btnDisabled]}
        >
          <Text style={styles.createBtnText}>
            {creating ? '…' : t('parties.create')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => navigation.navigate('RedeemInvite', {})}
        style={styles.redeemLink}
      >
        <Text style={styles.redeemLinkText}>{t('parties.haveInvite')}</Text>
      </Pressable>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : (
        <FlatList
          data={parties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('parties.empty')}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('PartyDetail', { partyId: item.id })
              }
            >
              <Text style={styles.cardTitle}>
                {item.name?.trim() || t('parties.unnamed')}
              </Text>
              <Text style={styles.cardMeta}>
                {t('parties.memberCount', {
                  current: item.members.length,
                  max: item.maxMembers,
                })}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  createRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { color: colors.textInverse, fontWeight: '800' },
  redeemLink: { paddingHorizontal: 24, marginBottom: 8 },
  redeemLinkText: { color: colors.honey, fontWeight: '700', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardMeta: { color: colors.textMuted, marginTop: 6, fontSize: 13 },

    });
}
