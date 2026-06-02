import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BrawlerResultsScoreRow } from '../types';
import type { ArenaStyles } from '../styles';

type GameOverProps = {
  styles: ArenaStyles;
  title: string;
  hint: string;
  onReplay: () => void;
  onExit: () => void;
};

export function ArenaGameOverOverlay({
  styles,
  title,
  hint,
  onReplay,
  onExit,
}: GameOverProps) {
  return (
    <View style={styles.gameOverOverlay}>
      <View style={styles.gameOverCard}>
        <Text style={styles.gameOverTitle}>{title}</Text>
        <Text style={styles.gameOverHint}>{hint}</Text>
        <View style={styles.gameOverActions}>
          <Pressable
            onPress={onReplay}
            style={({ pressed }) => [
              styles.gameOverBtn,
              styles.gameOverBtnPrimary,
              pressed && styles.gameOverBtnPressed,
            ]}
          >
            <Text style={styles.gameOverBtnPrimaryText}>Replay</Text>
          </Pressable>
          <Pressable
            onPress={onExit}
            style={({ pressed }) => [
              styles.gameOverBtn,
              styles.gameOverBtnSecondary,
              pressed && styles.gameOverBtnPressed,
            ]}
          >
            <Text style={styles.gameOverBtnSecondaryText}>Exit</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type PreMatchProps = {
  styles: ArenaStyles;
  countdown: number;
};

export function ArenaPreMatchOverlay({ styles, countdown }: PreMatchProps) {
  return (
    <View style={styles.preMatchOverlay}>
      <Text style={styles.preMatchLabel}>Get ready</Text>
      <Text style={styles.preMatchDigit}>{countdown}</Text>
    </View>
  );
}

type VenueHoldProps = {
  styles: ArenaStyles;
  title: string;
  body: string;
  buttonLabel: string;
  onLeave: () => void;
};

export function ArenaVenuePvpHoldOverlay({
  styles,
  title,
  body,
  buttonLabel,
  onLeave,
}: VenueHoldProps) {
  return (
    <View style={styles.venuePvpHoldOverlay} pointerEvents="auto">
      <View style={styles.venuePvpHoldCard}>
        <Text style={styles.venuePvpHoldTitle}>{title}</Text>
        <Text style={styles.venuePvpHoldBody}>{body}</Text>
        <Pressable
          onPress={onLeave}
          style={({ pressed }) => [styles.venuePvpHoldBtn, pressed && styles.resultsBtnPressed]}
        >
          <Text style={styles.venuePvpHoldBtnText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ResultsProps = {
  styles: ArenaStyles;
  title: string;
  scoreboard: BrawlerResultsScoreRow[];
  onBackToLobby: () => void;
};

export function ArenaResultsOverlay({
  styles,
  title,
  scoreboard,
  onBackToLobby,
}: ResultsProps) {
  return (
    <View style={styles.resultsOverlay} pointerEvents="box-none">
      <View style={styles.resultsCard} pointerEvents="auto">
        <Text style={styles.resultsTitle}>{title}</Text>
        <Text style={styles.resultsSubtitle}>Scoreboard</Text>
        <View style={styles.resultsTable}>
          <View style={[styles.resultsTableRow, styles.resultsTableHeaderRow]}>
            <Text style={[styles.resultsTh, styles.resultsColName]}>Player</Text>
            <Text style={[styles.resultsTh, styles.resultsColStat]}>K</Text>
            <Text style={[styles.resultsTh, styles.resultsColStat]}>D</Text>
            <Text style={[styles.resultsTh, styles.resultsColXp]}>XP</Text>
            <Text style={[styles.resultsTh, styles.resultsColResult]}>Out</Text>
          </View>
          {scoreboard.map((row, i) => (
            <View
              key={`${row.name}-${i}`}
              style={[
                styles.resultsTableRow,
                i === scoreboard.length - 1 && styles.resultsTableRowLast,
              ]}
            >
              <Text style={[styles.resultsTd, styles.resultsColName]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.resultsTd, styles.resultsColStat]}>{row.kills}</Text>
              <Text style={[styles.resultsTd, styles.resultsColStat]}>{row.deaths}</Text>
              <Text style={[styles.resultsTd, styles.resultsColXp]}>
                {row.xpGained > 0 ? `+${row.xpGained}` : '—'}
              </Text>
              <Text style={[styles.resultsTd, styles.resultsColResult]}>{row.resultLabel}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={onBackToLobby}
          style={({ pressed }) => [styles.resultsBtn, pressed && styles.resultsBtnPressed]}
        >
          <Text style={styles.resultsBtnText}>Back to lobby</Text>
        </Pressable>
      </View>
    </View>
  );
}
