import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { fetchOwnerVenues, type OwnerVenueRow } from '../lib/ownerStaffApi';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'StaffVenues'>;

export default function StaffVenuesScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { getToken, isLoaded } = useAuth();
  const [rows, setRows] = useState<OwnerVenueRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t('staff.signInFirst'));
      const data = await fetchOwnerVenues(token);
      setRows(data.venues);
    } catch (e) {
      setRows([]);
      Alert.alert(t('common.error'), (e as Error).message ?? t('staff.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [getToken, isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('staff.venuesTitle')}</Text>
      </View>
      <Text style={styles.hint}>{t('staff.venuesHint')}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" size="large" />
        </View>
      ) : rows?.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('staff.noVenues')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows ?? []}
          keyExtractor={(item) => item.venue.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate('StaffRedemptions', {
                  venueId: item.venue.id,
                  venueName: item.venue.name,
                })
              }
            >
              <Text style={styles.venueName}>{item.venue.name}</Text>
              <Text style={styles.meta}>
                {[item.venue.address, item.venue.city, item.venue.country]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Text>
              <Text style={styles.role}>{item.role}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 16 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surface },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  hint: { color: colors.textMuted, fontSize: 12, marginHorizontal: 24, marginTop: 10, lineHeight: 18 },
  list: { padding: 24, paddingTop: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardPressed: { opacity: 0.92 },
  venueName: { color: colors.text, fontWeight: '800', fontSize: 17 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  role: {
    marginTop: 10,
    alignSelf: 'flex-start',
    color: colors.honey,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 24 },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },

    });
}
