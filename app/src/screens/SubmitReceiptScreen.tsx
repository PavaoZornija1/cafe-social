import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmitReceipt'>;

export default function SubmitReceiptScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { venueId } = route.params;
  const { getToken, isLoaded } = useAuth();
  const [note, setNote] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.error'), t('receiptSubmit.libraryDenied'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setPreviewUri(res.assets[0].uri);
    }
  };

  const submit = async () => {
    if (!previewUri) {
      Alert.alert(t('common.error'), t('receiptSubmit.needPhoto'));
      return;
    }
    if (!isLoaded) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('staff.signInFirst'));
      const { venue, coords } = await fetchDetectedVenue();
      if (!coords || venue?.id !== venueId) {
        Alert.alert(t('common.error'), t('receiptSubmit.needLocationAtVenue'));
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(previewUri, {
        encoding: 'base64',
      });
      const mime = previewUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const imageData = `data:${mime};base64,${base64}`;
      await apiPost(
        `/venue-context/${encodeURIComponent(venueId)}/receipts`,
        {
          imageData,
          mimeType: mime,
          notePlayer: note.trim() || undefined,
          latitude: coords.lat,
          longitude: coords.lng,
        },
        token,
      );
      Alert.alert(t('receiptSubmit.sentTitle'), t('receiptSubmit.sentBody'));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('receiptSubmit.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('receiptSubmit.title')}</Text>
      </View>
      <Text style={styles.hint}>{t('receiptSubmit.hint')}</Text>

      <Pressable style={styles.pickBtn} onPress={() => void pickImage()} disabled={busy}>
        <Text style={styles.pickBtnText}>{t('receiptSubmit.pickPhoto')}</Text>
      </Pressable>

      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
      ) : null}

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('receiptSubmit.notePlaceholder')}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />

      <Pressable
        style={[styles.submitBtn, busy && styles.submitDisabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitText}>{t('receiptSubmit.submit')}</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  hint: { color: colors.textMuted, fontSize: 13, marginHorizontal: 24, marginTop: 12, lineHeight: 18 },
  pickBtn: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: '#1f2937',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickBtnText: { color: colors.honey, fontWeight: '800' },
  preview: {
    marginHorizontal: 24,
    marginTop: 16,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  input: {
    marginHorizontal: 24,
    marginTop: 16,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
  },
  submitBtn: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: '#6d28d9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: colors.textInverse, fontWeight: '800' },

    });
}
