import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState("");

    const isFormValid = username.trim().length > 0 && password.length > 0;

    const handleLogin = () => {
        const trimmedUsername = username.trim().toLowerCase();

        if (trimmedUsername === 'admin' && password === '123') {
            setError("");
            navigation.replace('Home', { username: trimmedUsername });
            return;
        }

        setError("Invalid username or password");
    }

    return (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.card}>
                <Text style={styles.title}>Cafe Social</Text>
                <Text style={styles.subtitle}>Location-locked social gaming for cafés.</Text>
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                    />
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
                <Text style={styles.helper}>Demo login: admin / 123</Text>
                {error && <Text style={styles.error}>{error}</Text>}
                <Pressable style={styles.button} onPress={handleLogin} disabled={!isFormValid} android_ripple={{ color: '#6b21a8' }}>
                    <Text style={styles.buttonText}>Login</Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050816',
        justifyContent: 'center',
        paddingHorizontal: 24,
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
    },
    form: {
        marginTop: 24,
        gap: 14,
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
    helper: {
        color: '#a5b4fc',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 14,
    },
    error: {
        color: '#f87171',
        fontSize: 13,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#7c3aed',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonPressed: {
        opacity: 0.85,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});