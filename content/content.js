(() => {
  if (window.__BOT_SIDE_PANEL_CONTENT__) return;
  window.__BOT_SIDE_PANEL_CONTENT__ = true;

  // A flag de debug e gerenciada no background da extensao e espelhada no DOM da pagina
  // para que o `inject.js` (rodando no contexto da pagina) decida se deve emitir eventos de debug.
  try {
    document.documentElement.dataset.botSpDebugEnabled = "0";
  } catch {
    // ignorar
  }

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
      // ignorar
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
  window.addEventListener("focus", reportBotId);
  window.addEventListener("pageshow", reportBotId);

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "BOT_SP_AUTH" && d.token) {
      safeSendMessage({ type: "BOT_SP_AUTH", token: d.token });
      return;
    }
    if (d.type === "BOT_SP_COMPANY" && d.orgId) {
      safeSendMessage({
        type: "BOT_SP_COMPANY_INFO",
        orgId: d.orgId,
        fantasyName: d.fantasyName,
        url: d.href || location.href,
      });
    }
    if (d.type === "BOT_SP_DEBUG_EVENT" && d.event) {
      safeSendMessage({ type: "BOT_SP_DEBUG_EVENT", event: d.event });
    }
  });

  // Pergunta ao background se o debug esta habilitado e espelha a flag no contexto da pagina.
  try {
    chrome.runtime.sendMessage({ type: "BOT_SP_DEBUG_STATS" }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) return;
      const enabled = Boolean(response?.data?.enabled);
      if (!enabled) return;
      try {
        document.documentElement.dataset.botSpDebugEnabled = "1";
      } catch {
        // ignorar
      }
    });
  } catch {
    // ignorar
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "BOT_SP_PING") sendResponse({ ok: true });
    if (msg?.type === "BOT_SP_REQUEST_CONTEXT") {
      reportBotId();
      sendResponse({ ok: true, url: location.href });
    }
  });
})();
