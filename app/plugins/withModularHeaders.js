const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# cafe-social: modular headers';

/**
 * Declares modular headers for the two pods that block a static-library build.
 *
 * GoogleSignIn pulls in AppCheckCore, a Swift pod that depends on GoogleUtilities
 * and RecaptchaInterop. Neither defines a module, so CocoaPods refuses:
 *
 *   The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
 *   `RecaptchaInterop`, which do not define modules.
 *
 * This never surfaced while ios/ was committed, because the checked-in
 * Podfile.lock pinned AppCheckCore 11.2.0 and EAS built in bare mode. Managed
 * builds resolve pods fresh every time, so the constraint now applies.
 *
 * Scoped to the two named pods rather than a global use_modular_headers!, which
 * would change header visibility for every pod in the tree.
 */
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes(MARKER)) return cfg;

      const anchor = "  use_expo_modules!\n";
      if (!contents.includes(anchor)) {
        throw new Error('withModularHeaders: could not find use_expo_modules! anchor in Podfile');
      }
      contents = contents.replace(
        anchor,
        anchor +
          `\n  ${MARKER} — AppCheckCore (via GoogleSignIn) needs these to define modules\n` +
          "  pod 'GoogleUtilities', :modular_headers => true\n" +
          "  pod 'RecaptchaInterop', :modular_headers => true\n",
      );
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
