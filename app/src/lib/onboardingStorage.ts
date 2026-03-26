import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_PLAYER_KEY = '@cafe-social/onboarding_player_v1';
export const ONBOARDING_STAFF_KEY = '@cafe-social/onboarding_staff_v1';

export async function isPlayerOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_PLAYER_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function isStaffOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_STAFF_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markPlayerOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_PLAYER_KEY, '1');
}

export async function markStaffOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STAFF_KEY, '1');
}

/** Staff intro skips the player carousel; mark both so we never show the wrong flow later. */
export async function markStaffIntroComplete(): Promise<void> {
  await AsyncStorage.multiSet([
    [ONBOARDING_STAFF_KEY, '1'],
    [ONBOARDING_PLAYER_KEY, '1'],
  ]);
}
