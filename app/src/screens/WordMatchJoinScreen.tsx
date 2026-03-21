import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'WordMatchJoin'>;

export default function WordMatchJoinScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { venueId, challengeId } = route.params;
  const { getToken, isLoaded } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJoin = async () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError(t('wordMatch.codeTooShort'));
      return;
    }
    if (!isLoaded) return;
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error(t('qr.notAuthenticated'));
      const res = await apiPost<{
        sessionId: string;
        mode: 'coop' | 'versus';
        difficulty: string;
      }>('/words/matches/join', { inviteCode: trimmed }, token);
      navigation.replace('WordMatchWait', {
        venueId,
        challengeId,
        mode: res.mode,
        difficulty: res.difficulty as 'easy' | 'normal' | 'hard',
        create: false,
        sessionId: res.sessionId,
      });
    } catch (e) {
      setError((e as Error).message || t('wordMatch.joinFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('wordMatch.joinTitle')}</Text>
        <Text style={styles.sub}>{t('wordMatch.joinSubtitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('wordMatch.codePlaceholder')}
          placeholderTextColor="#6b7280"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => void onJoin()}
          disabled={loading || !isLoaded}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('wordMatch.joinCta')}</Text>
          )}
        </Pressable>
        <Pressable style={styles.link} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#9ca3af', marginTop: 8, fontSize: 14, lineHeight: 20 },
  input: {
    marginTop: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  error: { color: '#f87171', marginTop: 10, fontWeight: '700' },
  btn: {
    marginTop: 20,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#a5b4fc', fontWeight: '800' },
});
