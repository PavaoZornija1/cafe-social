import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

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
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<FiledReportRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (!isLoaded) return;

    const hasRows = rowsRef.current.length > 0;
    if (mode === 'initial' && !hasRows) {
      setInitializing(true);
    } else if (mode === 'refresh') {
      setRefreshing(true);
    }

    try {
      const token = await getTokenRef.current();
      if (!token) {
        setRows([]);
        return;
      }
      const list = await apiGet<FiledReportRow[]>('/players/me/venue-reports', token);
      setRows(Array.isArray(list) ? list : []);
    } catch {
      Alert.alert(t('common.error'), t('myReports.loadError'));
      if (!hasRows) setRows([]);
    } finally {
      setInitializing(false);
      setRefreshing(false);
    }
  }, [isLoaded, t]);

  useEffect(() => {
    if (!isLoaded) return;
    void load('initial');
  }, [isLoaded, load]);

  const handleRefresh = useCallback(() => {
    void load(rowsRef.current.length > 0 ? 'refresh' : 'initial');
  }, [load]);

  const statusLabel = useCallback(
    (status: string) => {
      const s = status.toLowerCase();
      if (s === 'open') return t('myReports.statusOpen');
      if (s === 'dismissed') return t('myReports.statusDismissed');
      return status;
    },
    [t],
  );

  const showInitialSpinner = initializing && rows.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t('myReports.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('myReports.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('myReports.subtitle')}</Text>

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            <Text style={styles.muted}>{t('myReports.empty')}</Text>
          </View>
        ) : (
          rows.map((r) => {
            const isOpen = r.status.toLowerCase() === 'open';
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.venueName}>{r.venue.name}</Text>
                  <View style={[styles.statusPill, isOpen ? styles.statusOpen : styles.statusClosed]}>
                    <Text style={[styles.statusText, isOpen ? styles.statusOpenText : styles.statusClosedText]}>
                      {statusLabel(r.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dateMuted}>
                  {t('myReports.filedAt', {
                    when: new Date(r.createdAt).toLocaleString(),
                  })}
                </Text>
                <Text style={styles.reasonLabel}>{t('myReports.reasonLabel')}</Text>
                <Text style={styles.reasonBody}>{r.reason}</Text>
                {r.status.toLowerCase() === 'dismissed' && r.dismissalNoteToReporter ? (
                  <View style={styles.staffNoteBox}>
                    <Text style={styles.staffNoteLabel}>{t('myReports.staffNote')}</Text>
                    <Text style={styles.staffNoteBody}>{r.dismissalNoteToReporter}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    centerBlock: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xxl,
    },
    muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    venueName: {
      flex: 1,
      color: colors.text,
      fontWeight: '800',
      fontSize: 17,
    },
    statusPill: {
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    statusOpen: { backgroundColor: colors.warningBg },
    statusClosed: { backgroundColor: colors.primaryMuted },
    statusText: { fontSize: 11, fontWeight: '800' },
    statusOpenText: { color: colors.warning },
    statusClosedText: { color: colors.primary },
    dateMuted: { color: colors.textMuted, fontSize: 13 },
    reasonLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: spacing.xs,
    },
    reasonBody: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    staffNoteBox: {
      marginTop: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    staffNoteLabel: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 12,
    },
    staffNoteBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    pressed: { opacity: 0.88 },
  });
}
