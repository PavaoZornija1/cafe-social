import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleHere'>;

type Person = {
  id: string;
  username: string;
  relationship: 'friend' | 'stranger';
  profileLevel: 'stub' | 'public';
};

export default function PeopleHereScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { venueId, venueName } = route.params;
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setPeople([]);
        setMyPlayerId(null);
        return;
      }
      const [summary, list] = await Promise.all([
        apiGet<MeSummaryDto>('/players/me/summary', token),
        apiGet<Person[]>(
          `/social/venues/${encodeURIComponent(venueId)}/people-here`,
          token,
        ),
      ]);
      setMyPlayerId(summary.playerId ?? null);
      setPeople(list);
    } catch {
      setPeople([]);
      setMyPlayerId(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, venueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('peopleHere.title')}</Text>
      </View>
      <Text style={styles.sub}>
        {venueName ? `${venueName} · ` : ''}
        {t('peopleHere.subtitle')}
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('peopleHere.empty')}</Text>
          }
          renderItem={({ item }) => {
            const isSelf = myPlayerId != null && item.id === myPlayerId;
            return (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.name}>{item.username}</Text>
                  <Text style={styles.tag}>
                    {item.relationship === 'friend'
                      ? t('peopleHere.friend')
                      : t('peopleHere.stranger')}
                  </Text>
                </View>
                {!isSelf ? (
                  <Pressable
                    style={({ pressed }) => [styles.reportBtn, pressed && styles.reportBtnPressed]}
                    onPress={() =>
                      navigation.navigate('ReportPlayer', {
                        venueId,
                        venueName,
                        reportedPlayerId: item.id,
                        reportedUsername: item.username,
                      })
                    }
                  >
                    <Text style={styles.reportBtnText}>{t('peopleHere.report')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      )}
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
  },
  back: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  backText: { color: colors.textSecondary, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  sub: { color: colors.textMuted, paddingHorizontal: 24, marginTop: 8, marginBottom: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMain: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontWeight: '700' },
  tag: { color: colors.honey, fontSize: 12, fontWeight: '800', marginTop: 4 },
  reportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  reportBtnPressed: { opacity: 0.88 },
  reportBtnText: { color: '#fdba74', fontSize: 12, fontWeight: '800' },

    });
}
