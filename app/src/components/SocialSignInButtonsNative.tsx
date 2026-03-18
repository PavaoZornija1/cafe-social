/**
 * Social sign-in: Google via OAuth (strategy oauth_google), Apple via native.
 * Google uses useSSO so Clerk accepts the strategy; native useSignInWithGoogle sends google_one_tap which some instances reject.
 */
import { useSignInWithApple } from '@clerk/expo/apple';
import { useSSO } from '@clerk/expo';
import React, { useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export type SocialSignInButtonsNativeProps = {
    onSuccess?: () => void;
    showDivider?: boolean;
};

export function SocialSignInButtonsNative({
    onSuccess,
    showDivider = true,
}: SocialSignInButtonsNativeProps) {
    // Personal iOS dev teams cannot provision the "Sign in with Apple" capability.
    // Until we have a proper Apple developer team + signing, we hide the Apple button.
    const ENABLE_APPLE_SIGN_IN = false;
    const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

    return (
        <View style={styles.container}>
            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                <GoogleSignInButton
                    onSuccess={onSuccess}
                    loading={loading === 'google'}
                    onLoadingChange={(v) => setLoading(v ? 'google' : null)}
                />
            )}
            {Platform.OS === 'ios' && ENABLE_APPLE_SIGN_IN && (
                <AppleSignInButton
                    onSuccess={onSuccess}
                    loading={loading === 'apple'}
                    onLoadingChange={(v) => setLoading(v ? 'apple' : null)}
                />
            )}
            {showDivider && (Platform.OS === 'ios' || Platform.OS === 'android') && (
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>
            )}
        </View>
    );
}

function GoogleSignInButton({
    onSuccess,
    loading,
    onLoadingChange,
}: {
    onSuccess?: () => void;
    loading: boolean;
    onLoadingChange: (loading: boolean) => void;
}) {
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
                'Error',
                (err as { message?: string })?.message || 'Google sign-in failed'
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
                {loading ? 'Signing in…' : 'Continue with Google'}
            </Text>
        </Pressable>
    );
}

function AppleSignInButton({
    onSuccess,
    loading,
    onLoadingChange,
}: {
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
                (err as { message?: string })?.message || 'Apple sign-in failed'
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

const styles = StyleSheet.create({
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
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    appleButtonText: {
        color: '#fff',
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
        backgroundColor: '#374151',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#9ca3af',
        fontSize: 13,
    },
});
