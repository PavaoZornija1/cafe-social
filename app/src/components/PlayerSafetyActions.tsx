import { useAuth } from '@clerk/expo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiPost } from '../lib/api';
import { useAppTheme } from '../theme/ThemeContext';

export default function PlayerSafetyActions({
  playerId,
  username,
  venueId,
  venueName,
  onBlocked,
}: {
  playerId: string;
  username: string;
  venueId?: string;
  venueName?: string;
  onBlocked: () => void;
}) {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);
  const block = () =>
    Alert.alert(t('friends.blockTitle'), t('friends.blockConfirm', { username }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('friends.block'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const token = await getToken();
            if (!token) throw new Error(t('reportPlayer.signInRequired'));
            await apiPost(`/players/me/blocks/${encodeURIComponent(playerId)}`, {}, token);
            onBlocked();
          } catch (e) {
            Alert.alert(t('common.error'), (e as Error).message || t('friends.blockFailed'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={{ paddingVertical: 10 }}
        onPress={() =>
          navigation.navigate('ReportPlayer', {
            venueId,
            venueName,
            reportedPlayerId: playerId,
            reportedUsername: username,
          })
        }
      >
        <Text style={{ color: colors.textSecondary }}>{t('leaderboard.report')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        style={{ paddingVertical: 10 }}
        onPress={block}
      >
        <Text style={{ color: colors.error }}>{busy ? '…' : t('friends.block')}</Text>
      </Pressable>
    </View>
  );
}
