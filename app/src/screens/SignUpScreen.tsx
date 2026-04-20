import { useAuth, useSignUp } from '@clerk/expo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SocialSignInButtons } from '../components/SocialSignInButtons';
import { replaceAfterAuth } from '../navigation/afterAuth';
import { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const { signUp, errors, fetchStatus } = useSignUp();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [needsVerification, setNeedsVerification] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            void replaceAfterAuth(navigation, () => getTokenRef.current());
        }
    }, [isLoaded, isSignedIn, navigation]);

    const handleSignUp = async () => {
        if (isSignedIn) {
            await replaceAfterAuth(navigation, () => getTokenRef.current());
            return;
        }
        if (!signUp) return;

        setSubmitError(null);
        const { error } = await signUp.password({ emailAddress, password });
        if (error) {
            setSubmitError(error.message || t('signUp.signUpFailed'));
            return;
        }

        try {
            const sendResult = await signUp.verifications.sendEmailCode();
            if (sendResult?.error) {
                setSubmitError(sendResult.error.message || 'Could not send verification code.');
                return;
            }
        } catch (err) {
            setSubmitError((err as Error)?.message || 'Could not send verification code. Please try again.');
            return;
        }
        setNeedsVerification(true);
    };

    const handleVerify = async () => {
        if (!signUp) return;

        setSubmitError(null);
        const { error } = await signUp.verifications.verifyEmailCode({ code });
        if (error) {
            setSubmitError(error.message || t('signUp.verifyFailed'));
            return;
        }

        if (signUp.status === 'complete') {
            await signUp.finalize();
            await replaceAfterAuth(navigation, () => getTokenRef.current());
        }
    };

    const isLoading = !isLoaded || fetchStatus === 'fetching';
    const isSignUpFormValid = emailAddress.trim().length > 0 && password.length >= 8;
    const isVerifyFormValid = code.trim().length > 0;

    if (!isLoaded) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isSignedIn) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (needsVerification) {
        return (
            <KeyboardAvoidingView
                style={styles.screen}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.card}>
                        <Text style={styles.title}>{t('signUp.verifyTitle')}</Text>
                        <Text style={styles.subtitle}>
                            {t('signUp.verifySubtitle', { email: emailAddress })}
                        </Text>
                        <Text style={styles.label}>{t('signUp.verificationCode')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t('signUp.codePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={code}
                            onChangeText={setCode}
                            keyboardType="number-pad"
                            autoComplete="one-time-code"
                        />
                        {submitError && (
                            <Text style={styles.error}>{submitError}</Text>
                        )}
                        <Pressable
                            style={[
                                styles.button,
                                (!isVerifyFormValid || isLoading) && styles.buttonDisabled,
                            ]}
                            onPress={handleVerify}
                            disabled={!isVerifyFormValid || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.textInverse} />
                            ) : (
                                <Text style={styles.buttonText}>{t('signUp.verify')}</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={styles.linkButton}
                            onPress={() => signUp?.verifications.sendEmailCode()}
                        >
                            <Text style={styles.linkText}>{t('signUp.resendCode')}</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.linkButton, { marginTop: 8 }]}
                            onPress={() => {
                                setNeedsVerification(false);
                                setCode('');
                            }}
                        >
                            <Text style={styles.linkText}>{t('signUp.back')}</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>
                    <Text style={styles.title}>{t('signUp.title')}</Text>
                    <Text style={styles.subtitle}>{t('signUp.subtitle')}</Text>

                    <SocialSignInButtons
                        onSuccess={() => void replaceAfterAuth(navigation, () => getTokenRef.current())}
                    />

                    <Text style={styles.label}>{t('signUp.email')}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={t('login.emailPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={emailAddress}
                        onChangeText={setEmailAddress}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                    />

                    <Text style={styles.label}>{t('signUp.password')}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="new-password"
                    />

                    {submitError && (
                        <Text style={styles.error}>{submitError}</Text>
                    )}

                    <Pressable
                        style={[
                            styles.button,
                            (!isSignUpFormValid || isLoading) && styles.buttonDisabled,
                        ]}
                        onPress={handleSignUp}
                        disabled={!isSignUpFormValid || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={styles.buttonText}>{t('signUp.signUp')}</Text>
                        )}
                    </Pressable>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>{t('signUp.haveAccount')} </Text>
                        <Pressable onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.footerLink}>{t('signUp.signInLink')}</Text>
                        </Pressable>
                    </View>
                    {/* Required for Clerk bot sign-up protection */}
                    <View nativeID="clerk-captcha" style={styles.captcha} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    centered: {
        flex: 1,
        backgroundColor: colors.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        color: colors.text,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    label: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        color: colors.text,
        fontSize: 16,
        marginBottom: 14,
    },
    error: {
        color: colors.error,
        fontSize: 13,
        marginBottom: 12,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    linkText: {
        color: colors.honeyDark,
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    footerText: {
        color: colors.textMuted,
        fontSize: 14,
    },
    footerLink: {
        color: colors.link,
        fontSize: 14,
        fontWeight: '600',
    },
    captcha: {
        minHeight: 1,
        marginTop: 16,
    },

    });
}
