module.exports = function (api) {
  api.cache.using(
    () =>
      `${process.env.CODEX_RELAY_LOCALE || "en-US"}:${process.env.CODEX_RELAY_PLATFORM || "auto"}:${process.env.CODEX_RELAY_DESKTOP_FIRST || "0"}`,
  );

  const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "./babel-plugin-product-overrides.cjs",
      "@babel/plugin-transform-async-to-generator",
      ...(isZhCn ? ["./babel-plugin-zh-cn.cjs"] : []),
    ],
  };
};
