import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ActiveBuff, BrawlerPowerupDef } from '../types';
import type { ArenaStyles } from '../styles';

export type ActivePowerupHudRow = {
  powerupId: string;
  displayName: string;
  effectType: ActiveBuff['effectType'];
  remainingSec: number;
  progress: number;
};

export type PowerupPickupFlash = {
  displayName: string;
  effectType: ActiveBuff['effectType'];
  endsAtMs: number;
};

const EFFECT_COLORS: Record<ActiveBuff['effectType'], string> = {
  MOVE_SPEED_MULT: '#22d3ee',
  ATTACK_DMG_MULT: '#f97316',
  JUMP_MULT: '#22c55e',
  DASH_SPEED_MULT: '#eab308',
  DASH_COOLDOWN_MULT: '#a78bfa',
  HEAL_MAX_HP_PCT: '#4ade80',
};

export function buildActivePowerupHudRows(
  buffs: ActiveBuff[],
  defs: BrawlerPowerupDef[],
  nowMs: number,
): ActivePowerupHudRow[] {
  return buffs
    .filter((b) => b.endsAtMs > nowMs && b.effectType !== 'HEAL_MAX_HP_PCT')
    .map((b) => {
      const def = defs.find((d) => d.id === b.powerupId);
      const totalMs = Math.max(1, b.endsAtMs - b.startedAtMs);
      const remainingMs = Math.max(0, b.endsAtMs - nowMs);
      return {
        powerupId: b.powerupId,
        displayName: def?.displayName ?? b.powerupId,
        effectType: b.effectType,
        remainingSec: Math.ceil(remainingMs / 1000),
        progress: remainingMs / totalMs,
      };
    });
}

type Props = {
  styles: ArenaStyles;
  rows: ActivePowerupHudRow[];
  pickupFlash: PowerupPickupFlash | null;
  nowMs: number;
  pickupLabel: string;
  insetStyle?: StyleProp<ViewStyle>;
};

export function ArenaActivePowerupsHud({
  styles,
  rows,
  pickupFlash,
  nowMs,
  pickupLabel,
  insetStyle,
}: Props) {
  const showPickupToast =
    pickupFlash != null && pickupFlash.endsAtMs > nowMs;

  if (!rows.length && !showPickupToast) return null;

  return (
    <View style={[styles.powerupHudWrap, insetStyle]} pointerEvents="none">
      {showPickupToast ? (
        <View
          style={[
            styles.powerupPickupToast,
            { borderColor: EFFECT_COLORS[pickupFlash.effectType] },
          ]}
        >
          <Text style={styles.powerupPickupToastLabel}>{pickupLabel}</Text>
          <Text
            style={[
              styles.powerupPickupToastName,
              { color: EFFECT_COLORS[pickupFlash.effectType] },
            ]}
          >
            {pickupFlash.displayName}
          </Text>
        </View>
      ) : null}

      {rows.map((row) => {
        const accent = EFFECT_COLORS[row.effectType];
        return (
          <View
            key={row.powerupId}
            style={[styles.powerupHudChip, { borderColor: accent }]}
          >
            <View style={styles.powerupHudChipHeader}>
              <View style={[styles.powerupHudDot, { backgroundColor: accent }]} />
              <Text style={styles.powerupHudName} numberOfLines={1}>
                {row.displayName}
              </Text>
              <Text style={styles.powerupHudTimer}>{row.remainingSec}s</Text>
            </View>
            <View style={styles.powerupHudBarTrack}>
              <View
                style={[
                  styles.powerupHudBarFill,
                  {
                    width: `${Math.round(row.progress * 100)}%`,
                    backgroundColor: accent,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
