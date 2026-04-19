import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
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
import { apiGet, apiPost } from '../lib/api';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BanAppeal'>;

const MESSAGE_MIN = 8;

type MyAppealRow = {
    id: string;
    venueId: string;
    message: string;
    status: string;
    createdAt: string;
    resolvedAt: string | null;
    staffMessageToPlayer: string | null;
    venue: { name: string };
};

export default function BanAppealScreen({ navigation, route }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { venueId, venueName, focusAppealId } = route.params;
    const { t } = useTranslation();
    const { getToken } = useAuth();
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loadingAppeals, setLoadingAppeals] = useState(true);
    const [appeals, setAppeals] = useState<MyAppealRow[]>([]);

    const loadAppeals = useCallback(async () => {
        setLoadingAppeals(true);
        try {
            const token = await getToken();
            if (!token) {
                setAppeals([]);
                return;
            }
            const list = await apiGet<MyAppealRow[]>('/players/me/ban-appeals', token);
            setAppeals(Array.isArray(list) ? list : []);
        } catch {
            setAppeals([]);
        } finally {
            setLoadingAppeals(false);
        }
    }, [getToken]);

    useFocusEffect(
        useCallback(() => {
            void loadAppeals();
        }, [loadAppeals]),
    );

    const appealForVenue = useMemo(() => {
        const forVenue = appeals.filter((a) => a.venueId === venueId);
        if (focusAppealId) {
            const hit = forVenue.find((a) => a.id === focusAppealId);
            if (hit) return hit;
        }
        return forVenue[0] ?? null;
    }, [appeals, venueId, focusAppealId]);

    const len = message.trim().length;
    const canSubmit = len >= MESSAGE_MIN && !submitting && !appealForVenue;

    const outcomeTitleKey = (status: string): string => {
        if (status === 'lifted') return 'banAppeal.outcomeTitleLifted';
        if (status === 'upheld') return 'banAppeal.outcomeTitleUpheld';
        if (status === 'dismissed') return 'banAppeal.outcomeTitleDismissed';
        return 'banAppeal.outcomeTitleOther';
    };

    const outcomeBodyKey = (status: string): string => {
        if (status === 'lifted') return 'banAppeal.outcomeBodyLifted';
        if (status === 'upheld') return 'banAppeal.outcomeBodyUpheld';
        if (status === 'dismissed') return 'banAppeal.outcomeBodyDismissed';
        return 'banAppeal.outcomeBodyOther';
    };

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
            await loadAppeals();
        } catch (e) {
            Alert.alert(t('common.error'), (e as Error).message ?? t('banAppeal.failed'));
        } finally {
            setSubmitting(false);
        }
    };

    const showResolved =
        appealForVenue && appealForVenue.status !== 'open';
    const showPending = appealForVenue && appealForVenue.status === 'open';

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

                    {loadingAppeals ? (
                        <View style={styles.centerRow}>
                            <ActivityIndicator color="#a78bfa" />
                        </View>
                    ) : null}

                    {showResolved ? (
                        <View style={styles.outcomeCard}>
                            <Text style={styles.outcomeTitle}>
                                {t(outcomeTitleKey(appealForVenue.status), {
                                    venue: appealForVenue.venue.name,
                                })}
                            </Text>
                            <Text style={styles.outcomeBody}>
                                {t(outcomeBodyKey(appealForVenue.status), {
                                    venue: appealForVenue.venue.name,
                                })}
                            </Text>
                            {appealForVenue.staffMessageToPlayer ? (
                                <Text style={styles.staffMsg}>
                                    <Text style={styles.staffMsgLabel}>
                                        {t('banAppeal.staffMessageLabel')}
                                    </Text>
                                    {appealForVenue.staffMessageToPlayer}
                                </Text>
                            ) : null}
                            {appealForVenue.resolvedAt ? (
                                <Text style={styles.resolvedAt}>
                                    {t('banAppeal.resolvedAt', {
                                        date: new Date(appealForVenue.resolvedAt).toLocaleString(),
                                    })}
                                </Text>
                            ) : null}
                            <Pressable
                                style={styles.secondaryBtn}
                                onPress={() => void loadAppeals()}
                            >
                                <Text style={styles.secondaryBtnText}>{t('banAppeal.refresh')}</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {showPending ? (
                        <View style={styles.pendingCard}>
                            <Text style={styles.pendingTitle}>{t('banAppeal.pendingTitle')}</Text>
                            <Text style={styles.pendingBody}>{t('banAppeal.pendingBody')}</Text>
                            <Text style={styles.pendingQuote}>&ldquo;{appealForVenue.message}&rdquo;</Text>
                            <Pressable
                                style={styles.secondaryBtn}
                                onPress={() => void loadAppeals()}
                            >
                                <Text style={styles.secondaryBtnText}>{t('banAppeal.refresh')}</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {!loadingAppeals && !showResolved && !showPending ? (
                        <>
                            <Text style={styles.label}>{t('banAppeal.messageLabel')}</Text>
                            <TextInput
                                style={styles.inputMultiline}
                                placeholder={t('banAppeal.messagePlaceholder')}
                                placeholderTextColor={colors.textMuted}
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
                                    <ActivityIndicator color={colors.textInverse} />
                                ) : (
                                    <Text style={styles.submitText}>{t('banAppeal.submit')}</Text>
                                )}
                            </Pressable>
                        </>
                    ) : null}
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
    sub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
    centerRow: { marginVertical: 16, alignItems: 'center' },
    outcomeCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.honeyMuted,
        padding: 16,
        marginBottom: 20,
    },
    outcomeTitle: { color: colors.honeyDark, fontSize: 17, fontWeight: '800', marginBottom: 8 },
    outcomeBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    staffMsg: { color: colors.honeyDark, fontSize: 14, marginTop: 14, lineHeight: 20 },
    staffMsgLabel: { fontWeight: '800', color: colors.honeyDark },
    resolvedAt: { color: colors.textMuted, fontSize: 12, marginTop: 12 },
    pendingCard: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#422006',
        padding: 16,
        marginBottom: 20,
    },
    pendingTitle: { color: colors.honeyDark, fontSize: 16, fontWeight: '800', marginBottom: 8 },
    pendingBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    pendingQuote: { color: colors.textSecondary, fontSize: 13, marginTop: 10, fontStyle: 'italic' },
    secondaryBtn: {
        alignSelf: 'flex-start',
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.borderStrong,
    },
    secondaryBtnText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
    label: { color: colors.textSecondary, fontWeight: '700', marginBottom: 8 },
    inputMultiline: {
        minHeight: 140,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 14,
        color: colors.text,
        fontSize: 16,
    },
    hint: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
    submit: {
        marginTop: 24,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: colors.textInverse, fontWeight: '800', fontSize: 16 },

    });
}
