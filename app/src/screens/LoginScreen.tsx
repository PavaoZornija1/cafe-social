import { useAuth, useSignIn } from '@clerk/expo';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const { signIn, errors, fetchStatus } = useSignIn();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [needsMfa, setNeedsMfa] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // After auth, onboarding may run once before Home
    useEffect(() => {
        if (isLoaded && isSignedIn) {
            void replaceAfterAuth(navigation, () => getTokenRef.current());
        }
    }, [isLoaded, isSignedIn, navigation]);

    const handleSignIn = async () => {
        if (!signIn) return;

        setSubmitError(null);
        setNeedsMfa(false);
        const { error } = await signIn.password({ identifier: emailAddress, password });

        if (error) {
            setSubmitError(error.message || t('login.signInFailed'));
            return;
        }

        if (signIn.status === 'complete') {
            await signIn.finalize();
            await replaceAfterAuth(navigation, () => getTokenRef.current());
            return;
        }

        if (signIn.status === 'needs_second_factor') {
            const emailCodeFactor = signIn.supportedSecondFactors?.find(
                (f) => f.strategy === 'email_code'
            );
            if (emailCodeFactor) {
                await signIn.mfa.sendEmailCode();
                setNeedsMfa(true);
            }
        } else if (signIn.status === 'needs_client_trust') {
            const emailCodeFactor = signIn.supportedSecondFactors?.find(
                (f) => f.strategy === 'email_code'
            );
            if (emailCodeFactor) {
                await signIn.mfa.sendEmailCode();
                setNeedsMfa(true);
            }
        }
    };

    const handleVerifyMfa = async () => {
        if (!signIn) return;

        setSubmitError(null);
        const { error } = await signIn.mfa.verifyEmailCode({ code: verificationCode });
        if (error) {
            setSubmitError(error.message || t('login.verifyFailed'));
            return;
        }

        if (signIn.status === 'complete') {
            await signIn.finalize();
            await replaceAfterAuth(navigation, () => getTokenRef.current());
        }
    };

    const isLoading = !isLoaded || fetchStatus === 'fetching';
    const isPasswordFormValid = emailAddress.trim().length > 0 && password.length > 0;
    const isMfaFormValid = verificationCode.trim().length > 0;

    if (!isLoaded) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (needsMfa) {
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
                        <Text style={styles.title}>{t('login.verifyTitle')}</Text>
                        <Text style={styles.subtitle}>{t('login.verifySubtitle')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t('login.verificationCode')}
                            placeholderTextColor={colors.textMuted}
                            value={verificationCode}
                            onChangeText={setVerificationCode}
                            keyboardType="number-pad"
                            autoComplete="one-time-code"
                        />
                        {submitError && (
                            <Text style={styles.error}>{submitError}</Text>
                        )}
                        <Pressable
                            style={[
                                styles.button,
                                (!isMfaFormValid || isLoading) && styles.buttonDisabled,
                            ]}
                            onPress={handleVerifyMfa}
                            disabled={!isMfaFormValid || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.textInverse} />
                            ) : (
                                <Text style={styles.buttonText}>{t('login.verify')}</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={styles.linkButton}
                            onPress={() => {
                                setNeedsMfa(false);
                                setVerificationCode('');
                                setSubmitError(null);
                            }}
                        >
                            <Text style={styles.linkText}>{t('login.backToSignIn')}</Text>
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
                    <Text style={styles.title}>{t('login.title')}</Text>
                    <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

                    <SocialSignInButtons
                        onSuccess={() => void replaceAfterAuth(navigation, () => getTokenRef.current())}
                    />

                    <Text style={styles.label}>{t('login.email')}</Text>
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

                    <Text style={styles.label}>{t('login.password')}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textMuted}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                    />

                    {submitError && (
                        <Text style={styles.error}>{submitError}</Text>
                    )}

                    <Pressable
                        style={[
                            styles.button,
                            (!isPasswordFormValid || isLoading) && styles.buttonDisabled,
                        ]}
                        onPress={handleSignIn}
                        disabled={!isPasswordFormValid || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.textInverse} />
                        ) : (
                            <Text style={styles.buttonText}>{t('login.signIn')}</Text>
                        )}
                    </Pressable>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>{t('login.noAccount')} </Text>
                        <Pressable onPress={() => navigation.navigate('SignUp')}>
                            <Text style={styles.footerLink}>{t('login.signUpLink')}</Text>
                        </Pressable>
                    </View>
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

    });
}
