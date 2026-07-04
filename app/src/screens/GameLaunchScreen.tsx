import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { triggerFeedback } from '../lib/feedback';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'GameLaunch'>;

/** Hold long enough for the stinger + music crossfade to land before the match UI. */
const LAUNCH_MS = 2400;

function playerInitial(username: string): string {
  const t = username.trim();
  return t ? t[0]!.toUpperCase() : '?';
}

export default function GameLaunchScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const params = route.params;
  const advancedRef = useRef(false);

  useEffect(() => {
    triggerFeedback('lobbyStart');
    const timer = setTimeout(() => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      if (params.kind === 'word') {
        navigation.replace('WordGame', params.word);
      } else {
        navigation.replace('BrawlerArena', params.brawler);
      }
    }, LAUNCH_MS);
    return () => clearTimeout(timer);
  }, [navigation, params]);

  const title =
    params.kind === 'word' ? t('gameLaunch.titleWord') : t('gameLaunch.titleBrawler');

  const modeLabel = useMemo(() => {
    if (params.kind === 'word') {
      const mode = params.word.mode;
      if (mode === 'solo') return t('gameLaunch.modeSolo');
      if (mode === 'coop') return t('gameLaunch.modeCoop');
      return params.word.ranked ? t('gameLaunch.modeRankedVersus') : t('gameLaunch.modeVersus');
    }
    if (params.brawler.soloOptions) return t('gameLaunch.modePractice');
    if (params.brawler.sessionId) return t('gameLaunch.modeMatch');
    return t('gameLaunch.modeMatch');
  }, [params, t]);

  const players = params.players?.length
    ? params.players
    : params.kind === 'word' && params.word.mode === 'solo'
      ? [{ username: t('gameLaunch.you'), isYou: true }]
      : params.kind === 'brawler' && params.brawler.soloOptions
        ? [{ username: t('gameLaunch.you'), isYou: true }]
        : [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons
            name={params.kind === 'word' ? 'text-outline' : 'flash-outline'}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={styles.kicker}>{t('gameLaunch.getReady')}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.mode}>{modeLabel}</Text>

        {players.length > 0 ? (
          <View style={styles.players}>
            <Text style={styles.playersLabel}>{t('gameLaunch.players')}</Text>
            {players.map((p, index) => (
              <View
                key={`${p.username}-${index}`}
                style={[styles.playerRow, p.isYou && styles.playerRowYou]}
              >
                <View style={[styles.avatar, p.isYou && styles.avatarYou]}>
                  <Text style={[styles.avatarText, p.isYou && styles.avatarTextYou]}>
                    {playerInitial(p.username)}
                  </Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.username}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.footer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.starting}>{t('gameLaunch.starting')}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    body: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      width: 64,
      height: 64,
      borderRadius: radii.xl,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    kicker: {
      color: colors.honeyDark,
      fontWeight: '800',
      fontSize: 13,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      textAlign: 'center',
    },
    mode: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    players: {
      alignSelf: 'stretch',
      marginTop: spacing.xxl,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    playersLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.xs,
    },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
    },
    playerRowYou: {
      backgroundColor: colors.primaryMuted,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarYou: {
      backgroundColor: colors.primary,
    },
    avatarText: {
      color: colors.text,
      fontWeight: '800',
      fontSize: 15,
    },
    avatarTextYou: {
      color: colors.textInverse,
    },
    playerName: {
      flex: 1,
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    footer: {
      marginTop: spacing.xxl,
      alignItems: 'center',
      gap: spacing.md,
    },
    starting: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
