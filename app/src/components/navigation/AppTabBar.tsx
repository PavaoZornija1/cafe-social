import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useFriendsInboxBadge } from '../../context/FriendsInboxBadgeContext';
import { triggerFeedback } from '../../lib/feedback';
import { shouldTriggerTabSwitchFeedback } from '../../lib/uiFeedbackPolicy';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AppColors } from '../../theme/colors';
import { radii, spacing, tabBar } from '../../theme/tokens';
import type { MainTabParamList } from '../../navigation/type';

type TabName = keyof MainTabParamList;

type TabConfig = {
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconFocused: React.ComponentProps<typeof Ionicons>['name'];
};

const TAB_CONFIG: Record<TabName, TabConfig> = {
  HomeTab: { labelKey: 'tabs.home', icon: 'home-outline', iconFocused: 'home' },
  PlayTab: { labelKey: 'tabs.play', icon: 'game-controller-outline', iconFocused: 'game-controller' },
  VenuesTab: { labelKey: 'tabs.venues', icon: 'location-outline', iconFocused: 'location' },
  FriendsTab: { labelKey: 'tabs.friends', icon: 'people-outline', iconFocused: 'people' },
  MeTab: { labelKey: 'tabs.me', icon: 'person-outline', iconFocused: 'person' },
};

export default function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { pendingCount } = useFriendsInboxBadge();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tabName = route.name as TabName;
          const config = TAB_CONFIG[tabName];
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? t(config.labelKey);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (shouldTriggerTabSwitchFeedback(focused, event.defaultPrevented)) {
              triggerFeedback('uiTap');
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const badge =
            tabName === 'FriendsTab' && pendingCount > 0
              ? pendingCount > 99
                ? '99+'
                : String(pendingCount)
              : null;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={
                badge
                  ? `${options.tabBarAccessibilityLabel ?? label}, ${badge} pending`
                  : (options.tabBarAccessibilityLabel ?? label)
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={focused ? config.iconFocused : config.icon}
                  size={tabBar.iconSize}
                  color={focused ? colors.primary : colors.tabInactive}
                />
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      minHeight: tabBar.height,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: spacing.xs,
      borderRadius: radii.md,
    },
    itemPressed: { opacity: 0.7 },
    iconWrap: {
      width: tabBar.iconSize + 8,
      height: tabBar.iconSize + 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -4,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: colors.textInverse,
      fontSize: 10,
      fontWeight: '800',
    },
    label: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.tabInactive,
    },
    labelFocused: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}
