// Custom Expo config plugin to enable modular headers for specific Firebase pods.
// Firebase's Swift pods (FirebaseCoreInternal) depend on GoogleUtilities
// which doesn't define modules by default.
//
// IMPORTANT: We no longer use global use_modular_headers! because it breaks
// gRPC-C++ (Firestore dependency) which can't generate its module map
// under global modular headers.

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Only these pods need modular headers for Firebase to build
const PODS_NEEDING_MODULAR_HEADERS = [
  'FirebaseCore',
  'FirebaseCoreInternal',
  'GoogleUtilities',
  'FirebaseInstallations',
  'GoogleDataTransport',
  'nanopb',
  'FirebaseAuth',
  'FirebaseFirestore',
  'FirebaseAppCheck',
  'GTMSessionFetcher',
  'RecaptchaInterop',
];

function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let podfileContents = fs.readFileSync(podfilePath, 'utf-8');

      // Remove any existing global use_modular_headers! (from previous builds)
      podfileContents = podfileContents.replace(/\nuse_modular_headers!\n/, '\n');

      // Add targeted modular headers in the post_install block
      const modularHeadersBlock = PODS_NEEDING_MODULAR_HEADERS
        .map(pod => `    pod '${pod}', :modular_headers => true`)
        .join('\n');

      // Insert after the platform line
      if (!podfileContents.includes("modular_headers => true")) {
        podfileContents = podfileContents.replace(
          /(platform :ios.*\n)/,
          `$1\n# Firebase pods that need modular headers (targeted, not global)\n${modularHeadersBlock}\n`
        );
      }

      fs.writeFileSync(podfilePath, podfileContents, 'utf-8');

      return config;
    },
  ]);
}

module.exports = withModularHeaders;
