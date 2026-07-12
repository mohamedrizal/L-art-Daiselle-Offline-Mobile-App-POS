const { withGradleProperties } = require('@expo/config-plugins');

// Prebuild regenerates android/gradle.properties from scratch every time
// (the android/ folder is gitignored), so hand edits there don't survive a
// clean prebuild or an EAS cloud build. These properties keep release builds
// from ballooning to hundreds of MB: minify/shrink strip unused code and
// resources, and dropping x86/x86_64 (emulator-only ABIs) roughly halves the
// bundled native library size for an app only ever installed on real phones.
const PROPERTIES = {
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

function withAndroidReleaseOptimizations(config) {
  return withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = config.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        config.modResults.push({ type: 'property', key, value });
      }
    }
    return config;
  });
}

module.exports = withAndroidReleaseOptimizations;
