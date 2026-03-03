// Custom Expo config plugin to fix Firebase + gRPC CocoaPods build conflict.
//
// Problem: Firebase Swift pods need use_modular_headers! for pod install to succeed.
// But gRPC pods can't generate module maps under use_frameworks! :linkage => :static,
// causing Xcode build to fail with "gRPC-Core.modulemap not found".
//
// Fix: Keep use_modular_headers! globally (required for pod install) but force gRPC
// pods to build as static libraries so they skip module map generation entirely.

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

      // 1. Ensure use_modular_headers! is present (Firebase Swift pods need it for pod install)
      if (!podfileContents.includes('use_modular_headers!')) {
        podfileContents = podfileContents.replace(
          /(platform :ios.*\n)/,
          `$1use_modular_headers!\n`
        );
      }

      // 2. Add pre_install hook to force gRPC + BoringSSL pods to build as static libraries.
      //    This prevents them from trying to generate module maps in framework mode,
      //    which is what causes the "gRPC-Core.modulemap not found" Xcode build error.
      const preInstallBlock = `
# Force gRPC pods to build as static libraries — they cannot generate
# module maps when use_frameworks! :linkage => :static is active.
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if pod.name.start_with?('gRPC') || pod.name == 'BoringSSL-GRPC'
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

      // 3. Add post_install fix for gRPC build settings as safety net
      const postInstallFix = `

    # Fix gRPC build settings — disable module definition and allow non-modular includes
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('gRPC') || target.name == 'BoringSSL-GRPC'
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
