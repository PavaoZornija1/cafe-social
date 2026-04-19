import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useMemo } from 'react';
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
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'WordMatchJoin'>;

export default function WordMatchJoinScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { venueId, challengeId } = route.params ?? {};
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
      const { coords } = await fetchDetectedVenue();
      const res = await apiPost<{
        sessionId: string;
        mode: 'coop' | 'versus';
        difficulty: string;
      }>('/words/matches/join', {
        inviteCode: trimmed,
        latitude: coords?.lat,
        longitude: coords?.lng,
      }, token);
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
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('wordMatch.joinTitle')}</Text>
      </View>
      <View style={styles.container}>
        <Text style={styles.sub}>{t('wordMatch.joinSubtitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('wordMatch.codePlaceholder')}
          placeholderTextColor={colors.textMuted}
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
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.btnText}>{t('wordMatch.joinCta')}</Text>
          )}
        </Pressable>
      </View>
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
    marginBottom: 4,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '900', flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  sub: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  input: {
    marginTop: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  error: { color: colors.error, marginTop: 10, fontWeight: '700' },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: colors.textInverse, fontWeight: '900', fontSize: 16 },

    });
}
