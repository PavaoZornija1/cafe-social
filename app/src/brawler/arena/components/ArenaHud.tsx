import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMatchClock } from '../combat';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
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
  onToggleDev: () => void;
  resetLabel: string;
  onReset: () => void;
  onExit: () => void;
};

export function ArenaHud({
  styles,
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
  onToggleDev,
  resetLabel,
  onReset,
  onExit,
}: Props) {
  return (
    <View style={styles.hud}>
      <View style={styles.hudSideLeft}>
        <Pressable onPress={onExit} style={styles.backBtn}>
          <Text style={styles.backText}>← Exit</Text>
        </Pressable>
        <View style={styles.hudHpWrap} pointerEvents="none">
          <View style={styles.hudHpTrack}>
            <View
              style={[
                styles.hudHpFill,
                {
                  width: `${Math.round((heroHp / heroHpMax) * 100)}%`,
                  opacity: heroIFramesLeft > 0 ? 0.7 : 1,
                },
              ]}
            />
          </View>
          <Text style={styles.hudHpText}>
            HP {Math.round(heroHp)}/{heroHpMax}
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
          <Text style={styles.hudTitle}>Arena</Text>
          {!sessionId ? (
            <Pressable
              onPress={onToggleDev}
              style={({ pressed }) => [styles.devBtn, pressed && styles.devBtnPressed]}
              accessibilityLabel="Toggle dev settings"
            >
              <Text style={styles.devBtnText}>Dev</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.resetBtn, pressed && styles.resetBtnPressed]}
        >
          <Text style={styles.resetBtnText}>{resetLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
