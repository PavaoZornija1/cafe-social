import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import WordGameHeader from '../components/word/WordGameHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

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
        ranked?: boolean;
        targetWordCount: number;
        deckCategory?: string | null;
      }>(
        '/words/matches/join',
        {
          inviteCode: trimmed,
          latitude: coords?.lat,
          longitude: coords?.lng,
        },
        token,
      );
      navigation.replace('WordMatchWait', {
        venueId,
        challengeId,
        mode: res.mode,
        difficulty: res.difficulty as 'easy' | 'normal' | 'hard',
        create: false,
        sessionId: res.sessionId,
        wordCount: res.targetWordCount,
        wordCategory: res.deckCategory ?? undefined,
        ranked: res.mode === 'versus' && res.ranked ? true : undefined,
      });
    } catch (e) {
      setError((e as Error).message || t('wordMatch.joinFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <WordGameHeader
        colors={colors}
        title={t('wordMatch.joinTitle')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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
            <Ionicons name="key-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('wordMatch.joinHeroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('wordMatch.joinSubtitle')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAccent} />
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.textInverse} />
            </View>
            <Text style={styles.cardTitle}>{t('wordMatch.joinCardTitle')}</Text>
          </View>

          <Text style={styles.inputLabel}>{t('wordMatch.roomCode')}</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder={t('wordMatch.codePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={(v) => {
              setError(null);
              setCode(v.toUpperCase());
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={() => void onJoin()}
          />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <Text style={styles.inputHint}>{t('wordMatch.joinInputHint')}</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            (loading || !isLoaded) && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => void onJoin()}
          disabled={loading || !isLoaded}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{t('wordMatch.joinCta')}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
            </>
          )}
        </Pressable>
      </ScrollView>
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
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.lg,
    },
    heroGradient: {
      ...StyleSheet.absoluteFillObject,
    },
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
      fontSize: 17,
      fontWeight: '700',
      lineHeight: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      marginBottom: spacing.lg,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
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
      marginBottom: spacing.xs,
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
    inputLabel: {
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    input: {
      marginTop: spacing.xs,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: 6,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.errorMuted,
    },
    inputHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    error: {
      flex: 1,
      color: colors.error,
      fontWeight: '700',
      fontSize: 13,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minHeight: 48,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontWeight: '900',
      fontSize: 16,
    },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.9 },
  });
}
