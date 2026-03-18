import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen(_props: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.placeholder}>Coming soon: XP, tier, rewards, history.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  placeholder: { color: '#9ca3af', marginTop: 10, fontSize: 14, lineHeight: 20 },
});

