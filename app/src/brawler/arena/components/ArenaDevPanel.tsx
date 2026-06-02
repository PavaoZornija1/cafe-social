import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
  devMatchTimerEnabled: boolean;
  devEnemiesEnabled: boolean;
  devEnemyCount: number;
  devDummiesEnabled: boolean;
  devDummyCount: number;
  devShowAttackHitbox: boolean;
  onMatchTimerPress: () => void;
  onEnemiesPress: () => void;
  onEnemyDecrement: () => void;
  onEnemyIncrement: () => void;
  onDummiesPress: () => void;
  onDummyDecrement: () => void;
  onDummyIncrement: () => void;
  onHitboxDebugPress: () => void;
};

export function ArenaDevPanel({
  styles,
  devMatchTimerEnabled,
  devEnemiesEnabled,
  devEnemyCount,
  devDummiesEnabled,
  devDummyCount,
  devShowAttackHitbox,
  onMatchTimerPress,
  onEnemiesPress,
  onEnemyDecrement,
  onEnemyIncrement,
  onDummiesPress,
  onDummyDecrement,
  onDummyIncrement,
  onHitboxDebugPress,
}: Props) {
  return (
    <View style={styles.devPanelOverlay} pointerEvents="box-none">
      <View style={styles.devPanel} pointerEvents="auto">
        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Match timer</Text>
          <Pressable
            onPress={onMatchTimerPress}
            style={({ pressed }) => [
              styles.devChip,
              devMatchTimerEnabled ? styles.devChipOn : styles.devChipOff,
              pressed && styles.devChipPressed,
            ]}
          >
            <Text style={styles.devChipText}>
              {devMatchTimerEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Enemies</Text>
          <Pressable
            onPress={onEnemiesPress}
            style={({ pressed }) => [
              styles.devChip,
              devEnemiesEnabled ? styles.devChipOn : styles.devChipOff,
              pressed && styles.devChipPressed,
            ]}
          >
            <Text style={styles.devChipText}>{devEnemiesEnabled ? 'On' : 'Off'}</Text>
          </Pressable>
          <View style={styles.devStepper}>
            <Pressable
              onPress={onEnemyDecrement}
              style={({ pressed }) => [styles.devStepBtn, pressed && styles.devStepBtnPressed]}
            >
              <Text style={styles.devStepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.devValue}>{devEnemyCount}</Text>
            <Pressable
              onPress={onEnemyIncrement}
              style={({ pressed }) => [styles.devStepBtn, pressed && styles.devStepBtnPressed]}
            >
              <Text style={styles.devStepBtnText}>＋</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Dummies</Text>
          <Pressable
            onPress={onDummiesPress}
            style={({ pressed }) => [
              styles.devChip,
              devDummiesEnabled ? styles.devChipOn : styles.devChipOff,
              pressed && styles.devChipPressed,
            ]}
          >
            <Text style={styles.devChipText}>{devDummiesEnabled ? 'On' : 'Off'}</Text>
          </Pressable>
          <View style={styles.devStepper}>
            <Pressable
              onPress={onDummyDecrement}
              style={({ pressed }) => [styles.devStepBtn, pressed && styles.devStepBtnPressed]}
            >
              <Text style={styles.devStepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.devValue}>{devDummyCount}</Text>
            <Pressable
              onPress={onDummyIncrement}
              style={({ pressed }) => [styles.devStepBtn, pressed && styles.devStepBtnPressed]}
            >
              <Text style={styles.devStepBtnText}>＋</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.devRow}>
          <Text style={styles.devLabel}>Hitbox debug</Text>
          <Pressable
            onPress={onHitboxDebugPress}
            style={({ pressed }) => [
              styles.devChip,
              devShowAttackHitbox ? styles.devChipOn : styles.devChipOff,
              pressed && styles.devChipPressed,
            ]}
          >
            <Text style={styles.devChipText}>{devShowAttackHitbox ? 'On' : 'Off'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
