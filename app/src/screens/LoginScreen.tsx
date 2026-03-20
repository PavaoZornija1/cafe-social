import { useAuth, useSignIn } from '@clerk/expo';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
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
import { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const { isLoaded, isSignedIn } = useAuth();
    const { signIn, errors, fetchStatus } = useSignIn();

    const [emailAddress, setEmailAddress] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [needsMfa, setNeedsMfa] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Redirect to Home when already signed in
    useEffect(() => {
        if (isLoaded && isSignedIn) {
            navigation.replace('Home');
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
            navigation.replace('Home');
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
            navigation.replace('Home');
        }
    };

    const isLoading = !isLoaded || fetchStatus === 'fetching';
    const isPasswordFormValid = emailAddress.trim().length > 0 && password.length > 0;
    const isMfaFormValid = verificationCode.trim().length > 0;

    if (!isLoaded) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#7c3aed" />
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
                            placeholderTextColor="#6b7280"
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
                                <ActivityIndicator color="#fff" />
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

                    <SocialSignInButtons onSuccess={() => navigation.replace('Home')} />

                    <Text style={styles.label}>{t('login.email')}</Text>
                    <TextInput
                        style={styles.input}
                        placeholder={t('login.emailPlaceholder')}
                        placeholderTextColor="#6b7280"
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
                        placeholderTextColor="#6b7280"
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
                            <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050816',
    },
    centered: {
        flex: 1,
        backgroundColor: '#050816',
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
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    title: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    label: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        color: '#ffffff',
        fontSize: 16,
        marginBottom: 14,
    },
    error: {
        color: '#f87171',
        fontSize: 13,
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#7c3aed',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    linkText: {
        color: '#a5b4fc',
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    footerText: {
        color: '#9ca3af',
        fontSize: 14,
    },
    footerLink: {
        color: '#a78bfa',
        fontSize: 14,
        fontWeight: '600',
    },
});
