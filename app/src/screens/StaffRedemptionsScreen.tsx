import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import {
  addUtcDaysYmd,
  fetchStaffModerationSummary,
  fetchStaffRedemptions,
  utcTodayYmd,
  type StaffModerationSummary,
  type StaffRedemptionRow,
  type StaffRedemptionsResponse,
} from '../lib/ownerStaffApi';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffRedemptions'>;

export default function StaffRedemptionsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { venueId, venueName, highlightCode: routeHighlight } = route.params;
  const { getToken, isLoaded } = useAuth();
  const [dateYmd, setDateYmd] = useState(() => utcTodayYmd());
  const [payload, setPayload] = useState<StaffRedemptionsResponse | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modSummary, setModSummary] = useState<StaffModerationSummary | null>(null);

  const highlight = useMemo(() => {
    const h = routeHighlight?.trim().toUpperCase().replace(/\s/g, '');
    return h && /^[0-9A-F]{8}$/.test(h) ? h : null;
  }, [routeHighlight]);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('staff.signInFirst'));
      const [data, summary] = await Promise.all([
        fetchStaffRedemptions(token, venueId, dateYmd),
        fetchStaffModerationSummary(token, venueId).catch(() => null),
      ]);
      setPayload(data);
      setModSummary(summary);
    } catch (e) {
      setPayload(null);
      setModSummary(null);
      Alert.alert(t('common.error'), (e as Error).message ?? t('staff.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, venueId, dateYmd, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered: StaffRedemptionRow[] = useMemo(() => {
    const list = payload?.redemptions ?? [];
    const q = filter.trim().toUpperCase().replace(/\s/g, '');
    if (!q) return list;
    return list.filter(
      (r) =>
        r.staffVerificationCode.includes(q) ||
        r.perkCode.toUpperCase().includes(q) ||
        r.perkTitle.toUpperCase().includes(q),
    );
  }, [payload, filter]);

  const highlightMissing = Boolean(
    highlight &&
      payload?.redemptions?.length &&
      !payload.redemptions.some((r) => r.staffVerificationCode === highlight),
  );

  const title = venueName ?? payload?.venueName ?? venueId;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {modSummary ? (
        <View style={styles.modPanel}>
          <Text style={styles.modPanelTitle}>{t('staff.moderationSnapshot')}</Text>
          <Text style={styles.modPanelLine}>
            {t('staff.modOpenReports', { n: modSummary.openReportsCount })} ·{' '}
            {t('staff.modActiveBans', { n: modSummary.activeBansCount })} ·{' '}
            {t('staff.modOpenAppeals', { n: modSummary.openAppealsCount })}
          </Text>
          {modSummary.recentOpenReports.length > 0 ? (
            <View style={styles.modReportList}>
              {modSummary.recentOpenReports.map((r) => (
                <Text key={r.id} style={styles.modReportItem} numberOfLines={2}>
                  @{r.reportedUsername}: {r.reasonPreview}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.modPanelHint}>{t('staff.modPartnerToolsHint')}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          style={styles.dayBtn}
          onPress={() => setDateYmd((d) => addUtcDaysYmd(d, -1))}
        >
          <Text style={styles.dayBtnText}>‹</Text>
        </Pressable>
        <View style={styles.dayCenter}>
          <Text style={styles.dayLabel}>{t('staff.dateUtc')}</Text>
          <Text style={styles.dayValue}>{dateYmd}</Text>
        </View>
        <Pressable
          style={styles.dayBtn}
          onPress={() => setDateYmd((d) => addUtcDaysYmd(d, 1))}
        >
          <Text style={styles.dayBtnText}>›</Text>
        </Pressable>
        <Pressable style={styles.todayBtn} onPress={() => setDateYmd(utcTodayYmd())}>
          <Text style={styles.todayBtnText}>{t('staff.today')}</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder={t('staff.filterPlaceholder')}
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
          style={styles.input}
        />
        <Pressable
          style={styles.scanBtn}
          onPress={() =>
            navigation.navigate('StaffQrScan', { venueId, venueName: title })
          }
        >
          <Text style={styles.scanBtnText}>{t('staff.scanQr')}</Text>
        </Pressable>
      </View>

      {highlightMissing ? (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>{t('staff.highlightMissing')}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.redemptionId}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('staff.emptyDay')}</Text>
          }
          renderItem={({ item }) => {
            const isHit =
              highlight && item.staffVerificationCode === highlight;
            const voided = !!item.voidedAt;
            return (
              <View
                style={[
                  styles.rowCard,
                  isHit && styles.rowCardHighlight,
                  voided && styles.rowCardVoided,
                ]}
              >
                <Text style={styles.code}>{item.staffVerificationCode}</Text>
                <Text style={styles.perkTitle}>{item.perkTitle}</Text>
                <Text style={styles.perkMeta}>
                  {item.perkCode} · {new Date(item.redeemedAt).toISOString()}
                  {voided ? ` · VOID` : ""}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#111827' },
  backText: { color: '#cbd5e1', fontWeight: '600' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 16,
    gap: 8,
  },
  dayBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  dayBtnText: { color: '#e5e7eb', fontSize: 22, fontWeight: '700' },
  dayCenter: { flex: 1, alignItems: 'center' },
  dayLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700' },
  dayValue: { color: '#f3f4f6', fontSize: 16, fontWeight: '800', marginTop: 2 },
  todayBtn: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#4c1d95',
  },
  todayBtnText: { color: '#e9d5ff', fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 24, marginTop: 14 },
  input: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 14,
  },
  scanBtn: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  scanBtnText: { color: '#c4b5fd', fontWeight: '800', fontSize: 12 },
  list: { padding: 24, paddingTop: 12, paddingBottom: 40, gap: 10 },
  rowCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    padding: 14,
  },
  rowCardHighlight: {
    borderColor: '#a78bfa',
    backgroundColor: '#0b1220',
  },
  rowCardVoided: {
    opacity: 0.55,
    borderColor: '#450a0a',
  },
  code: { color: '#fcd34d', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
  perkTitle: { color: '#f9fafb', fontWeight: '700', marginTop: 8 },
  perkMeta: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
  warnBanner: {
    marginHorizontal: 24,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#78350f',
  },
  warnText: { color: '#fde68a', fontSize: 13, lineHeight: 18 },
  modPanel: {
    marginHorizontal: 24,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modPanelTitle: { color: '#e2e8f0', fontWeight: '800', fontSize: 13 },
  modPanelLine: { color: '#94a3b8', fontSize: 12, marginTop: 8, lineHeight: 18 },
  modReportList: { marginTop: 10, gap: 6 },
  modReportItem: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  modPanelHint: { color: '#64748b', fontSize: 11, marginTop: 10, lineHeight: 15 },
});
