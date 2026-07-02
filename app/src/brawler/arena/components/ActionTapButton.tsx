import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import type { ArenaStyles } from '../styles';

type Kind = 'hit' | 'dash' | 'jump';

type Props = {
  kind: Kind;
  enabled: boolean;
  label: string;
  left: number;
  top: number;
  styles: ArenaStyles;
  pressed?: boolean;
  /** 0 = just used, 1 = ready (dash recharge). */
  dashCooldownProgress?: number;
  dashCooldownSecondsLeft?: number;
};

const ICONS: Record<Kind, keyof typeof Ionicons.glyphMap> = {
  hit: 'flash',
  dash: 'arrow-forward-circle',
  jump: 'arrow-up-circle',
};

export function ActionTapButton({
  kind,
  enabled,
  label,
  left,
  top,
  styles,
  pressed = false,
  dashCooldownProgress = 1,
  dashCooldownSecondsLeft = 0,
}: Props) {
  const onDashCooldown = kind === 'dash' && dashCooldownProgress < 1;
  const baseStyle =
    kind === 'hit'
      ? styles.ctrlCircleHit
      : kind === 'dash'
        ? styles.ctrlCircleDash
        : styles.ctrlCircleJump;

  const ringStyle =
    kind === 'hit'
      ? styles.ctrlRingHit
      : kind === 'dash'
        ? styles.ctrlRingDash
        : styles.ctrlRingJump;

  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      pointerEvents="none"
      style={[
        styles.ctrlBtnOuter,
        styles.ctrlCircleAbsolute,
        { left, top },
        pressed && styles.ctrlPressed,
        !enabled && !onDashCooldown && styles.ctrlBtnDisabled,
      ]}
    >
      <View style={[styles.ctrlRing, ringStyle, onDashCooldown && styles.ctrlRingCooldown]} />
      <View
        style={[
          baseStyle,
          onDashCooldown && styles.ctrlCircleOnCooldown,
          pressed && styles.ctrlCirclePressed,
        ]}
      >
        <View style={styles.ctrlCircleGloss} pointerEvents="none" />
        {onDashCooldown ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.ctrlCooldownSand,
                { height: `${Math.round(dashCooldownProgress * 100)}%` },
              ]}
            />
            <View style={styles.ctrlCooldownVeil} pointerEvents="none" />
            <Ionicons name="hourglass" size={22} color="rgba(255,255,255,0.92)" />
            <Text style={styles.ctrlCooldownSeconds}>
              {Math.max(1, Math.ceil(dashCooldownSecondsLeft))}
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name={ICONS[kind]}
              size={kind === 'hit' ? 26 : 24}
              color="rgba(255,255,255,0.95)"
            />
            <Text style={styles.ctrlCircleLabel}>{label}</Text>
          </>
        )}
      </View>
    </View>
  );
}
