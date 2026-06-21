import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMatchClock } from '../combat';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
  iconColor: string;
  heroHp: number;
  heroHpMax: number;
  heroIFramesLeft: number;
  showKdHud: boolean;
  kills: number;
  deaths: number;
  showHudMatchClock: boolean;
  phaseLabel: string;
  matchClockSeconds: number;
  sessionId: string | undefined;
  exitLabel: string;
  titleLabel: string;
  devLabel: string;
  resetLabel: string;
  hpLabel: string;
  onToggleDev: () => void;
  onReset: () => void;
  onExit: () => void;
};

export function ArenaHud({
  styles,
  iconColor,
  heroHp,
  heroHpMax,
  heroIFramesLeft,
  showKdHud,
  kills,
  deaths,
  showHudMatchClock,
  phaseLabel,
  matchClockSeconds,
  sessionId,
  exitLabel,
  titleLabel,
  devLabel,
  resetLabel,
  hpLabel,
  onToggleDev,
  onReset,
  onExit,
}: Props) {
  const hpPct = heroHpMax > 0 ? Math.round((heroHp / heroHpMax) * 100) : 0;

  return (
    <View style={styles.hud}>
      <View style={styles.hudSideLeft}>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => [styles.hudIconBtn, pressed && styles.hudBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={exitLabel}
        >
          <Ionicons name="close" size={18} color={iconColor} />
        </Pressable>
        <View style={styles.hudHpWrap} pointerEvents="none">
          <View style={styles.hudHpTrack}>
            <View
              style={[
                styles.hudHpFill,
                {
                  width: `${hpPct}%`,
                  opacity: heroIFramesLeft > 0 ? 0.7 : 1,
                },
              ]}
            />
          </View>
          <Text style={styles.hudHpText}>
            {hpLabel} {Math.round(heroHp)}/{heroHpMax}
          </Text>
          {showKdHud ? (
            <Text style={styles.hudKdText} pointerEvents="none">
              K {kills} · D {deaths}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.hudCenter}>
        {showHudMatchClock ? (
          <>
            <Text style={styles.hudPhase}>{phaseLabel}</Text>
            <Text style={styles.hudClock}>{formatMatchClock(matchClockSeconds)}</Text>
          </>
        ) : null}
      </View>
      <View style={styles.hudSideRight}>
        <View style={styles.hudRightRow}>
          <Text style={styles.hudTitle}>{titleLabel}</Text>
          {!sessionId ? (
            <Pressable
              onPress={onToggleDev}
              style={({ pressed }) => [styles.devBtn, pressed && styles.hudBtnPressed]}
              accessibilityLabel={devLabel}
            >
              <Text style={styles.devBtnText}>{devLabel}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.resetBtn, pressed && styles.hudBtnPressed]}
        >
          <Text style={styles.resetBtnText}>{resetLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
