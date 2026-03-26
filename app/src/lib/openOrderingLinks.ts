import { Linking } from 'react-native';

/** Prefer ordering URL, then menu. Returns true if a URL was opened. */
export async function openOrderingOrMenu(
  orderingUrl?: string | null,
  menuUrl?: string | null,
): Promise<boolean> {
  const o = orderingUrl?.trim() ?? '';
  const m = menuUrl?.trim() ?? '';
  const url = o || m;
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
