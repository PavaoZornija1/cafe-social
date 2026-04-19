import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { LANGUAGE_OPTIONS, type AppLanguage, setAppLanguage } from '../i18n';
import { apiGet, apiPatch } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { registerExpoPushTokenWithBackend } from '../lib/expoPush';
import { fetchOwnerVenues } from '../lib/ownerStaffApi';
import {
  isPlayerOnboardingDone,
  isStaffOnboardingDone,
  markPlayerOnboardingDone,
  markStaffIntroComplete,
  syncOnboardingFromServerSummary,
} from '../lib/onboardingStorage';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const PLAYER_PAGE_COUNT = 5;

export default function OnboardingScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [phase, setPhase] = useState<'loading' | 'staff' | 'player'>('loading');
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isLoaded) return;
      const token = await getTokenRef.current();
      if (!token) {
        navigation.replace('Login');
        return;
      }
      let isStaff = false;
      try {
        const [summary, owner] = await Promise.all([
          apiGet<MeSummaryDto>('/players/me/summary', token),
          fetchOwnerVenues(token),
        ]);
        await syncOnboardingFromServerSummary(summary);
        isStaff = owner.venues.length > 0;
      } catch {
        try {
          const { venues } = await fetchOwnerVenues(token);
          isStaff = venues.length > 0;
        } catch {
          isStaff = false;
        }
      }

      const [staffDone, playerDone] = await Promise.all([
        isStaffOnboardingDone(),
        isPlayerOnboardingDone(),
      ]);

      if (cancelled) return;

      if (isStaff && !staffDone) {
        setPhase('staff');
        return;
      }
      if (!isStaff && !playerDone) {
        setPhase('player');
        return;
      }
      navigation.replace('Home');
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, navigation]);

  const registerPush = useCallback(() => {
    void registerExpoPushTokenWithBackend(() => getTokenRef.current());
  }, []);

  const pushOnboardingServer = useCallback(
    async (body: { playerComplete?: boolean; staffComplete?: boolean }) => {
      const t = await getTokenRef.current();
      if (!t) return;
      try {
        await apiPatch('/players/me/onboarding', body, t);
      } catch {
        /* offline / non-fatal */
      }
    },
    [],
  );

  const finishPlayer = useCallback(async () => {
    await markPlayerOnboardingDone();
    await pushOnboardingServer({ playerComplete: true });
    registerPush();
    navigation.replace('Home');
  }, [navigation, pushOnboardingServer, registerPush]);

  const skipPlayer = useCallback(async () => {
    await markPlayerOnboardingDone();
    await pushOnboardingServer({ playerComplete: true });
    registerPush();
    navigation.replace('Home');
  }, [navigation, pushOnboardingServer, registerPush]);

  const finishStaff = useCallback(async () => {
    await markStaffIntroComplete();
    await pushOnboardingServer({ staffComplete: true });
    registerPush();
    navigation.replace('Home');
  }, [navigation, pushOnboardingServer, registerPush]);

  const goPlayerPage = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(PLAYER_PAGE_COUNT - 1, next));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      setPage(clamped);
    },
    [width],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / width);
      setPage(Math.max(0, Math.min(PLAYER_PAGE_COUNT - 1, idx)));
    },
    [width],
  );

  const requestLocationThenFinish = useCallback(async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      /* user denied or error — still leave onboarding */
    }
    await finishPlayer();
  }, [finishPlayer]);

  const handleLanguage = useCallback(async (code: AppLanguage) => {
    try {
      await setAppLanguage(code);
    } catch {
      /* ignore */
    }
  }, []);

  if (phase === 'loading' || !isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (phase === 'staff') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.staffContent}>
          <Text style={styles.staffBadge}>Staff</Text>
          <Text style={styles.staffTitle}>{t('onboarding.staffTitle')}</Text>
          <Text style={styles.staffBody}>{t('onboarding.staffBody')}</Text>
          <Text style={styles.staffHint}>{t('onboarding.staffHint')}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => void finishStaff()}
          >
            <Text style={styles.primaryBtnText}>{t('onboarding.getStarted')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        {page >= 1 ? (
          <Pressable onPress={() => void skipPlayer()} hitSlop={12}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {/* 0 — Welcome */}
        <View style={[styles.page, { width }]}>
          <Text style={styles.slideTitle}>{t('onboarding.welcomeTitle')}</Text>
          <Text style={styles.slideBody}>{t('onboarding.welcomeBody')}</Text>
        </View>

        {/* 1 — Venue-first */}
        <View style={[styles.page, { width }]}>
          <Text style={styles.slideTitle}>{t('onboarding.venueTitle')}</Text>
          <Text style={styles.slideBody}>{t('onboarding.venueBody')}</Text>
        </View>

        {/* 2 — Unlock */}
        <View style={[styles.page, { width }]}>
          <Text style={styles.slideTitle}>{t('onboarding.unlockTitle')}</Text>
          <Text style={styles.slideBody}>{t('onboarding.unlockBody')}</Text>
        </View>

        {/* 3 — Language */}
        <View style={[styles.page, { width }]}>
          <Text style={styles.slideTitle}>{t('onboarding.languageTitle')}</Text>
          <Text style={styles.slideSub}>{t('onboarding.languageSubtitle')}</Text>
          <View style={styles.langList}>
            {LANGUAGE_OPTIONS.map(({ code, nativeName }) => {
              const active = i18n.language === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => void handleLanguage(code)}
                  style={({ pressed }) => [
                    styles.langRow,
                    active && styles.langRowActive,
                    pressed && styles.langRowPressed,
                  ]}
                >
                  <Text style={styles.langName}>{nativeName}</Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 4 — Location permission */}
        <View style={[styles.page, { width }]}>
          <Text style={styles.slideTitle}>{t('onboarding.locationTitle')}</Text>
          <Text style={styles.slideBody}>{t('onboarding.locationBody')}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => void requestLocationThenFinish()}
          >
            <Text style={styles.primaryBtnText}>{t('onboarding.enableLocation')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}
            onPress={() => void finishPlayer()}
          >
            <Text style={styles.secondaryBtnText}>{t('onboarding.notNow')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: PLAYER_PAGE_COUNT }, (_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        {page < PLAYER_PAGE_COUNT - 1 ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            onPress={() => goPlayerPage(page + 1)}
          >
            <Text style={styles.primaryBtnText}>{t('onboarding.next')}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 40,
  },
  skipText: { color: colors.honey, fontSize: 16, fontWeight: '600' },
  skipPlaceholder: { width: 48 },
  pager: { flex: 1 },
  page: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  slideTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 14,
    lineHeight: 32,
  },
  slideBody: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  slideSub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  langList: { gap: 10, marginTop: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langRowActive: { borderColor: colors.honey, backgroundColor: colors.surface },
  langRowPressed: { opacity: 0.92 },
  langName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  check: { color: colors.honey, fontSize: 18, fontWeight: '800' },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 8,
    gap: 16,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnText: { color: colors.textInverse, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnPressed: { opacity: 0.85 },
  secondaryBtnText: { color: colors.honey, fontSize: 15, fontWeight: '600' },
  staffContent: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  staffBadge: {
    alignSelf: 'flex-start',
    color: colors.honey,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  staffTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    lineHeight: 34,
  },
  staffBody: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  staffHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },

    });
}
