(() => {
  if (window.__BOT_SIDE_PANEL_INJECT__) return;
  window.__BOT_SIDE_PANEL_INJECT__ = true;

  const allowedHosts = [
    "api.bots.digitalcontact.cloud",
    "new.boteria.com.br",
    "bots.digitalcontact.cloud",
  ];
  const isAllowedUrl = (url) => {
    try {
      const parsed = new URL(String(url), location.origin);
      return allowedHosts.includes(parsed.hostname);
    } catch {
      return false;
    }
  };

  function postAuth(token) {
    window.postMessage({ type: "BOT_SP_AUTH", token }, "*");
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    try {
      this.__botSpUrl = args[1];
    } catch {}
    return origOpen.apply(this, args);
  };

  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (
        String(name).toLowerCase() === "authorization" &&
        /^bearer\s+/i.test(String(value)) &&
        isAllowedUrl(this.__botSpUrl)
      ) {
        postAuth(String(value));
      }
    } catch {}
    return origSetHeader.call(this, name, value);
  };

  function getAuthFromHeaders(h) {
    if (!h) return null;
    try {
      if (h instanceof Headers) return h.get("Authorization") || h.get("authorization");
      if (Array.isArray(h)) {
        const row = h.find(([k]) => String(k).toLowerCase() === "authorization");
        return row ? row[1] : null;
      }
      if (typeof h === "object") return h.Authorization || h.authorization || null;
    } catch {}
    return null;
  }

  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const input = args[0];
    const init = args[1];

    try {
      const auth = getAuthFromHeaders(init?.headers) || getAuthFromHeaders(input?.headers);
      const url = typeof input === "string" ? input : input?.url;
      if (auth && /^bearer\s+/i.test(String(auth)) && isAllowedUrl(url)) {
        postAuth(String(auth));
      }
    } catch {}

    return origFetch(...args);
  };
})();
