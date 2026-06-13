import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import QuestBundleCard from '../components/rewards/QuestBundleCard';
import QuestChallengeRow from '../components/rewards/QuestChallengeRow';
import QuestDetailModal from '../components/rewards/QuestDetailModal';
import QuestPeriodToggle from '../components/rewards/QuestPeriodToggle';
import {
  claimPlatformQuest,
  fetchPlatformQuestHub,
  formatQuestResetCountdown,
  type PlatformQuestHubPayload,
  type PlatformQuestRow,
  type QuestPeriod,
} from '../lib/platformQuestApi';
import { subscribePlatformQuestProgressChanged } from '../lib/platformQuestEvents';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardsHub'>;

export default function RewardsHubScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [period, setPeriod] = useState<QuestPeriod>('daily');
  const [hub, setHub] = useState<PlatformQuestHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<PlatformQuestRow | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!isLoaded) return;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setHub(null);
          return;
        }
        const data = await fetchPlatformQuestHub(token, period);
        setHub(data);
      } catch {
        setError(t('questHub.loadError'));
        setHub(null);
      } finally {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    },
    [isLoaded, period, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  useEffect(() => {
    return subscribePlatformQuestProgressChanged(() => {
      void load('refresh');
    });
  }, [load]);

  const handleClaim = async (questKey: string) => {
    const token = await getTokenRef.current();
    if (!token) return;
    setClaimingKey(questKey);
    try {
      const next = await claimPlatformQuest(token, period, questKey);
      setHub(next);
    } catch {
      setError(t('questHub.claimError'));
    } finally {
      setClaimingKey(null);
    }
  };

  const navigateForQuest = (quest: PlatformQuestRow) => {
    setSelectedQuest(null);
    switch (quest.key) {
      case 'check_in':
      case 'explore_venues':
        navigation.navigate('MainTabs', { screen: 'VenuesTab' });
        break;
      case 'solve_daily_word':
        navigation.navigate('DailyWord');
        break;
      case 'win_word_rooms':
        navigation.navigate('WordLobby', {});
        break;
      default:
        navigation.navigate('MainTabs', { screen: 'PlayTab' });
        break;
    }
  };

  const selectedIndex = selectedQuest
    ? (hub?.quests.findIndex((q) => q.key === selectedQuest.key) ?? 0)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('PerkWallet')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel={t('questHub.perkWalletA11y')}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.title}>{t('questHub.title')}</Text>
        <Text style={styles.subtitle}>{t('questHub.subtitle')}</Text>

        <View style={styles.toggleRow}>
          <QuestPeriodToggle
            colors={colors}
            period={period}
            dailyLabel={t('questHub.daily')}
            weeklyLabel={t('questHub.weekly')}
            onChange={setPeriod}
          />
          {hub ? (
            <View style={styles.resetPill}>
              <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
              <Text style={styles.resetText}>
                {t('questHub.resetsIn', { time: formatQuestResetCountdown(hub.resetsInMs) })}
              </Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {hub ? (
          <>
            <QuestBundleCard
              colors={colors}
              bundle={hub.bundle}
              periodLabel={
                period === 'daily' ? t('questHub.dailyBundleKicker') : t('questHub.weeklyBundleKicker')
              }
              completedLabel={t('questHub.completedCount', {
                current: hub.bundle.completedCount,
                total: hub.bundle.targetCount,
              })}
              remainingLabel={t('questHub.remainingCount', {
                count: Math.max(0, hub.bundle.targetCount - hub.bundle.completedCount),
              })}
              claimLabel={t('questHub.claimBundle', { xp: hub.bundle.xpReward })}
              claiming={claimingKey === hub.bundle.key}
              onClaim={() => void handleClaim(hub.bundle.key)}
            />

            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {period === 'daily' ? t('questHub.todayTitle') : t('questHub.weekTitle')}{' '}
                <Text style={styles.listCount}>{hub.quests.length} total</Text>
              </Text>
              <Text style={styles.availableXp}>
                {t('questHub.availableXp', { xp: hub.availableXp })}
              </Text>
            </View>

            <View style={styles.list}>
              {hub.quests.map((quest) => (
                <QuestChallengeRow
                  key={quest.key}
                  colors={colors}
                  quest={quest}
                  claimLabel={t('questHub.claimCta', { xp: quest.xpReward })}
                  claimedLabel={t('questHub.claimedCta', { xp: quest.claimedXp ?? quest.xpReward })}
                  claiming={claimingKey === quest.key}
                  onPress={() => setSelectedQuest(quest)}
                  onClaim={() => void handleClaim(quest.key)}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <QuestDetailModal
        colors={colors}
        visible={selectedQuest != null}
        quest={selectedQuest}
        questIndex={selectedIndex}
        questTotal={hub?.quests.length ?? 0}
        streak={0}
        playLabel={t('questHub.playCta')}
        xpRewardLabel={t('questHub.xpReward', { xp: selectedQuest?.xpReward ?? 0 })}
        onClose={() => setSelectedQuest(null)}
        onPlay={() => selectedQuest && navigateForQuest(selectedQuest)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
      marginBottom: spacing.sm,
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
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    toggleRow: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    resetPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-end',
    },
    resetText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    error: {
      color: colors.error,
      marginTop: spacing.md,
      fontSize: 14,
    },
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: spacing.xl,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    listTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      flex: 1,
    },
    listCount: {
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'none',
    },
    availableXp: {
      color: colors.xp,
      fontSize: 13,
      fontWeight: '800',
    },
    list: { gap: spacing.md },
    pressed: { opacity: 0.9 },
  });
}
