import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useCameraPermissions } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScan'>;

export default function QrScanScreen({ navigation, route }: Props) {
  const { getToken, isLoaded } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [qrVenueId, setQrVenueId] = useState<string>(route.params?.venueId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  // Prevent onBarCodeScanned from firing repeatedly.
  const hasScannedRef = React.useRef(false);

  useEffect(() => {
    if (route.params?.venueId) setQrVenueId(route.params.venueId);
  }, [route.params?.venueId]);

  useEffect(() => {
    // If we were passed a venueId, consider it "scanned" so the camera can be optional.
    if (route.params?.venueId) {
      hasScannedRef.current = true;
      setScanned(true);
    }
  }, [route.params?.venueId]);

  const handleRegister = async () => {
    setError(null);

    if (!qrVenueId.trim()) {
      setError('QR code is empty. Paste a valid venue code.');
      return;
    }

    if (!isLoaded) return;

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      await apiPost(`/venue-context/${encodeURIComponent(qrVenueId)}/register`, undefined, token);
      navigation.replace('Home');
    } catch (e) {
      setError((e as Error).message || 'Failed to unlock venue');
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = (result: { data?: string }) => {
    if (hasScannedRef.current) return;
    const data = result?.data;
    if (!data) return;

    hasScannedRef.current = true;
    setScanned(true);
    setQrVenueId(String(data));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Unlock Venue</Text>
        <Text style={styles.subtitle}>
          Scan the café QR to unlock this venue for your account (MVP QR contains the `venueId`).
        </Text>

        <View style={styles.scannerWrap}>
          {!permission ? (
            <View style={styles.scanner}>
              <ActivityIndicator color="#a78bfa" />
              <Text style={styles.scannerText}>Requesting camera…</Text>
            </View>
          ) : permission.granted ? (
            <BarCodeScanner
              style={styles.scanner}
              onBarCodeScanned={handleBarCodeScanned as any}
              barCodeTypes={['qr']}
            />
          ) : (
            <View style={styles.scanner}>
              <Text style={styles.scannerText}>Camera permission is required.</Text>
              <Pressable
                onPress={async () => {
                  hasScannedRef.current = false;
                  setScanned(false);
                  await requestPermission();
                }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Enable camera</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.label}>Venue code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 0a1b2c3d-.... (venueId)"
          placeholderTextColor="#6b7280"
          value={qrVenueId}
          onChangeText={setQrVenueId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {scanned && (
          <Pressable
            style={styles.link}
            onPress={() => {
              hasScannedRef.current = false;
              setScanned(false);
              setQrVenueId('');
              setError(null);
            }}
          >
            <Text style={styles.linkText}>Scan another QR</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading || !isLoaded}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Unlock</Text>}
        </Pressable>

        <Pressable
          style={styles.link}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9ca3af', fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: '#d1d5db', fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  scannerWrap: {
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
  },
  scanner: {
    width: '100%',
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerText: { color: '#9ca3af', fontWeight: '700', fontSize: 13, marginTop: 8, paddingHorizontal: 16, textAlign: 'center' },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  error: { color: '#f87171', fontSize: 13, marginTop: 10 },
  button: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { color: '#a5b4fc', fontWeight: '600', fontSize: 14 },
});

