import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { venueInitial } from '../../lib/geo';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

const AVATAR_COLORS = ['#2E6DED', '#E68A00', '#EC4899', '#16A34A', '#8B5CF6'];

type Props = {
  colors: AppColors;
  username: string;
  subtitle?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
};

export default function FriendAvatarRow({
  colors,
  username,
  subtitle,
  onPress,
  trailing,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const initial = venueInitial(username);
  const bg = AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];

  const content = (
    <>
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {username}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: {
      color: colors.textInverse,
      fontSize: 18,
      fontWeight: '800',
    },
    body: { flex: 1, minWidth: 0 },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 2,
    },
    pressed: { opacity: 0.92 },
  });
}
