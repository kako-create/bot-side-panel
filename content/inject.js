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

  const COMPANY_RE = /\/api\/v3\/companies\/([^/?#]+)/i;

  const getCompanyFromUrl = (url) => {
    try {
      const parsed = new URL(String(url), location.origin);
      if (!allowedHosts.includes(parsed.hostname)) return null;
      const match = parsed.pathname.match(COMPANY_RE);
      if (!match) return null;
      const orgId = decodeURIComponent(String(match[1] ?? "")).trim();
      if (!orgId) return null;
      return { orgId };
    } catch {
      return null;
    }
  };

  const normalizeFantasyName = (value) => {
    const text = String(value ?? "").trim();
    return text || null;
  };

  const extractFantasyName = (payload) => {
    if (!payload || typeof payload !== "object") return null;
    const direct = normalizeFantasyName(payload.fantasyName);
    if (direct) return direct;
    const data = payload.data;
    if (data && typeof data === "object") {
      const nested = normalizeFantasyName(data.fantasyName);
      if (nested) return nested;
    }
    return null;
  };

  function postAuth(token) {
    window.postMessage({ type: "BOT_SP_AUTH", token }, "*");
  }

  function postCompany(orgId, fantasyName) {
    if (!orgId || !fantasyName) return;
    window.postMessage({ type: "BOT_SP_COMPANY", orgId, fantasyName, href: location.href }, "*");
  }

  const tryPostCompany = (url, payload) => {
    const company = getCompanyFromUrl(url);
    if (!company) return;
    const fantasyName = extractFantasyName(payload);
    if (!fantasyName) return;
    postCompany(company.orgId, fantasyName);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    try {
      this.__botSpUrl = args[1];
      this.__botSpCompany = getCompanyFromUrl(args[1]);
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

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    try {
      const company = this.__botSpCompany || getCompanyFromUrl(this.__botSpUrl);
      if (company && !this.__botSpCompanyListener) {
        this.__botSpCompanyListener = true;
        this.addEventListener("loadend", () => {
          try {
            if (this.status < 200 || this.status >= 300) return;
            const text = typeof this.responseText === "string" ? this.responseText : "";
            if (!text) return;
            const payload = JSON.parse(text);
            tryPostCompany(this.__botSpUrl, payload);
          } catch {}
        });
      }
    } catch {}
    return origSend.apply(this, args);
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
    const url = typeof input === "string" ? input : input?.url;

    try {
      const auth = getAuthFromHeaders(init?.headers) || getAuthFromHeaders(input?.headers);
      if (auth && /^bearer\s+/i.test(String(auth)) && isAllowedUrl(url)) {
        postAuth(String(auth));
      }
    } catch {}
    const response = await origFetch(...args);
    try {
      if (response?.ok && getCompanyFromUrl(url)) {
        response
          .clone()
          .json()
          .then((payload) => {
            tryPostCompany(url, payload);
          })
          .catch(() => {});
      }
    } catch {}
    return response;
  };
})();
