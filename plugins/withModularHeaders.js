// Custom Expo config plugin to fix Firebase Firestore + gRPC CocoaPods build conflict.
//
// Problem: @react-native-firebase/firestore depends on gRPC-C++ and gRPC-Core.
// expo-build-properties sets use_frameworks! :linkage => :static (required by Firebase).
// gRPC pods cannot generate module maps in framework mode, causing:
//   "module map file gRPC-Core.modulemap not found"
//
// Fix: Force gRPC pods to build as static libraries (not frameworks) via pre_install,
// and patch their build settings in post_install as a safety net.

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

      // Remove any leftover global use_modular_headers! — it conflicts with use_frameworks!
      podfileContents = podfileContents.replace(/^use_modular_headers!\n/gm, '');

      // 1. Add pre_install hook to force gRPC pods to build as static libraries.
      //    This prevents them from trying to generate module maps in framework mode.
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

      // Insert pre_install before the target block (only if not already present)
      if (!podfileContents.includes('pre_install do |installer|')) {
        podfileContents = podfileContents.replace(
          /(target ['"]Collective['"] do)/,
          `${preInstallBlock}$1`
        );
      }

      // 2. Add gRPC build settings fix inside the existing post_install block
      const postInstallFix = `

    # Fix gRPC build settings — disable module definition and allow non-modular includes
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('gRPC')
        target.build_configurations.each do |bc|
          bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
          bc.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end
    end`;

      if (!podfileContents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        // Inject after react_native_post_install call
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
