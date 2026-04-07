import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useState } from 'react';
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
import { apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'BanAppeal'>;

const MESSAGE_MIN = 8;

export default function BanAppealScreen({ navigation, route }: Props) {
  const { venueId, venueName } = route.params;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const len = message.trim().length;
  const canSubmit = len >= MESSAGE_MIN && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(t('common.error'), t('banAppeal.signInRequired'));
        return;
      }
      await apiPost<{ id: string }>(
        '/players/me/ban-appeals',
        { venueId, message: message.trim() },
        token,
      );
      Alert.alert(t('banAppeal.successTitle'), t('banAppeal.successBody'), [
        { text: t('common.continue'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('banAppeal.failed'));
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
          <Text style={styles.title}>{t('banAppeal.title')}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sub}>
            {venueName ? `${venueName} · ` : ''}
            {t('banAppeal.subtitle')}
          </Text>
          <Text style={styles.label}>{t('banAppeal.messageLabel')}</Text>
          <TextInput
            style={styles.inputMultiline}
            placeholder={t('banAppeal.messagePlaceholder')}
            placeholderTextColor="#6b7280"
            multiline
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />
          <Text style={styles.hint}>{t('banAppeal.messageHint')}</Text>
          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('banAppeal.submit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  sub: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  label: { color: '#e5e7eb', fontWeight: '700', marginBottom: 8 },
  inputMultiline: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 8 },
  submit: {
    marginTop: 24,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
