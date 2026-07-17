import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/type';
import { useStaffVenuesQuery } from '../../query';
import { useAppTheme } from '../../theme/ThemeContext';

/**
 * Redirects non-staff users away from staff-only screens.
 * When `venueId` is provided, membership at that exact venue is required
 * (routed venue tools); otherwise any staff membership is enough
 * (global screens like StaffVenues).
 * Returns whether the screen should render its body.
 */
export function useRequireStaffMembership(options?: {
  venueId?: string | null;
}): {
  ready: boolean;
  allowed: boolean;
} {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const staffQuery = useStaffVenuesQuery();
  const requiredVenueId = options?.venueId?.trim() || null;
  const memberships = staffQuery.data ?? [];
  const hasAccess = requiredVenueId
    ? memberships.some((row) => row.venue.id === requiredVenueId)
    : memberships.length > 0;
  const ready = !staffQuery.isLoading || Boolean(staffQuery.data);

  useEffect(() => {
    if (!ready) return;
    if (hasAccess) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  }, [ready, hasAccess, navigation]);

  return { ready, allowed: ready && hasAccess };
}

export function StaffAccessGate({
  children,
  venueId,
}: {
  children: React.ReactNode;
  /** Require staff membership at this exact venue before rendering. */
  venueId?: string | null;
}) {
  const { colors } = useAppTheme();
  const { ready, allowed } = useRequireStaffMembership({ venueId });

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
