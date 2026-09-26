const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# cafe-social: raise pod deployment targets';
const MIN_TARGET = '15.1';

/**
 * Forces every pod target to a minimum iOS deployment target.
 *
 * Xcode 27 refuses any target below 15.0, but a dozen pods still ship older
 * values (GoogleSignIn 12.0, RevenueCat 13.0, PromisesObjC 9.0, RNSVG 12.4,
 * lottie-ios 13.0, react-native-maps 11.0 ...), so a local build fails with:
 *
 *   error: The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is
 *   set to 12.0, but the range of supported deployment target versions is
 *   15.0 to 27.0.x
 *
 * `platform :ios` in the Podfile only sets the default — each pod overrides it,
 * so the values have to be rewritten after resolution. Not currently hit on EAS
 * because their builders run an older Xcode; it will bite when they upgrade.
 */
module.exports = function withPodDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (contents.includes(MARKER)) return cfg;

      const anchor = '  post_install do |installer|\n';
      if (!contents.includes(anchor)) {
        throw new Error('withPodDeploymentTarget: post_install anchor not found in Podfile');
      }
      contents = contents.replace(
        anchor,
        anchor +
          `    ${MARKER}\n` +
          `    installer.pods_project.targets.each do |t|\n` +
          `      t.build_configurations.each do |bc|\n` +
          `        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
          `        if current.nil? || current.to_f < ${MIN_TARGET}\n` +
          `          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'\n` +
          `        end\n` +
          `      end\n` +
          `    end\n\n`,
      );
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
