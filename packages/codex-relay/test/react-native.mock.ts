export const NativeModules: Record<string, unknown> = {};

export const Platform = {
  OS: "web",
  select<T>(values: { default?: T; web?: T }) {
    return values.web ?? values.default;
  },
};
