import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  categoryLabel: string | null;
  primaryClue: string;
  extraHintText: string | null;
  extraHintRevealed: boolean;
  showExtraHintButton: boolean;
  guess: string;
  wrongFeedback: string | null;
  submitting: boolean;
  onGuessChange: (text: string) => void;
  onRevealHint: () => void;
  onSubmit: () => void;
};

export default function WordGameClueCard({
  colors,
  categoryLabel,
  primaryClue,
  extraHintText,
  extraHintRevealed,
  showExtraHintButton,
  guess,
  wrongFeedback,
  submitting,
  onGuessChange,
  onRevealHint,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.accent} />

      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="bulb" size={20} color={colors.textInverse} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('wordGame.guessTitle')}</Text>
          {categoryLabel ? <Text style={styles.category}>{categoryLabel}</Text> : null}
        </View>
      </View>

      <Text style={styles.clueLabel}>{t('wordGame.clueLabel')}</Text>
      <Text style={styles.clueBody}>{primaryClue}</Text>

      {showExtraHintButton && extraHintRevealed && extraHintText ? (
        <View style={styles.hintBox}>
          <Ionicons name="sparkles-outline" size={14} color={colors.honeyDark} />
          <Text style={styles.hintText}>{extraHintText}</Text>
        </View>
      ) : null}

      <TextInput
        style={[styles.input, wrongFeedback ? styles.inputError : null]}
        placeholder={t('wordGame.guessPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={guess}
        onChangeText={onGuessChange}
        autoCorrect={false}
        autoCapitalize="none"
        editable={!submitting}
        returnKeyType="done"
        onSubmitEditing={() => void onSubmit()}
      />

      {wrongFeedback ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="close-circle" size={16} color={colors.error} />
          <Text style={styles.wrongHint}>{wrongFeedback}</Text>
        </View>
      ) : null}

      {showExtraHintButton ? (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              extraHintRevealed && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={onRevealHint}
            disabled={extraHintRevealed}
          >
            <Text style={styles.secondaryBtnText}>
              {extraHintRevealed ? t('wordGame.extraHintShown') : t('wordGame.showExtraHint')}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              submitting && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? t('wordGame.checking') : t('wordGame.submit')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnFull,
            submitting && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={() => void onSubmit()}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? t('wordGame.checking') : t('wordGame.submit')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    accent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: colors.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerText: { flex: 1, gap: 2 },
    title: { color: colors.text, fontWeight: '900', fontSize: 18 },
    category: { color: colors.honeyDark, fontWeight: '800', fontSize: 12 },
    clueLabel: {
      color: colors.textMuted,
      fontWeight: '800',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.xs,
    },
    clueBody: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 26,
      fontWeight: '600',
    },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.honeyMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.honey,
    },
    hintText: {
      flex: 1,
      color: colors.honeyDark,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
    },
    input: {
      marginTop: spacing.sm,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    inputError: {
      borderColor: colors.error,
      backgroundColor: colors.errorMuted,
    },
    feedbackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    wrongHint: {
      flex: 1,
      color: colors.error,
      fontSize: 13,
      fontWeight: '700',
    },
    actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    primaryBtn: {
      flex: 1,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    primaryBtnFull: { flex: undefined, width: '100%', marginTop: spacing.md },
    primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 15 },
    secondaryBtn: {
      flex: 1,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    secondaryBtnText: { color: colors.textSecondary, fontWeight: '900', fontSize: 14 },
    btnDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.88 },
  });
}
