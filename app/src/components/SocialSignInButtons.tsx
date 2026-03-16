/**
 * Social sign-in (Google / Apple). Native implementation is lazy-loaded so
 * expo-crypto and native modules are not in the initial Metro bundle, avoiding
 * "Requiring unknown module" errors. If the native chunk fails to load (e.g. Expo Go),
 * we render nothing and only email/password is shown.
 */
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { SocialSignInButtonsNativeProps } from './SocialSignInButtonsNative';

type Props = SocialSignInButtonsNativeProps;

export function SocialSignInButtons({ onSuccess, showDivider = true }: Props) {
    const [NativeButtons, setNativeButtons] =
        useState<React.ComponentType<SocialSignInButtonsNativeProps> | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
        import('./SocialSignInButtonsNative')
            .then((m) => setNativeButtons(() => m.SocialSignInButtonsNative))
            .catch(() => setLoadFailed(true));
    }, []);

    if (loadFailed || !NativeButtons) return null;

    return <NativeButtons onSuccess={onSuccess} showDivider={showDivider} />;
}
