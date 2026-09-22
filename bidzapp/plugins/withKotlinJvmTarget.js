// plugins/withKotlinJvmTarget.js
const { withProjectBuildGradle } = require('@expo/config-plugins');

const KOTLIN_JVM_TARGET_BLOCK = `
// ── Added by withKotlinJvmTarget config plugin ───────────────────────────────
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        kotlinOptions {
            jvmTarget = '17'
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
`;

// Guard tag so the block is never appended twice on repeated prebuilds
const GUARD_TAG = '// ── Added by withKotlinJvmTarget config plugin ─';

module.exports = function withKotlinJvmTarget(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      // Kotlin DSL (build.gradle.kts) — adjust syntax if needed
      return gradleConfig;
    }

    if (gradleConfig.modResults.contents.includes(GUARD_TAG)) {
      // Already patched — skip
      return gradleConfig;
    }

    gradleConfig.modResults.contents += KOTLIN_JVM_TARGET_BLOCK;
    return gradleConfig;
  });
};