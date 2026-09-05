"use strict";

function normalizedFilename(state) {
  return String(state.filename || "").replace(/\\/g, "/");
}

function declaredNames(pattern, names = []) {
  if (!pattern) return names;
  if (pattern.type === "Identifier") {
    names.push(pattern.name);
    return names;
  }
  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements || []) declaredNames(element, names);
    return names;
  }
  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties || []) {
      if (property.type === "ObjectProperty") declaredNames(property.value, names);
      if (property.type === "RestElement") declaredNames(property.argument, names);
    }
    return names;
  }
  if (pattern.type === "AssignmentPattern") return declaredNames(pattern.left, names);
  if (pattern.type === "RestElement") return declaredNames(pattern.argument, names);
  return names;
}

function declarationHasAnyName(node, blocked) {
  return node.declarations.some((declarator) =>
    declaredNames(declarator.id).some((name) => blocked.has(name)),
  );
}

function containsIdentifier(t, node, name) {
  let found = false;
  t.traverseFast(node, (child) => {
    if (t.isIdentifier(child, { name })) found = true;
  });
  return found;
}

function jsxMember(t, object, property) {
  return t.jsxMemberExpression(t.jsxIdentifier(object), t.jsxIdentifier(property));
}

function jsxExpressionAttribute(t, name, expression) {
  return t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(expression));
}

function member(t, object, property) {
  return t.memberExpression(t.identifier(object), t.identifier(property));
}

function isStyleReference(t, attribute, object, property) {
  return (
    t.isJSXAttribute(attribute) &&
    t.isJSXIdentifier(attribute.name, { name: "style" }) &&
    t.isJSXExpressionContainer(attribute.value) &&
    t.isMemberExpression(attribute.value.expression) &&
    t.isIdentifier(attribute.value.expression.object, { name: object }) &&
    t.isIdentifier(attribute.value.expression.property, { name: property })
  );
}

function stripSettingsOta(t, path) {
  const blockedTopLevel = new Set(["hotUpdaterBaseUrl", "hotUpdaterBaseUrlStatus"]);
  const blockedSettingsState = new Set([
    "appliedBundleSuffix",
    "hotUpdaterTapCountRef",
    "showHotUpdaterLogs",
    "hotUpdaterLogs",
    "appUpdate",
    "isAppUpdatePending",
    "isAppUpdateActionDisabled",
    "appUpdateActionLabel",
  ]);

  path.node.body = path.node.body.filter((statement) => {
    if (t.isImportDeclaration(statement)) {
      if (
        statement.source.value === "@hot-updater/react-native" ||
        statement.source.value === "@/lib/hot-updater-logs"
      ) {
        return false;
      }
      if (statement.source.value === "react") {
        statement.specifiers = statement.specifiers.filter(
          (specifier) =>
            !(
              t.isImportSpecifier(specifier) &&
              t.isIdentifier(specifier.imported, { name: "useRef" })
            ),
        );
      }
      return true;
    }
    if (t.isVariableDeclaration(statement) && declarationHasAnyName(statement, blockedTopLevel)) {
      return false;
    }
    if (
      t.isFunctionDeclaration(statement) &&
      statement.id?.name === "appliedHotUpdateBundleSuffix"
    ) {
      return false;
    }
    if (
      t.isTSTypeAliasDeclaration(statement) &&
      (statement.id.name === "AppUpdateInfo" || statement.id.name === "AppUpdateState")
    ) {
      return false;
    }
    return true;
  });

  const settings = path.node.body.find(
    (statement) => t.isFunctionDeclaration(statement) && statement.id?.name === "SettingsScreen",
  );
  if (!settings || !t.isBlockStatement(settings.body)) {
    throw new Error("Codex Relay no-OTA overlay could not find SettingsScreen.");
  }

  const nextBody = [];
  for (const statement of settings.body.body) {
    if (t.isVariableDeclaration(statement)) {
      const names = statement.declarations.flatMap((declarator) => declaredNames(declarator.id));
      if (names.includes("appVersion")) {
        const expoConfig = member(t, "Constants", "expoConfig");
        const version = t.optionalMemberExpression(expoConfig, t.identifier("version"), false, true);
        nextBody.push(
          t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier("appVersion"),
              t.logicalExpression("??", version, t.stringLiteral("1.0.0")),
            ),
          ]),
        );
        continue;
      }
      if (declarationHasAnyName(statement, blockedSettingsState)) {
        continue;
      }
    }
    if (
      t.isExpressionStatement(statement) &&
      t.isCallExpression(statement.expression) &&
      t.isIdentifier(statement.expression.callee, { name: "useEffect" }) &&
      containsIdentifier(t, statement, "HotUpdater")
    ) {
      continue;
    }
    if (
      t.isFunctionDeclaration(statement) &&
      (statement.id?.name === "applyAppUpdate" || statement.id?.name === "revealHotUpdaterLogs")
    ) {
      continue;
    }
    nextBody.push(statement);
  }
  settings.body.body = nextBody;
}

function replaceVersionFooter(t, path) {
  if (path.getData("codexRelayNoOtaReplaced")) return;
  if (
    !path.node.openingElement.attributes.some((attribute) =>
      isStyleReference(t, attribute, "styles", "versionFooter"),
    )
  ) {
    return;
  }

  const themedText = t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier("ThemedText"),
      [
        t.jsxAttribute(t.jsxIdentifier("type"), t.stringLiteral("code")),
        t.jsxAttribute(t.jsxIdentifier("themeColor"), t.stringLiteral("textSecondary")),
        jsxExpressionAttribute(t, "style", member(t, "styles", "versionText")),
      ],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier("ThemedText")),
    [
      t.jsxText("\n              Version "),
      t.jsxExpressionContainer(t.identifier("releaseVersionLabel")),
      t.jsxText("\n            "),
    ],
    false,
  );

  const replacement = t.jsxElement(
    t.jsxOpeningElement(
      jsxMember(t, "Animated", "View"),
      [
        jsxExpressionAttribute(t, "layout", t.identifier("settingsLayoutTransition")),
        jsxExpressionAttribute(t, "style", member(t, "styles", "versionFooter")),
      ],
      false,
    ),
    t.jsxClosingElement(jsxMember(t, "Animated", "View")),
    [t.jsxText("\n            "), themedText, t.jsxText("\n          ")],
    false,
  );
  path.setData("codexRelayNoOtaReplaced", true);
  path.replaceWith(replacement);
  path.skip();
}

function stripTailscaleOnboarding(t, path, state) {
  path.node.body = path.node.body.filter((statement) => {
    if (t.isImportDeclaration(statement) && statement.source.value === "react-native") {
      statement.specifiers = statement.specifiers.filter(
        (specifier) =>
          !(
            t.isImportSpecifier(specifier) &&
            t.isIdentifier(specifier.imported, { name: "Linking" })
          ),
      );
      return true;
    }
    if (
      t.isVariableDeclaration(statement) &&
      declarationHasAnyName(statement, new Set(["tailscaleAppStoreUrl"]))
    ) {
      return false;
    }
    return true;
  });
  state.__codexRelayConnectionBanner = true;
}

function rewriteConnectionStep(t, path) {
  if (path.getData("codexRelayTailcatStepRewritten")) return;
  if (!t.isJSXIdentifier(path.node.openingElement.name, { name: "PairingStep" })) return;
  const label = path.node.openingElement.attributes.find(
    (attribute) =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: "label" }) &&
      t.isStringLiteral(attribute.value),
  );
  if (!label || label.value.value !== "2") return;

  const isZhCn = process.env.CODEX_RELAY_LOCALE === "zh-CN";
  const title = isZhCn ? "局域网或内置远程连接" : "Use Wi-Fi or built-in remote access";
  const body = isZhCn
    ? "附近使用时会自动优先连接同一局域网；离开该网络后，配对设备会自动尝试内置远程连接，无需另外安装 Tailscale。"
    : "Nearby, Codex Relay automatically prefers the same local network. Away from that network, paired devices automatically try the built-in remote connection; no separate Tailscale install is required.";

  path.node.openingElement.attributes = [
    t.jsxAttribute(t.jsxIdentifier("icon"), t.stringLiteral("workspace")),
    t.jsxAttribute(t.jsxIdentifier("label"), t.stringLiteral("2")),
    t.jsxAttribute(t.jsxIdentifier("title"), t.stringLiteral(title)),
    t.jsxAttribute(t.jsxIdentifier("body"), t.stringLiteral(body)),
  ];
  path.setData("codexRelayTailcatStepRewritten", true);
}

module.exports = function codexRelayProductOverrides({ types: t }) {
  return {
    name: "codex-relay-product-overrides",
    visitor: {
      Program(path, state) {
        const filename = normalizedFilename(state);
        if (filename.endsWith("/apps/mobile/src/app/settings.tsx")) {
          state.__codexRelaySettingsNoOta = true;
          stripSettingsOta(t, path);
        }
        if (filename.endsWith("/apps/mobile/src/components/chat/ConnectionBanner.tsx")) {
          stripTailscaleOnboarding(t, path, state);
        }
      },
      JSXElement(path, state) {
        if (state.__codexRelaySettingsNoOta) {
          replaceVersionFooter(t, path);
        }
        if (state.__codexRelayConnectionBanner) {
          rewriteConnectionStep(t, path);
        }
      },
    },
  };
};
