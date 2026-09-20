const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * Removes the Sign in with Apple entitlement.
 *
 * @clerk/expo's `withClerkAppleSignIn` adds `com.apple.developer.applesignin`
 * unconditionally and exposes no option to opt out. A free/personal Apple team
 * cannot provision that capability, so local device builds fail to sign with it
 * present. This runs after the Clerk plugin and strips the key again for the
 * profiles where Sign in with Apple is not enabled (see appleSignInEnabled in
 * app.config.js).
 */
module.exports = function withAppleSignInGate(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults['com.apple.developer.applesignin'];
    return modConfig;
  });
};
