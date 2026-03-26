import { navigationRef } from '../navigation/navigationRef';
import { resolvePostAuthTarget } from '../navigation/resolvePostAuthTarget';

/**
 * If the signed-in user still owes onboarding, navigates there and returns false.
 * Use before routing from notification taps / deep links into the main stack.
 */
export async function ensureOnboardingCompleteForNavigation(
  getToken: () => Promise<string | null | undefined>,
): Promise<boolean> {
  if (!navigationRef.isReady()) return true;
  const target = await resolvePostAuthTarget(getToken);
  if (target === 'Onboarding') {
    navigationRef.navigate('Onboarding');
    return false;
  }
  return true;
}
