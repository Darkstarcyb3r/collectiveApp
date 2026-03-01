// Custom Expo config plugin to enable CocoaPods modular headers globally.
// Required for @react-native-firebase — Firebase's Swift pods (FirebaseCoreInternal)
// depend on GoogleUtilities which doesn't define modules by default.
// Without this, EAS builds fail at "Install pods" with:
//   "The Swift pod FirebaseCoreInternal depends upon GoogleUtilities,
//    which does not define modules."

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let podfileContents = fs.readFileSync(podfilePath, 'utf-8');

      // Only add if not already present
      if (!podfileContents.includes('use_modular_headers!')) {
        // Insert use_modular_headers! after the platform line
        podfileContents = podfileContents.replace(
          /(platform :ios.*\n)/,
          `$1use_modular_headers!\n`
        );

        fs.writeFileSync(podfilePath, podfileContents, 'utf-8');
      }

      return config;
    },
  ]);
}

module.exports = withModularHeaders;
