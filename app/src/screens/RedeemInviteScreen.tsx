import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RedeemInvite'>;

type RedeemResult = {
  kind: 'PARTY' | 'FRIEND';
  partyId?: string;
  joinedParty?: boolean;
};

function parseTokenFromUrl(url: string): string | null {
  try {
    const normalized = url.replace(/^cafesocial:\/\//, 'https://x/');
    const u = new URL(normalized);
    return u.searchParams.get('token');
  } catch {
    return null;
  }
}

export default function RedeemInviteScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [token, setToken] = useState(route.params?.token ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (route.params?.token) setToken(route.params.token);
  }, [route.params?.token]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const q = parseTokenFromUrl(url);
      if (q) setToken(q);
    });
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      const q = parseTokenFromUrl(url);
      if (q) setToken(q);
    });
    return () => sub.remove();
  }, []);

  const redeem = async () => {
    const raw = token.trim();
    if (!raw) {
      Alert.alert(t('common.error'), t('redeem.pasteToken'));
      return;
    }
    const jwt = await getTokenRef.current();
    if (!jwt) {
      Alert.alert(t('common.error'), t('redeem.signInFirst'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<RedeemResult>('/invites/redeem', { token: raw }, jwt);
      if (res.kind === 'PARTY' && res.partyId) {
        Alert.alert('', t('redeem.joinedParty'), [
          {
            text: t('common.continue'),
            onPress: () =>
              navigation.navigate('PartyDetail', { partyId: res.partyId! }),
          },
        ]);
      } else {
        Alert.alert('', t('redeem.friendLinked'), [
          { text: t('common.continue'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? '');
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.honey} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('redeem.title')}</Text>
      </View>

      <Text style={styles.hint}>{t('redeem.hint')}</Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder={t('redeem.tokenPlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        style={styles.input}
      />

      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        disabled={busy}
        onPress={() => void redeem()}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.btnText}>{t('redeem.submit')}</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({

  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  header: {
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  input: {
    minHeight: 100,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    color: '#f9fafb',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: colors.text, fontWeight: '900', fontSize: 16 },

    });
}

