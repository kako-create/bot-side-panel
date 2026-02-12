(() => {
  if (window.__BOT_SIDE_PANEL_CONTENT__) return;
  window.__BOT_SIDE_PANEL_CONTENT__ = true;

  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("content/inject.js");
  s.async = false;
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);

  function safeSendMessage(payload) {
    try {
      if (!chrome?.runtime?.id) return;
      chrome.runtime.sendMessage(payload, () => {
        const err = chrome.runtime.lastError;
        if (err && /context invalidated/i.test(err.message)) return;
      });
    } catch {
      // ignore
    }
  }

  let lastHref = null;
  function reportBotId() {
    const href = location.href;
    if (href === lastHref) return;
    lastHref = href;
    safeSendMessage({ type: "BOT_SP_BOT_ID", url: href });
  }

  reportBotId();
  window.addEventListener("popstate", reportBotId);
  window.addEventListener("hashchange", reportBotId);

  const origPush = history.pushState;
  history.pushState = function (...args) {
    const res = origPush.apply(this, args);
    reportBotId();
    return res;
  };

  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const res = origReplace.apply(this, args);
    reportBotId();
    return res;
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reportBotId();
  });

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "BOT_SP_AUTH" && d.token) {
      safeSendMessage({ type: "BOT_SP_AUTH", token: d.token });
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "BOT_SP_PING") sendResponse({ ok: true });
  });
})();
