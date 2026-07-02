import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatMatchClock } from '../combat';
import type { ArenaSafeInsets } from '../arenaSafeArea';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
  safeInsets: ArenaSafeInsets;
  showKdHud: boolean;
  kills: number;
  deaths: number;
  showHudMatchClock: boolean;
  phaseLabel: string;
  matchClockSeconds: number;
  sessionId: string | undefined;
  onToggleDev: () => void;
  resetLabel: string;
  onReset: () => void;
  onExit: () => void;
};

export function ArenaHud({
  styles,
  safeInsets,
  showKdHud,
  kills,
  deaths,
  showHudMatchClock,
  phaseLabel,
  matchClockSeconds,
  sessionId,
  onToggleDev,
  resetLabel,
  onReset,
  onExit,
}: Props) {
  const { t } = useTranslation();
  const practiceMode = !sessionId;

  return (
    <View
      style={[
        styles.hud,
        {
          paddingLeft: safeInsets.left + 4,
          paddingRight: safeInsets.right + 4,
        },
      ]}
    >
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.hudPill, styles.hudExitPill, pressed && styles.hudPillPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('brawlerMatch.hudExit')}
      >
        <Ionicons name="chevron-back" size={16} color="#f8fafc" />
        <Text style={styles.hudExitText}>{t('brawlerMatch.hudExitShort')}</Text>
      </Pressable>

      <View style={styles.hudCenterCluster}>
        {showHudMatchClock ? (
          <View style={[styles.hudPill, styles.hudClockPill]}>
            <Text style={styles.hudPhase}>{phaseLabel}</Text>
            <Text style={styles.hudClock}>{formatMatchClock(matchClockSeconds)}</Text>
          </View>
        ) : null}
        {showKdHud ? (
          <View style={styles.hudKdRow}>
            <View style={[styles.hudPill, styles.hudKdPill]}>
              <Text style={styles.hudKdLabel}>{t('brawlerMatch.resultsKills')}</Text>
              <Text style={styles.hudKdValue}>{kills}</Text>
            </View>
            <View style={[styles.hudPill, styles.hudKdPill]}>
              <Text style={styles.hudKdLabel}>{t('brawlerMatch.resultsDeaths')}</Text>
              <Text style={styles.hudKdValue}>{deaths}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.hudRightCluster}>
        {practiceMode ? (
          <View style={[styles.hudPill, styles.hudPracticePill]}>
            <Text style={styles.hudPracticeText}>{t('brawlerMatch.hudPractice')}</Text>
          </View>
        ) : null}
        {practiceMode ? (
          <Pressable
            onPress={onToggleDev}
            style={({ pressed }) => [styles.hudPill, styles.hudDevPill, pressed && styles.hudPillPressed]}
            accessibilityLabel={t('brawlerMatch.hudDev')}
          >
            <Ionicons name="construct-outline" size={14} color="#cbd5e1" />
            <Text style={styles.hudDevText}>{t('brawlerMatch.hudDev')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.hudPill, styles.hudResetPill, pressed && styles.hudPillPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.hudResetText}>{resetLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
