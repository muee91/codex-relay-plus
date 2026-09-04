import { renderControlCenterPage } from "./control-center-page.js";

export function renderControlCenterPageWithThreads(controlToken: string) {
  return renderControlCenterPage(controlToken).replace(
    "</body>",
    `${threadPanelScript}</body>`,
  );
}

const threadPanelScript = String.raw`<script>
(function () {
  var tokenNode = document.querySelector('meta[name="codex-relay-control-token"]');
  var token = tokenNode ? tokenNode.content : "";
  var languageSelect = document.getElementById("language");
  var stack = document.querySelector(".layout > .stack");
  var diagnostics = document.getElementById("diagnostics");
  var diagnosticsCard = diagnostics && diagnostics.closest ? diagnostics.closest(".card") : null;
  if (!stack || !token) return;

  var style = document.createElement("style");
  style.textContent = [
    ":where(button, select, input):focus-visible { outline: 2px solid #93e1b6; outline-offset: 2px; }",
    ".thread-tools { display:flex; gap:8px; align-items:center; margin:12px 0 0; }",
    ".thread-search { width:100%; min-width:0; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:inherit; border-radius:8px; padding:9px 11px; font:inherit; }",
    ".thread-search::placeholder { color:rgba(255,255,255,.42); }"
  ].join("\n");
  document.head.appendChild(style);

  var copy = {
    "zh-CN": {
      title: "Codex 会话",
      description: "跨目录浏览本机 Codex 历史与共享会话，并激活到共享 app-server。",
      refresh: "刷新",
      search: "搜索名称、预览、目录或 ID",
      loading: "正在加载会话…",
      empty: "暂无可恢复的 Codex 会话",
      noMatches: "没有匹配的会话",
      activate: "激活",
      activating: "激活中…",
      activated: "会话已激活，可从手机或 codex resume --remote 继续",
      failed: "会话加载失败",
      activateFailed: "激活会话失败",
      unnamed: "未命名会话",
      cwd: "目录",
      updated: "更新"
    },
    "en-US": {
      title: "Codex sessions",
      description: "Browse Codex history across directories and activate a session on the shared app-server.",
      refresh: "Refresh",
      search: "Search name, preview, directory, or ID",
      loading: "Loading sessions…",
      empty: "No resumable Codex sessions",
      noMatches: "No matching sessions",
      activate: "Activate",
      activating: "Activating…",
      activated: "Session activated; continue from mobile or codex resume --remote",
      failed: "Could not load sessions",
      activateFailed: "Could not activate session",
      unnamed: "Unnamed session",
      cwd: "Directory",
      updated: "Updated"
    }
  };

  var card = document.createElement("section");
  card.className = "card";
  var body = document.createElement("div");
  body.className = "card-body";
  var head = document.createElement("div");
  head.className = "card-head";
  var heading = document.createElement("div");
  var title = document.createElement("h2");
  title.className = "card-title";
  var description = document.createElement("div");
  description.className = "card-desc";
  heading.appendChild(title);
  heading.appendChild(description);
  var actions = document.createElement("div");
  actions.className = "actions";
  var count = document.createElement("span");
  count.className = "connection-pill";
  count.textContent = "0";
  var refreshButton = document.createElement("button");
  refreshButton.className = "btn small";
  refreshButton.type = "button";
  actions.appendChild(count);
  actions.appendChild(refreshButton);
  head.appendChild(heading);
  head.appendChild(actions);
  var tools = document.createElement("div");
  tools.className = "thread-tools";
  var searchInput = document.createElement("input");
  searchInput.className = "thread-search";
  searchInput.type = "search";
  searchInput.autocomplete = "off";
  tools.appendChild(searchInput);
  var list = document.createElement("div");
  list.className = "list";
  body.appendChild(head);
  body.appendChild(tools);
  body.appendChild(list);
  card.appendChild(body);
  stack.insertBefore(card, diagnosticsCard || null);

  var threads = [];
  var loading = false;
  var lastError = "";
  var resumeId = "";
  var query = "";

  function locale() {
    return languageSelect && languageSelect.value === "en-US" ? "en-US" : "zh-CN";
  }

  function text(key) {
    var messages = copy[locale()] || copy["zh-CN"];
    return messages[key] || key;
  }

  function shortId(value) {
    return String(value || "").slice(0, 12);
  }

  function formatTime(value) {
    if (!value) return "";
    var timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return "";
    if (timestamp < 100000000000) timestamp *= 1000;
    try {
      return new Date(timestamp).toLocaleString(locale(), {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return new Date(timestamp).toLocaleString();
    }
  }

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {}, {
      "x-codex-relay-control-token": token
    });
    return fetch(path, options).then(function (response) {
      return response.text().then(function (raw) {
        var payload = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch (_) { payload = {}; }
        if (!response.ok) throw new Error(payload.error || ("HTTP " + response.status));
        return payload;
      });
    });
  }

  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove("show"); }, 3200);
  }

  function empty(message) {
    var node = document.createElement("div");
    node.className = "empty";
    node.textContent = message;
    return node;
  }

  function matches(thread) {
    if (!query) return true;
    var haystack = [thread.name, thread.preview, thread.cwd, thread.id]
      .filter(Boolean)
      .join("\n")
      .toLocaleLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function render() {
    title.textContent = text("title");
    description.textContent = text("description");
    refreshButton.textContent = text("refresh");
    refreshButton.setAttribute("aria-label", text("refresh") + " " + text("title"));
    refreshButton.disabled = loading;
    searchInput.placeholder = text("search");
    searchInput.setAttribute("aria-label", text("search"));
    var visibleThreads = threads.filter(matches);
    count.textContent = query ? String(visibleThreads.length) + "/" + String(threads.length) : String(threads.length);
    while (list.firstChild) list.removeChild(list.firstChild);

    if (loading && !threads.length) {
      list.appendChild(empty(text("loading")));
      return;
    }
    if (lastError && !threads.length) {
      list.appendChild(empty(text("failed") + ": " + lastError));
      return;
    }
    if (!threads.length) {
      list.appendChild(empty(text("empty")));
      return;
    }
    if (!visibleThreads.length) {
      list.appendChild(empty(text("noMatches")));
      return;
    }

    visibleThreads.forEach(function (thread) {
      var row = document.createElement("div");
      row.className = "row";
      var main = document.createElement("div");
      main.className = "row-main";
      var rowTitle = document.createElement("div");
      rowTitle.className = "row-title";
      var displayName = thread.name || thread.preview || text("unnamed") + " " + shortId(thread.id);
      rowTitle.textContent = displayName;
      var meta = document.createElement("div");
      meta.className = "meta code";
      var parts = [];
      if (thread.cwd) parts.push(text("cwd") + " " + thread.cwd);
      var updated = formatTime(thread.updatedAt);
      if (updated) parts.push(text("updated") + " " + updated);
      parts.push(shortId(thread.id));
      meta.textContent = parts.join(" · ");
      main.appendChild(rowTitle);
      main.appendChild(meta);

      var button = document.createElement("button");
      button.className = "btn primary small";
      button.type = "button";
      button.disabled = Boolean(resumeId);
      button.textContent = resumeId === thread.id ? text("activating") : text("activate");
      button.setAttribute("aria-label", text("activate") + ": " + displayName);
      button.onclick = function () { resume(thread.id); };
      row.appendChild(main);
      row.appendChild(button);
      list.appendChild(row);
    });
  }

  function refresh() {
    if (loading) return Promise.resolve();
    loading = true;
    lastError = "";
    render();
    return api("/api/threads?limit=30").then(function (payload) {
      threads = Array.isArray(payload.threads) ? payload.threads : [];
    }).catch(function (error) {
      lastError = error && error.message ? error.message : String(error || "unknown error");
    }).then(function () {
      loading = false;
      render();
    });
  }

  function resume(threadId) {
    if (!threadId || resumeId) return;
    resumeId = threadId;
    render();
    api("/api/threads/" + encodeURIComponent(threadId) + "/resume", { method: "POST" })
      .then(function () {
        showToast(text("activated"));
        return refresh();
      })
      .catch(function (error) {
        var message = error && error.message ? error.message : String(error || "unknown error");
        showToast(text("activateFailed") + ": " + message);
      })
      .then(function () {
        resumeId = "";
        render();
      });
  }

  searchInput.addEventListener("input", function () {
    query = searchInput.value.trim().toLocaleLowerCase();
    render();
  });
  refreshButton.onclick = refresh;
  if (languageSelect) languageSelect.addEventListener("change", render);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
  refresh();
  setInterval(function () {
    if (!document.hidden) refresh();
  }, 10000);
})();
</script>`;
