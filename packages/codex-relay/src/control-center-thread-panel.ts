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

  var copy = {
    "zh-CN": {
      title: "Codex 会话",
      description: "跨目录浏览本机 Codex 历史与共享会话，并直接恢复到共享 app-server。",
      refresh: "刷新",
      loading: "正在加载会话…",
      empty: "暂无可恢复的 Codex 会话",
      resume: "恢复",
      resuming: "恢复中…",
      resumed: "会话已恢复",
      failed: "会话加载失败",
      resumeFailed: "恢复会话失败",
      unnamed: "未命名会话",
      cwd: "目录",
      updated: "更新"
    },
    "en-US": {
      title: "Codex sessions",
      description: "Browse Codex history across directories and resume a session through the shared app-server.",
      refresh: "Refresh",
      loading: "Loading sessions…",
      empty: "No resumable Codex sessions",
      resume: "Resume",
      resuming: "Resuming…",
      resumed: "Session resumed",
      failed: "Could not load sessions",
      resumeFailed: "Could not resume session",
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
  var list = document.createElement("div");
  list.className = "list";
  body.appendChild(head);
  body.appendChild(list);
  card.appendChild(body);
  stack.insertBefore(card, diagnosticsCard || null);

  var threads = [];
  var loading = false;
  var lastError = "";
  var resumeId = "";

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
    showToast.timer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  function empty(message) {
    var node = document.createElement("div");
    node.className = "empty";
    node.textContent = message;
    return node;
  }

  function render() {
    title.textContent = text("title");
    description.textContent = text("description");
    refreshButton.textContent = text("refresh");
    refreshButton.disabled = loading;
    count.textContent = String(threads.length);
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

    threads.forEach(function (thread) {
      var row = document.createElement("div");
      row.className = "row";
      var main = document.createElement("div");
      main.className = "row-main";
      var rowTitle = document.createElement("div");
      rowTitle.className = "row-title";
      rowTitle.textContent = thread.name || thread.preview || text("unnamed") + " " + shortId(thread.id);
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
      button.textContent = resumeId === thread.id ? text("resuming") : text("resume");
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
        showToast(text("resumed"));
        return refresh();
      })
      .catch(function (error) {
        var message = error && error.message ? error.message : String(error || "unknown error");
        showToast(text("resumeFailed") + ": " + message);
      })
      .then(function () {
        resumeId = "";
        render();
      });
  }

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
