import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyWord'>;

type DailyHints = {
    answerLength: number;
    sentenceHint?: string;
    wordHints?: string[];
    emojiHints?: string[];
};

type DailyState = {
    dayKey: string;
    scope: 'global' | 'venue';
    venueId?: string;
    language: string;
    solved: boolean;
    attempts: number;
    maxAttempts: number;
    answerLength: number;
    streak: number;
    lastSolvedDayKey: string | null;
    word?: string;
    hints?: DailyHints;
};

export default function DailyWordScreen({ navigation }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t, i18n } = useTranslation();
    const { getToken } = useAuth();
    const [scope, setScope] = useState<'global' | 'venue'>('global');
    const [subscriptionActive, setSubscriptionActive] = useState(false);
    const [venueGps, setVenueGps] = useState<{ venueId: string; lat: number; lng: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState<DailyState | null>(null);
    const [guess, setGuess] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { venue, coords } = await fetchDetectedVenue();
            const gps =
                venue && coords && venue.id
                    ? { venueId: venue.id, lat: coords.lat, lng: coords.lng }
                    : null;
            setVenueGps(gps);
            if (scope === 'venue' && !gps) {
                setState(null);
                setError(t('dailyWord.needVenue'));
                return;
            }
            const token = await getToken();
            if (!token) throw new Error(t('dailyWord.notSignedIn'));

            const summary = await apiGet<{ subscriptionActive?: boolean }>('/players/me/summary', token);
            const subActive = summary.subscriptionActive ?? false;
            setSubscriptionActive(subActive);

            let effectiveScope = scope;
            if (scope === 'global' && !subActive) {
                if (gps) {
                    effectiveScope = 'venue';
                    setScope('venue');
                } else {
                    setState(null);
                    setError(t('dailyWord.globalRequiresSub'));
                    return;
                }
            }

            const qs = new URLSearchParams();
            qs.set('scope', effectiveScope);
            qs.set('language', toApiWordLanguage(i18n.language));
            if (effectiveScope === 'venue' && gps) {
                qs.set('venueId', gps.venueId);
                qs.set('lat', String(gps.lat));
                qs.set('lng', String(gps.lng));
            }

            const s = await apiGet<DailyState>(`/words/daily?${qs.toString()}`, token);
            setState(s);
            setGuess('');
        } catch (e) {
            setState(null);
            setError((e as Error).message || t('dailyWord.loadError'));
        } finally {
            setLoading(false);
        }
    }, [getToken, scope, t, i18n.language]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const onSubmit = async () => {
        if (!state || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error(t('dailyWord.notSignedIn'));
            const body: Record<string, unknown> = {
                scope,
                language: toApiWordLanguage(i18n.language),
                guess: guess.trim(),
            };
            if (scope === 'venue' && venueGps) {
                body.venueId = venueGps.venueId;
                body.latitude = venueGps.lat;
                body.longitude = venueGps.lng;
            }
            const res = await apiPost<{
                correct: boolean;
                solved: boolean;
                attempts: number;
                maxAttempts: number;
                word?: string;
                streak: number;
                hints?: DailyHints;
            }>('/words/daily/guess', body, token);
            setState((prev) =>
                prev
                    ? {
                          ...prev,
                          solved: res.solved,
                          attempts: res.attempts,
                          word: res.word ?? prev.word,
                          streak: res.streak,
                          hints: res.hints ?? prev.hints,
                          answerLength: res.hints?.answerLength ?? prev.answerLength,
                      }
                    : prev,
            );
            setGuess('');
        } catch (e) {
            setError((e as Error).message || t('dailyWord.guessError'));
        } finally {
            setSubmitting(false);
        }
    };

    const canVenue = !!venueGps;
    const canGlobalDaily = subscriptionActive;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                    <Text style={styles.backText}>{t('common.back')}</Text>
                </Pressable>
                <Text style={styles.title}>{t('dailyWord.title')}</Text>
            </View>

            <View style={styles.scopeRow}>
                <Pressable
                    style={[
                        styles.scopeBtn,
                        scope === 'global' && styles.scopeBtnOn,
                        !canGlobalDaily && styles.scopeDisabled,
                    ]}
                    disabled={!canGlobalDaily}
                    onPress={() => setScope('global')}
                >
                    <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextOn]}>
                        {t('dailyWord.scopeGlobal')}
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.scopeBtn, scope === 'venue' && styles.scopeBtnOn, !canVenue && styles.scopeDisabled]}
                    disabled={!canVenue}
                    onPress={() => setScope('venue')}
                >
                    <Text style={[styles.scopeText, scope === 'venue' && styles.scopeTextOn]}>
                        {t('dailyWord.scopeVenue')}
                    </Text>
                </Pressable>
            </View>

            <Text style={styles.modeBlurb}>{t('dailyWord.wordRoomsHint')}</Text>
            <Text style={styles.hardModeBlurb}>{t('dailyWord.hardModeBlurb')}</Text>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#a78bfa" />
                </View>
            ) : error && !state ? (
                <Text style={styles.error}>{error}</Text>
            ) : state ? (
                <View style={styles.body}>
                    <Text style={styles.meta}>
                        {t('dailyWord.day', { day: state.dayKey })} · {t('dailyWord.streak', { n: state.streak })}
                    </Text>
                    <Text style={styles.hint}>
                        {t('dailyWord.answerLength', { n: state.hints?.answerLength ?? state.answerLength })}
                    </Text>
                    {state.hints?.sentenceHint ? (
                        <Text style={styles.progressiveHint}>
                            <Text style={styles.hintLabel}>{t('dailyWord.hintSentence')}</Text>
                            {state.hints.sentenceHint}
                        </Text>
                    ) : null}
                    {state.hints?.wordHints?.length ? (
                        <Text style={styles.progressiveHint}>
                            <Text style={styles.hintLabel}>{t('dailyWord.hintWords')}</Text>
                            {state.hints.wordHints.join(', ')}
                        </Text>
                    ) : null}
                    {state.hints?.emojiHints?.length ? (
                        <Text style={styles.progressiveHint}>
                            <Text style={styles.hintLabel}>{t('dailyWord.hintEmoji')}</Text>
                            {state.hints.emojiHints.join(' ')}
                        </Text>
                    ) : null}
                    <Text style={styles.attempts}>
                        {t('dailyWord.attempts', { current: state.attempts, max: state.maxAttempts })}
                    </Text>

                    {state.solved ? (
                        <Text style={styles.win}>
                            {t('dailyWord.solved', { word: state.word ?? '—' })}
                        </Text>
                    ) : state.attempts >= state.maxAttempts ? (
                        <Text style={styles.lose}>{t('dailyWord.outOfAttempts')}</Text>
                    ) : (
                        <>
                            <TextInput
                                style={styles.input}
                                value={guess}
                                onChangeText={setGuess}
                                placeholder={t('dailyWord.placeholder')}
                                placeholderTextColor="#64748b"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!submitting}
                            />
                            <Pressable
                                style={[styles.submit, submitting && styles.submitDisabled]}
                                onPress={() => void onSubmit()}
                                disabled={submitting || !guess.trim()}
                            >
                                <Text style={styles.submitText}>
                                    {submitting ? t('common.loading') : t('dailyWord.submit')}
                                </Text>
                            </Pressable>
                        </>
                    )}

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>
            ) : null}
        </SafeAreaView>
    );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surfaceMuted },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
    back: { marginBottom: 8 },
    backText: { color: colors.textSecondary, fontSize: 16 },
    title: { color: colors.text, fontSize: 22, fontWeight: '700' },
    scopeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
    modeBlurb: {
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 17,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    scopeBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: colors.bgElevated,
        alignItems: 'center',
    },
    scopeBtnOn: { backgroundColor: colors.primary },
    scopeDisabled: { opacity: 0.4 },
    scopeText: { color: colors.text, fontWeight: '600' },
    scopeTextOn: { color: colors.textInverse },
    center: { padding: 32, alignItems: 'center' },
    body: { paddingHorizontal: 16, gap: 12 },
    meta: { color: colors.textSecondary, fontSize: 14 },
    hint: { color: colors.textSecondary, fontSize: 16 },
    hardModeBlurb: {
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 17,
        paddingHorizontal: 16,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    progressiveHint: { color: colors.text, fontSize: 14, lineHeight: 20 },
    hintLabel: { color: colors.honey, fontWeight: '700', marginRight: 6 },
    attempts: { color: colors.honey, fontSize: 14 },
    input: {
        backgroundColor: colors.bgElevated,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 18,
    },
    submit: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
    win: { color: '#4ade80', fontSize: 18, fontWeight: '600' },
    lose: { color: colors.error, fontSize: 16 },
    error: { color: colors.error, paddingHorizontal: 16, marginTop: 8 },

    });
}
