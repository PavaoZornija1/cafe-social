import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'MyVenueReports'>;

type FiledReportRow = {
  id: string;
  venueId: string;
  status: string;
  reason: string;
  createdAt: string;
  dismissedAt: string | null;
  dismissalNoteToReporter: string | null;
  venue: { name: string };
};

export default function MyVenueReportsScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FiledReportRow[]>([]);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setRows([]);
        return;
      }
      const list = await apiGet<FiledReportRow[]>('/players/me/venue-reports', token);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      Alert.alert(t('common.error'), t('myReports.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const statusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return t('myReports.statusOpen');
    if (s === 'dismissed') return t('myReports.statusDismissed');
    return status;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('myReports.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sub}>{t('myReports.subtitle')}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => void load()} disabled={loading}>
          <Text style={styles.secondaryBtnText}>
            {loading ? '…' : t('myReports.refresh')}
          </Text>
        </Pressable>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>{t('myReports.empty')}</Text>
        ) : (
          rows.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.venueName}>{r.venue.name}</Text>
              <Text style={styles.statusLine}>
                <Text style={styles.statusBadge}>{statusLabel(r.status)}</Text>
                {' · '}
                <Text style={styles.dateMuted}>
                  {t('myReports.filedAt', {
                    when: new Date(r.createdAt).toLocaleString(),
                  })}
                </Text>
              </Text>
              <Text style={styles.reasonLabel}>{t('myReports.reasonLabel')}</Text>
              <Text style={styles.reasonBody}>{r.reason}</Text>
              {r.status.toLowerCase() === 'dismissed' && r.dismissalNoteToReporter ? (
                <Text style={styles.staffNote}>
                  <Text style={styles.staffNoteLabel}>{t('myReports.staffNote')}: </Text>
                  {r.dismissalNoteToReporter}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  sub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  centerRow: { marginVertical: 24, alignItems: 'center' },
  muted: { color: colors.textMuted, marginTop: 16, fontSize: 14 },
  card: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  venueName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  statusLine: { marginTop: 8, fontSize: 13 },
  statusBadge: { color: colors.honey, fontWeight: '700' },
  dateMuted: { color: colors.textMuted },
  reasonLabel: { color: colors.textMuted, fontSize: 12, marginTop: 12, fontWeight: '700' },
  reasonBody: { color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 },
  staffNote: { color: colors.honeyDark, fontSize: 13, marginTop: 12, lineHeight: 18 },
  staffNoteLabel: { fontWeight: '800', color: colors.honeyDark },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: 8,
  },
  secondaryBtnText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },

    });
}
