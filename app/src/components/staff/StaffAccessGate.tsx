import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/type';
import { useStaffVenuesQuery } from '../../query';
import { useAppTheme } from '../../theme/ThemeContext';

/**
 * Redirects non-staff users away from staff-only screens.
 * Returns whether the screen should render its body.
 */
export function useRequireStaffMembership(): {
  ready: boolean;
  allowed: boolean;
} {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const staffQuery = useStaffVenuesQuery();
  const hasStaff = (staffQuery.data?.length ?? 0) > 0;
  const ready = !staffQuery.isLoading || Boolean(staffQuery.data);

  useEffect(() => {
    if (!ready) return;
    if (hasStaff) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  }, [ready, hasStaff, navigation]);

  return { ready, allowed: ready && hasStaff };
}

export function StaffAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const { ready, allowed } = useRequireStaffMembership();

  if (!ready || !allowed) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
