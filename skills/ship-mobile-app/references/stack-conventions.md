# Stack conventions (Expo / EAS)

Opinionated: Expo + EAS Build, a Nest API, Postgres. The environment-handling
lessons apply to any RN setup.

## One variable drives identity

`[verified]` Drive bundle id, app name and capability flags from a single
`APP_ENV`, set per EAS profile. Scattering these across profiles produces builds
that are subtly wrong in ways you discover during review.

```js
const appEnv = (process.env.APP_ENV || 'development').trim().toLowerCase();

const bundleIdentifier =
  appEnv === 'production' ? 'com.example.app'
  : appEnv === 'preview' || appEnv === 'staging' ? 'com.example.app.dev'
  : 'com.yourname.app.devclient';
```

`.trim().toLowerCase()` matters: EAS passes env values as strings and a stray
space silently selects the wrong branch.

Keep the bundle id **identical** between the app config and the payment
provider's app record. A mismatch produces a configuration error with no useful
message.

## EXPO_PUBLIC_ is inlined at build time

`[verified]` `EXPO_PUBLIC_*` values are baked into the JS bundle when it is
built, not read at runtime. So:

- Changing one in the EAS dashboard does nothing to an existing build
- They are **public**. Never put a secret behind this prefix. Publishable keys
  (`pk_live_`, `appl_`, Play's public key) are fine by design
- An OTA update rebuilds the bundle and therefore *does* pick up changes

EAS rejects empty-string env values. If a profile needs a variable to be
effectively absent, set a single space and make the reader treat blank as unset:

```ts
const key = process.env.EXPO_PUBLIC_SOME_KEY?.trim() || '';
```

## Key precedence — write it once, read it carefully

`[verified]` A shared-key-then-platform-key fallback is a trap worth auditing:

```ts
function nativeApiKey(): string {
  if (sharedKey) return sharedKey;                        // wins over everything
  if (Platform.OS === 'ios') return iosKey || iosTestKey;
  if (Platform.OS === 'android') return androidKey || androidTestKey;
}
```

If a generic `*_API_KEY` is ever set to a **test** key, it silently overrides
the correct production platform key, and the only symptom is a configuration
error on a real device. When debugging, print which key the build resolved —
do not assume.

## Build profiles worth having

```json
{
  "production":        { "autoIncrement": true },
  "production-apk":    { "extends": "production", "autoIncrement": false,
                         "distribution": "internal",
                         "android": { "buildType": "apk" } },
  "screenshots":       { "extends": "production", "autoIncrement": false,
                         "distribution": "internal" }
}
```

- **`production-apk`** — an installable APK for a device that is not yet
  enrolled in Play. Invaluable before Play verification completes. `[verified]`
- **`screenshots`** — a production-identical build with monetization keys blanked
  so a paywall cannot crash a capture run. `[verified]`

## SafeAreaView: the cross-platform bug

`[verified]` `SafeAreaView` imported from `react-native` is **iOS-only**. On
Android it renders as a plain `View` and does nothing, so every screen header
sits under the status bar. The app looks fine on iOS throughout development and
visibly broken the first time it runs on Android.

```ts
import { SafeAreaView } from 'react-native';                   // iOS-only
import { SafeAreaView } from 'react-native-safe-area-context';  // correct
```

Fix it with a repo-wide sweep before the first Android build — it was 39 files
here. Keep the default `edges`, so iOS behaviour is unchanged and the diff is
genuinely a no-op on the platform already in review. Add a lint rule banning the
`react-native` import so it cannot come back.

## OTA updates

`[verified]` `expo-updates` must be installed for `channel` and
`runtimeVersion` config to do anything. Configuring them without the package
fails quietly.

## Auto-provisioning is a deletion hazard

`[verified]` See `auth.md`. If read endpoints call a `findOrCreate` helper, any
"delete the row" operation races against them. Audit every call site before
claiming deletion works.

## Checklist

- [ ] `APP_ENV` drives bundle id and capability flags, with `.trim()`
- [ ] Bundle id matches the payment provider's app record exactly
- [ ] No secret behind `EXPO_PUBLIC_`
- [ ] No generic shared key overriding platform keys
- [ ] `SafeAreaView` imported from `react-native-safe-area-context` everywhere,
      with a lint rule
- [ ] `expo-updates` installed if channels are configured
- [ ] An APK profile exists for pre-Play device testing
