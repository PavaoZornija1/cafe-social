import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from './type';
import { resolvePostAuthTarget } from './resolvePostAuthTarget';

type ReplaceScreen = NativeStackNavigationProp<RootStackParamList, 'Login'>['replace'];

export async function replaceAfterAuth(
  navigation: { replace: ReplaceScreen },
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const target = await resolvePostAuthTarget(getToken);
  navigation.replace(target);
}
