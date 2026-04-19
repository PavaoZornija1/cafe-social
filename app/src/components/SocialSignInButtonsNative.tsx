/**
 * Social sign-in: Google via OAuth (strategy oauth_google), Apple via native.
 * Google uses useSSO so Clerk accepts the strategy; native useSignInWithGoogle sends google_one_tap which some instances reject.
 */
import { useSignInWithApple } from '@clerk/expo/apple';
import { useSSO } from '@clerk/expo';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';

export type SocialSignInButtonsNativeProps = {
    onSuccess?: () => void;
    showDivider?: boolean;
};

type ThemedStyles = ReturnType<typeof createStyles>;

export function SocialSignInButtonsNative({
    onSuccess,
    showDivider = true,
}: SocialSignInButtonsNativeProps) {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { t } = useTranslation();
    const ENABLE_APPLE_SIGN_IN = false;
    const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

    return (
        <View style={styles.container}>
            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                <GoogleSignInButton
                    styles={styles}
                    onSuccess={onSuccess}
                    loading={loading === 'google'}
                    onLoadingChange={(v) => setLoading(v ? 'google' : null)}
                />
            )}
            {Platform.OS === 'ios' && ENABLE_APPLE_SIGN_IN && (
                <AppleSignInButton
                    styles={styles}
                    onSuccess={onSuccess}
                    loading={loading === 'apple'}
                    onLoadingChange={(v) => setLoading(v ? 'apple' : null)}
                />
            )}
            {showDivider && (Platform.OS === 'ios' || Platform.OS === 'android') && (
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{t('social.or')}</Text>
                    <View style={styles.dividerLine} />
                </View>
            )}
        </View>
    );
}

function GoogleSignInButton({
    styles,
    onSuccess,
    loading,
    onLoadingChange,
}: {
    styles: ThemedStyles;
    onSuccess?: () => void;
    loading: boolean;
    onLoadingChange: (loading: boolean) => void;
}) {
    const { t } = useTranslation();
    const { startSSOFlow } = useSSO();

    const handlePress = async () => {
        try {
            onLoadingChange(true);
            const { createdSessionId, setActive } = await startSSOFlow({
                strategy: 'oauth_google',
            });
            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });
                onSuccess?.();
            }
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === 'SIGN_IN_CANCELLED' || code === '-5') return;
            Alert.alert(
                t('common.error'),
                (err as { message?: string })?.message || t('social.googleSignInFailed'),
            );
        } finally {
            onLoadingChange(false);
        }
    };

    return (
        <Pressable
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handlePress}
            disabled={loading}
        >
            <Text style={styles.googleButtonText}>
                {loading ? t('social.signingIn') : t('social.continueWithGoogle')}
            </Text>
        </Pressable>
    );
}

function AppleSignInButton({
    styles,
    onSuccess,
    loading,
    onLoadingChange,
}: {
    styles: ThemedStyles;
    onSuccess?: () => void;
    loading: boolean;
    onLoadingChange: (loading: boolean) => void;
}) {
    const { startAppleAuthenticationFlow } = useSignInWithApple();

    const handlePress = async () => {
        try {
            onLoadingChange(true);
            const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });
                onSuccess?.();
            }
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === 'ERR_REQUEST_CANCELED') return;
            Alert.alert(
                'Error',
                (err as { message?: string })?.message || 'Apple sign-in failed',
            );
        } finally {
            onLoadingChange(false);
        }
    };

    return (
        <Pressable
            style={[styles.appleButton, loading && styles.buttonDisabled]}
            onPress={handlePress}
            disabled={loading}
        >
            <Text style={styles.appleButtonText}>
                {loading ? 'Signing in…' : 'Continue with Apple'}
            </Text>
        </Pressable>
    );
}

function createStyles(colors: AppColors) {
    return StyleSheet.create({
        container: {
            width: '100%',
            gap: 12,
        },
        googleButton: {
            backgroundColor: '#4285F4',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
        },
        appleButton: {
            backgroundColor: '#000',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
        },
        googleButtonText: {
            color: colors.textInverse,
            fontSize: 16,
            fontWeight: '600',
        },
        appleButtonText: {
            color: colors.textInverse,
            fontSize: 16,
            fontWeight: '600',
        },
        buttonDisabled: {
            opacity: 0.7,
        },
        divider: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 8,
        },
        dividerLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.borderStrong,
        },
        dividerText: {
            marginHorizontal: 12,
            color: colors.textMuted,
            fontSize: 13,
        },
    });
}
