import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { reportPlayerAtVenue } from '../lib/venueReportPlayer';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportPlayer'>;

const REASON_MIN = 3;
const REASON_MAX = 256;
const NOTE_MAX = 2000;

export default function ReportPlayerScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { venueId, venueName, reportedPlayerId, reportedUsername } = route.params;
  const { t } = useTranslation();
  const { getToken } = useAuth();

  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasonLen = reason.trim().length;
  const canSubmit =
    reasonLen >= REASON_MIN &&
    reasonLen <= REASON_MAX &&
    note.trim().length <= NOTE_MAX &&
    !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(t('common.error'), t('reportPlayer.signInRequired'));
        return;
      }
      await reportPlayerAtVenue(token, venueId, {
        reportedPlayerId,
        reason: reason.trim(),
        note: note.trim() || null,
      });
      Alert.alert(t('reportPlayer.successTitle'), t('reportPlayer.successBody'), [
        { text: t('common.continue'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('reportPlayer.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.title}>{t('reportPlayer.title')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sub}>
            {venueName ? `${venueName} · ` : ''}
            {t('reportPlayer.subtitle', { username: reportedUsername })}
          </Text>

          <Text style={styles.label}>{t('reportPlayer.reasonLabel')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('reportPlayer.reasonPlaceholder')}
            placeholderTextColor="#64748b"
            style={styles.input}
            multiline
            maxLength={REASON_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>
            {t('reportPlayer.reasonHint', { min: REASON_MIN, max: REASON_MAX, n: reasonLen })}
          </Text>

          <Text style={[styles.label, styles.labelSpaced]}>{t('reportPlayer.noteLabel')}</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('reportPlayer.notePlaceholder')}
            placeholderTextColor="#64748b"
            style={[styles.input, styles.noteInput]}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>{t('reportPlayer.noteHint', { max: NOTE_MAX })}</Text>

          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.submitText}>{t('reportPlayer.submit')}</Text>
            )}
          </Pressable>

          <Text style={styles.footer}>{t('reportPlayer.footer')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  label: { color: colors.text, fontWeight: '700', fontSize: 14 },
  labelSpaced: { marginTop: 18 },
  input: {
    marginTop: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    minHeight: 88,
  },
  noteInput: { minHeight: 120 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  submit: {
    marginTop: 28,
    backgroundColor: '#b45309',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.honeyDark,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.textInverse, fontWeight: '800', fontSize: 16 },
  footer: { color: '#475569', fontSize: 12, marginTop: 20, lineHeight: 18 },

    });
}
