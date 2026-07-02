import type { EdgeInsets } from 'react-native-safe-area-context';

export type ArenaSafeInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** Normalized safe-area padding for landscape arena (notch / home indicator). */
export function resolveArenaSafeInsets(insets: EdgeInsets): ArenaSafeInsets {
  const top =
    typeof insets.top === 'number' && Number.isFinite(insets.top)
      ? Math.max(0, insets.top)
      : 0;
  const bottom =
    typeof insets.bottom === 'number' && Number.isFinite(insets.bottom)
      ? Math.max(0, insets.bottom)
      : 0;
  const left =
    typeof insets.left === 'number' && Number.isFinite(insets.left)
      ? Math.max(0, insets.left)
      : 0;
  const right =
    typeof insets.right === 'number' && Number.isFinite(insets.right)
      ? Math.max(0, insets.right)
      : 0;

  return {
    top: Math.max(top, 8),
    bottom: Math.max(bottom, 10),
    left: Math.max(left, 8),
    right: Math.max(right, 8),
  };
}
