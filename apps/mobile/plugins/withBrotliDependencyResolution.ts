import { withAppBuildGradle, type ConfigPlugin } from "expo/config-plugins";

const marker = "// @generated codex-relay-plus: keep Hot Updater's Brotli implementation";

const withBrotliDependencyResolution: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error(
        "The Brotli dependency workaround requires the generated Android app/build.gradle to use Groovy.",
      );
    }

    const { contents } = config.modResults;
    if (contents.includes(marker)) {
      return config;
    }

    const androidBlock = "android {";
    const androidBlockIndex = contents.indexOf(androidBlock);
    if (androidBlockIndex === -1) {
      throw new Error(
        "Could not find the generated Android app/build.gradle android block while applying the Brotli dependency workaround.",
      );
    }

    const dependencyExclusion = `${marker}\nconfigurations.configureEach {\n    exclude group: "org.brotli", module: "dec"\n}\n\n`;
    config.modResults.contents =
      contents.slice(0, androidBlockIndex) +
      dependencyExclusion +
      contents.slice(androidBlockIndex);
    return config;
  });

export default withBrotliDependencyResolution;
