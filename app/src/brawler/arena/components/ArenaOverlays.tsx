import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { BrawlerResultsScoreRow } from '../types';
import type { ArenaStyles } from '../styles';

type GameOverProps = {
  styles: ArenaStyles;
  title: string;
  hint: string;
  replayLabel: string;
  exitLabel: string;
  onReplay: () => void;
  onExit: () => void;
};

export function ArenaGameOverOverlay({
  styles,
  title,
  hint,
  replayLabel,
  exitLabel,
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
            <Text style={styles.gameOverBtnPrimaryText}>{replayLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onExit}
            style={({ pressed }) => [
              styles.gameOverBtn,
              styles.gameOverBtnSecondary,
              pressed && styles.gameOverBtnPressed,
            ]}
          >
            <Text style={styles.gameOverBtnSecondaryText}>{exitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type HeroDeadProps = {
  styles: ArenaStyles;
  title: string;
  body: string;
  leaveLabel: string;
  spectateLabel: string;
  onLeaveToLobby: () => void;
  onSpectate: () => void;
};

export function ArenaHeroDeadOverlay({
  styles,
  title,
  body,
  leaveLabel,
  spectateLabel,
  onLeaveToLobby,
  onSpectate,
}: HeroDeadProps) {
  return (
    <View style={styles.gameOverOverlay}>
      <View style={styles.gameOverCard}>
        <Text style={styles.gameOverTitle}>{title}</Text>
        <Text style={styles.gameOverHint}>{body}</Text>
        <View style={styles.gameOverActions}>
          <Pressable
            onPress={onLeaveToLobby}
            style={({ pressed }) => [
              styles.gameOverBtn,
              styles.gameOverBtnSecondary,
              pressed && styles.gameOverBtnPressed,
            ]}
          >
            <Text style={styles.gameOverBtnSecondaryText}>{leaveLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onSpectate}
            style={({ pressed }) => [
              styles.gameOverBtn,
              styles.gameOverBtnPrimary,
              pressed && styles.gameOverBtnPressed,
            ]}
          >
            <Text style={styles.gameOverBtnPrimaryText}>{spectateLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

type PreMatchProps = {
  styles: ArenaStyles;
  label: string;
  countdown: number;
};

export function ArenaPreMatchOverlay({ styles, label, countdown }: PreMatchProps) {
  return (
    <View style={styles.preMatchOverlay}>
      <Text style={styles.preMatchLabel}>{label}</Text>
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

type ResultsTableLabels = {
  subtitle: string;
  player: string;
  kills: string;
  deaths: string;
  xp: string;
  outcome: string;
  backToLobby: string;
};

type ResultsProps = {
  styles: ArenaStyles;
  title: string;
  tableLabels: ResultsTableLabels;
  scoreboard: BrawlerResultsScoreRow[];
  onBackToLobby: () => void;
};

export function ArenaResultsOverlay({
  styles,
  title,
  tableLabels,
  scoreboard,
  onBackToLobby,
}: ResultsProps) {
  return (
    <View style={styles.resultsOverlay} pointerEvents="box-none">
      <View style={styles.resultsCard} pointerEvents="auto">
        <Text style={styles.resultsTitle}>{title}</Text>
        <Text style={styles.resultsSubtitle}>{tableLabels.subtitle}</Text>
        <View style={styles.resultsTable}>
          <View style={[styles.resultsTableRow, styles.resultsTableHeaderRow]}>
            <Text style={[styles.resultsTh, styles.resultsColName]}>{tableLabels.player}</Text>
            <Text style={[styles.resultsTh, styles.resultsColStat]}>{tableLabels.kills}</Text>
            <Text style={[styles.resultsTh, styles.resultsColStat]}>{tableLabels.deaths}</Text>
            <Text style={[styles.resultsTh, styles.resultsColXp]}>{tableLabels.xp}</Text>
            <Text style={[styles.resultsTh, styles.resultsColResult]}>{tableLabels.outcome}</Text>
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
          <Text style={styles.resultsBtnText}>{tableLabels.backToLobby}</Text>
        </Pressable>
      </View>
    </View>
  );
}
