// Custom Expo config plugin to fix Firebase + gRPC CocoaPods build conflict.
//
// Two problems at once:
// 1. Firebase Swift pods need modular headers on their ObjC dependencies
//    (GoogleUtilities, FirebaseAuthInterop, etc.) — without them, pod install fails.
// 2. gRPC pods can't generate module maps under use_frameworks! :linkage => :static —
//    with global use_modular_headers!, the Xcode build fails.
//
// Fix: Targeted modular headers for Firebase deps only + force gRPC as static library.

const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Pods that Firebase Swift code depends on that don't define modules by default.
// These need :modular_headers => true to generate module maps.
const PODS_NEEDING_MODULAR_HEADERS = [
  'GoogleUtilities',
  'FirebaseAuthInterop',
  'FirebaseAppCheckInterop',
  'FirebaseCoreInternal',
  'FirebaseCoreExtension',
  'FirebaseFirestoreInternal',
  'FirebaseMessagingInterop',
  'FirebaseSharedSwift',
  'RecaptchaInterop',
  'GTMSessionFetcher',
  'nanopb',
  'leveldb-library',
  'abseil',
  'PromisesObjC',
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

      // Remove any leftover global use_modular_headers!
      podfileContents = podfileContents.replace(/^use_modular_headers!\n/gm, '');

      // 1. Add pre_install hook to force gRPC pods to build as static libraries.
      const preInstallBlock = `
# Force gRPC pods to build as static libraries — they cannot generate
# module maps when use_frameworks! :linkage => :static is active.
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.start_with?('gRPC')
      def pod.build_type
        Pod::BuildType.static_library
      end
    end
  end
end

`;

      if (!podfileContents.includes('pre_install do |installer|')) {
        podfileContents = podfileContents.replace(
          /(target ['"]Collective['"] do)/,
          `${preInstallBlock}$1`
        );
      }

      // 2. Add targeted modular headers for Firebase dependencies inside target block.
      const modularHeaderLines = PODS_NEEDING_MODULAR_HEADERS
        .map(pod => `  pod '${pod}', :modular_headers => true`)
        .join('\n');

      const modularHeadersBlock = `
  # Firebase Swift pods need these ObjC deps to define modules
${modularHeaderLines}

`;

      if (!podfileContents.includes(':modular_headers => true')) {
        podfileContents = podfileContents.replace(
          /(use_expo_modules!\n)/,
          `$1${modularHeadersBlock}`
        );
      }

      // 3. Add gRPC build settings fix inside the existing post_install block
      const postInstallFix = `

    # Fix gRPC build settings
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('gRPC')
        target.build_configurations.each do |bc|
          bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          bc.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end
    end`;

      if (!podfileContents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfileContents = podfileContents.replace(
          /(react_native_post_install\([^)]+\))/s,
          `$1${postInstallFix}`
        );
      }

      fs.writeFileSync(podfilePath, podfileContents, 'utf-8');

      return config;
    },
  ]);
}

module.exports = withModularHeaders;
