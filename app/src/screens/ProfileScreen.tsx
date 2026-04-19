import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import type { MeSummaryDto } from '../lib/meSummary';
import { syncOnboardingFromServerSummary } from '../lib/onboardingStorage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

type PerkRedemptionItem = {
  id: string;
  redeemedAt: string;
  voided: boolean;
  venueId: string;
  venueName: string;
  perkCode: string;
  perkTitle: string;
  perkSubtitle: string | null;
  perkActiveTo: string | null;
  daysUntilExpiry: number | null;
  expiringSoon: boolean;
  expired: boolean;
};

type PerkRedemptionsPayload = {
  wallet: { activeRedemptions: number };
  expiringSoon: PerkRedemptionItem[];
  items: PerkRedemptionItem[];
};

export default function ProfileScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MeSummaryDto | null>(null);
  const [perkPayload, setPerkPayload] = useState<PerkRedemptionsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setSummary(null);
        setPerkPayload(null);
        return;
      }
      const [s, raw] = await Promise.all([
        apiGet<MeSummaryDto>('/players/me/summary', token),
        apiGet<PerkRedemptionsPayload | PerkRedemptionItem[]>(
          '/players/me/perk-redemptions',
          token,
        ),
      ]);
      await syncOnboardingFromServerSummary(s);
      setSummary(s);
      if (raw && typeof raw === 'object' && 'items' in raw && Array.isArray(raw.items)) {
        setPerkPayload(raw as PerkRedemptionsPayload);
      } else if (
        Array.isArray(raw) &&
        raw.length > 0 &&
        typeof raw[0] === 'object' &&
        raw[0] !== null &&
        'perk' in raw[0]
      ) {
        type Legacy = {
          id: string;
          redeemedAt: string;
          perk: { title: string; subtitle: string | null; code: string };
        };
        const legacy = raw as unknown as Legacy[];
        setPerkPayload({
          wallet: { activeRedemptions: legacy.length },
          expiringSoon: [],
          items: legacy.map((r) => ({
            id: r.id,
            redeemedAt: r.redeemedAt,
            voided: false,
            venueId: '',
            venueName: '',
            perkCode: r.perk.code,
            perkTitle: r.perk.title,
            perkSubtitle: r.perk.subtitle,
            perkActiveTo: null,
            daysUntilExpiry: null,
            expiringSoon: false,
            expired: false,
          })),
        });
      } else {
        setPerkPayload({ wallet: { activeRedemptions: 0 }, expiringSoon: [], items: [] });
      }
    } catch {
      setError(t('profile.loadError'));
      setSummary(null);
      setPerkPayload(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shareFriendLink = async () => {
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

  const formatRedeemed = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const wallet = perkPayload?.wallet;
  const expiringSoon = perkPayload?.expiringSoon ?? [];
  const redemptionItems = perkPayload?.items ?? [];

  const renderPerkLine = (row: PerkRedemptionItem) => (
    <View key={row.id} style={styles.listItem}>
      <Text style={styles.listTitle}>{row.perkTitle}</Text>
      {row.perkSubtitle ? <Text style={styles.listSub}>{row.perkSubtitle}</Text> : null}
      <Text style={styles.venueLine}>{t('profile.venueLine', { name: row.venueName })}</Text>
      <View style={styles.badgeRow}>
        {row.voided ? (
          <Text style={styles.badgeVoid}>{t('profile.voidedBadge')}</Text>
        ) : row.expired ? (
          <Text style={styles.badgeExpired}>{t('profile.expiredBadge')}</Text>
        ) : row.expiringSoon && row.daysUntilExpiry != null ? (
          <Text style={styles.badgeExpiring}>
            {t('profile.expiringBadge', { days: row.daysUntilExpiry })}
          </Text>
        ) : null}
      </View>
      <Text style={styles.listMeta}>
        {t('profile.redeemedAt', { when: formatRedeemed(row.redeemedAt) })} · {row.perkCode}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>{t('profile.subtitle')}</Text>

        <View style={styles.linkRow}>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
            onPress={() => navigation.navigate('Friends')}
          >
            <Text style={styles.linkBtnText}>{t('profile.openFriends')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
            onPress={() => void shareFriendLink()}
            disabled={sharing}
          >
            <Text style={styles.linkBtnText}>
              {sharing ? '…' : t('profile.shareFriendLink')}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : summary ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.xp')}</Text>
              <Text style={styles.value}>{summary.xp}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.tier')}</Text>
              <Text style={styles.value}>{summary.tier}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.completedChallenges')}</Text>
              <Text style={styles.value}>{summary.completedChallenges}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>{t('profile.venuesUnlocked')}</Text>
              <Text style={styles.value}>{summary.venuesUnlocked}</Text>
            </View>
          </View>
        ) : null}

        {wallet ? (
          <View style={[styles.card, styles.walletCard]}>
            <Text style={styles.sectionTitle}>{t('profile.walletTitle')}</Text>
            <Text style={styles.walletStat}>
              {t('profile.walletActive', { count: wallet.activeRedemptions })}
            </Text>
          </View>
        ) : null}

        {expiringSoon.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('profile.expiringSoonTitle')}</Text>
            <Text style={styles.sectionHint}>{t('profile.expiringSoonHint')}</Text>
            <View style={styles.list}>{expiringSoon.map(renderPerkLine)}</View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t('profile.recentPerksTitle')}</Text>
        <Text style={styles.sectionHint}>{t('profile.recentPerksHint')}</Text>
        {loading ? null : redemptionItems.length === 0 ? (
          <Text style={styles.muted}>{t('profile.recentPerksEmpty')}</Text>
        ) : (
          <View style={styles.list}>
            {redemptionItems.slice(0, 40).map(renderPerkLine)}
          </View>
        )}
      </ScrollView>
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
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  subtitle: { color: colors.textMuted, marginTop: 8, fontSize: 14, lineHeight: 20 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  linkBtn: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  linkBtnPressed: { opacity: 0.88 },
  linkBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  center: { paddingVertical: 24, alignItems: 'center' },
  error: { color: colors.error, marginTop: 12 },
  card: {
    marginTop: 20,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletCard: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { color: colors.textSecondary, fontSize: 14 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '700', marginTop: 24 },
  sectionHint: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  walletStat: { color: colors.honeyDark, fontSize: 15, fontWeight: '600', marginTop: 8 },
  list: { marginTop: 12, gap: 4 },
  listItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  listSub: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  venueLine: { color: '#818cf8', marginTop: 6, fontSize: 13, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badgeExpiring: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeExpired: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeVoid: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#450a0a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  listMeta: { color: colors.textMuted, marginTop: 8, fontSize: 12 },
  muted: { color: colors.textMuted, marginTop: 8 },

    });
}
