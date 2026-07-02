import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleHere'>;

type Person = {
  id: string;
  username: string;
  relationship: 'friend' | 'stranger';
  profileLevel: 'stub' | 'public';
};

export default function PeopleHereScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { venueId, venueName } = route.params;
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const peopleRef = useRef(people);
  peopleRef.current = people;

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!isLoaded) return;

      const hasPeople = peopleRef.current.length > 0;
      if (mode === 'initial' && !hasPeople) {
        setInitializing(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }

      try {
        const token = await getTokenRef.current();
        if (!token) {
          if (!hasPeople) {
            setPeople([]);
            setMyPlayerId(null);
          }
          return;
        }
        const [summary, list] = await Promise.all([
          apiGet<MeSummaryDto>('/players/me/summary', token),
          apiGet<Person[]>(
            `/social/venues/${encodeURIComponent(venueId)}/people-here`,
            token,
          ),
        ]);
        setMyPlayerId(summary.playerId ?? null);
        setPeople(Array.isArray(list) ? list : []);
      } catch {
        if (!hasPeople) {
          setPeople([]);
          setMyPlayerId(null);
        }
      } finally {
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [isLoaded, venueId],
  );

  useFocusEffect(
    useCallback(() => {
      if (peopleRef.current.length > 0) {
        void load('refresh');
      } else {
        void load('initial');
      }
    }, [load]),
  );

  const handleRefresh = useCallback(() => {
    void load(peopleRef.current.length > 0 ? 'refresh' : 'initial');
  }, [load]);

  const heroSubtitle = venueName
    ? t('peopleHere.subtitleNamed', { venue: venueName })
    : t('peopleHere.subtitle');

  const showInitialSpinner = initializing && people.length === 0;

  const listHeader = (
    <>
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('peopleHere.title')}</Text>
        <Pressable
          onPress={handleRefresh}
          disabled={refreshing}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('peopleHere.refreshA11y')}
        >
          {refreshing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="people" size={28} color={colors.textInverse} />
        </View>
        <Text style={styles.heroTitle}>{t('peopleHere.heroTitle')}</Text>
        <Text style={styles.heroSub}>{heroSubtitle}</Text>
        {!showInitialSpinner ? (
          <Text style={styles.countLine}>
            {t('peopleHere.count', { n: people.length })}
          </Text>
        ) : null}
      </View>

      {showInitialSpinner ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={showInitialSpinner ? [] : people}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !showInitialSpinner ? (
            <View style={styles.emptyCard}>
              <Ionicons name="person-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('peopleHere.empty')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelf = myPlayerId != null && item.id === myPlayerId;
          const isFriend = item.relationship === 'friend';
          return (
            <View style={[styles.row, isSelf && styles.rowMe]}>
              <View style={[styles.avatar, isFriend ? styles.avatarFriend : styles.avatarStranger]}>
                <Ionicons
                  name={isFriend ? 'heart' : 'person'}
                  size={18}
                  color={isFriend ? colors.primaryDark : colors.textSecondary}
                />
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.username}
                  {isSelf ? ` · ${t('peopleHere.you')}` : ''}
                </Text>
                <View style={[styles.tagPill, isFriend ? styles.tagFriend : styles.tagStranger]}>
                  <Text style={[styles.tagText, isFriend ? styles.tagTextFriend : styles.tagTextStranger]}>
                    {isFriend ? t('peopleHere.friend') : t('peopleHere.stranger')}
                  </Text>
                </View>
              </View>
              {!isSelf ? (
                <Pressable
                  style={({ pressed }) => [styles.reportBtn, pressed && styles.pressed]}
                  onPress={() =>
                    navigation.navigate('ReportPlayer', {
                      venueId,
                      venueName,
                      reportedPlayerId: item.id,
                      reportedUsername: item.username,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('peopleHere.report')}
                >
                  <Text style={styles.reportBtnText}>{t('peopleHere.report')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
      flexShrink: 0,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    pressed: { opacity: 0.88 },
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '900',
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    countLine: {
      color: colors.textInverse,
      opacity: 0.85,
      fontSize: 13,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    centerBlock: {
      paddingVertical: spacing.xxl,
      alignItems: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowMe: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarFriend: { backgroundColor: colors.primaryMuted },
    avatarStranger: { backgroundColor: colors.bgElevated },
    rowMain: { flex: 1, minWidth: 0, gap: spacing.xs },
    name: { color: colors.text, fontWeight: '800', fontSize: 15 },
    tagPill: {
      alignSelf: 'flex-start',
      paddingVertical: 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
    },
    tagFriend: { backgroundColor: colors.primaryMuted },
    tagStranger: { backgroundColor: colors.bgElevated },
    tagText: { fontSize: 11, fontWeight: '800' },
    tagTextFriend: { color: colors.primaryDark },
    tagTextStranger: { color: colors.textMuted },
    reportBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.warningBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
    },
    reportBtnText: { color: colors.warning, fontSize: 11, fontWeight: '800' },
  });
}
