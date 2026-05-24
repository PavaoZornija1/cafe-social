import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { fetchMyMemberCard, type MemberCardDto } from '../lib/memberCardApi';
import { cacheMemberCard, loadCachedMemberCard } from '../lib/memberCardCache';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MemberCard'>;

export default function MemberCardScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const [card, setCard] = useState<MemberCardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const fresh = await fetchMyMemberCard(token);
      await cacheMemberCard(fresh);
      setCard(fresh);
      setOffline(false);
    } catch (e) {
      const cached = await loadCachedMemberCard();
      setCard(cached);
      setOffline(Boolean(cached));
      setError(
        cached
          ? t('memberCard.offlineHint')
          : (e as Error).message || t('memberCard.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('memberCard.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>{t('memberCard.lead')}</Text>
        {offline ? <Text style={styles.offlineHint}>{t('memberCard.offlineHint')}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : card ? (
          <View style={styles.qrCard}>
            <Text style={styles.username}>{card.username}</Text>
            <View style={styles.qrWrap}>
              {card.qrPayload ? (
                <QRCode value={card.qrPayload} size={220} backgroundColor="#FFFFFF" color="#1a1a1a" />
              ) : null}
            </View>
            <Text style={styles.hint}>{t('memberCard.scanHint')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    backBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    backText: { color: colors.textSecondary, fontWeight: '600' },
    title: { color: colors.text, fontSize: 20, fontWeight: '900', flex: 1 },
    scroll: { padding: 20, paddingBottom: 32 },
    lead: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    offlineHint: { color: colors.honeyDark, fontSize: 12, fontWeight: '700', marginBottom: 12 },
    error: { color: colors.error, fontSize: 13, marginBottom: 12 },
    qrCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
    },
    username: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 16 },
    qrWrap: {
      width: 252,
      height: 252,
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 17,
    },
  });
}
