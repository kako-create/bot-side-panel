(() => {
  if (window.__BOT_SIDE_PANEL_INJECT__) return;
  window.__BOT_SIDE_PANEL_INJECT__ = true;

  const allowedHosts = [
    "api.bots.digitalcontact.cloud",
    "new.boteria.com.br",
    "bots.digitalcontact.cloud",
  ];
  const API_HOST = "api.bots.digitalcontact.cloud";
  const isAllowedUrl = (url) => {
    try {
      const parsed = new URL(String(url), location.origin);
      return allowedHosts.includes(parsed.hostname);
    } catch {
      return false;
    }
  };

  const isApiUrl = (url) => {
    try {
      const parsed = new URL(String(url), location.origin);
      return parsed.hostname === API_HOST;
    } catch {
      return false;
    }
  };

  // Debug: avoid persisting large/sensitive responses. We only keep minimal JSON
  // for a small whitelist of endpoints that help map ids -> labels.
  const getDebugCaptureKind = (url) => {
    try {
      const parsed = new URL(String(url), location.origin);
      if (parsed.hostname !== API_HOST) return null;
      const path = parsed.pathname;
      if (path === "/api/v3/bots") return "bots";
      if (path === "/api/v3/companies" || path.startsWith("/api/v3/companies/")) return "companies";
      if (path.startsWith("/api/v3/organizations/list/")) return "organizations";
      return null;
    } catch {
      return null;
    }
  };

  const shouldCaptureBody = (url) => Boolean(getDebugCaptureKind(url));

  const safeJsonParse = (text) => {
    try {
      return JSON.parse(String(text));
    } catch {
      return null;
    }
  };

  const pickObject = (value, keys) => {
    const obj = value && typeof value === "object" ? value : null;
    if (!obj) return null;
    const out = {};
    for (const k of keys) {
      if (k in obj) out[k] = obj[k];
    }
    return out;
  };

  const reduceDebugBody = (kind, payload) => {
    if (kind === "organizations") {
      const list = Array.isArray(payload) ? payload : [];
      return list.map((item) =>
        pickObject(item, ["_id", "name", "companyId", "organizationId"]) || { value: item },
      );
    }

    if (kind === "bots") {
      const list = Array.isArray(payload) ? payload : [];
      return list.map((item) =>
        pickObject(item, ["_id", "title", "type", "companyId", "organizationId", "isActive", "active", "deleted"]) || {
          value: item,
        },
      );
    }

    // companies
    if (Array.isArray(payload)) {
      return payload.map((item) => pickObject(item, ["_id", "fantasyName", "dateUpdate", "dateCreation"]) || { value: item });
    }
    const obj = payload && typeof payload === "object" ? payload : null;
    if (!obj) return payload;
    // Keep only a small subset: enough to identify the company.
    const direct = pickObject(obj, ["_id", "fantasyName", "dateUpdate", "dateCreation"]);
    if (direct && direct.fantasyName) return direct;
    const nested = pickObject(obj?.data, ["_id", "fantasyName", "dateUpdate", "dateCreation"]);
    if (nested && nested.fantasyName) return nested;
    return direct || nested || payload;
  };

  const buildDebugBody = (url, text) => {
    const kind = getDebugCaptureKind(url);
    if (!kind) return null;
    const payload = safeJsonParse(text);
    if (!payload) return null;
    try {
      return JSON.stringify(reduceDebugBody(kind, payload));
    } catch {
      return null;
    }
  };

  const isDebugEnabled = () => {
    try {
      const root = document?.documentElement;
      const flag = root?.dataset?.botSpDebugEnabled;
      if (flag != null) return flag === '1';
      // Fallback (legacy) if some environment uses a global flag.
      return Boolean(window.__BOT_SP_DEBUG_ENABLED__);
    } catch {
      return false;
    }
  };

  const clampText = (text, maxLen) => {
    const value = String(text ?? "");
    if (!maxLen || value.length <= maxLen) return value;
    return `${value.slice(0, Math.max(0, maxLen - 16))}\n... (truncado)`;
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

  function postDebug(event) {
    if (!isDebugEnabled()) return;
    if (!event || typeof event !== "object") return;
    window.postMessage(
      {
        type: "BOT_SP_DEBUG_EVENT",
        event: { ...event, href: location.href },
      },
      "*",
    );
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
      this.__botSpMethod = args[0];
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
      if (isApiUrl(this.__botSpUrl) && !this.__botSpDebugListener) {
        this.__botSpDebugListener = true;
        this.__botSpDebugStartedAt = performance.now();
        this.addEventListener("loadend", () => {
          try {
            if (!isDebugEnabled()) return;
            const url = this.__botSpUrl;
            if (!isApiUrl(url)) return;

            const durationMs = performance.now() - (this.__botSpDebugStartedAt || performance.now());
            const status = Number(this.status);
            const method = String(this.__botSpMethod || "GET").toUpperCase();
            const ok = status >= 200 && status < 300;
            let responseText = null;
            let responseBytes = null;
            const text = typeof this.responseText === "string" ? this.responseText : "";
            if (text) responseBytes = text.length;
            if (text && shouldCaptureBody(url)) {
              const reduced = buildDebugBody(url, text);
              if (reduced) responseText = clampText(reduced, 20_000);
            }

            postDebug({
              kind: "xhr",
              method,
              url,
              status,
              ok,
              durationMs,
              responseBytes,
              responseText,
            });
          } catch {}
        });
      }

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
    const method =
      String(init?.method || input?.method || "GET")
        .trim()
        .toUpperCase() || "GET";
    const startedAt = performance.now();

    try {
      const auth = getAuthFromHeaders(init?.headers) || getAuthFromHeaders(input?.headers);
      if (auth && /^bearer\s+/i.test(String(auth)) && isAllowedUrl(url)) {
        postAuth(String(auth));
      }
    } catch {}
    let response;
    try {
      response = await origFetch(...args);
    } catch (error) {
      try {
        if (isDebugEnabled() && isApiUrl(url)) {
          postDebug({
            kind: "fetch",
            method,
            url,
            status: null,
            ok: false,
            durationMs: performance.now() - startedAt,
            responseBytes: null,
            responseText: clampText(String(error?.message ?? error), 8000),
          });
        }
      } catch {}
      throw error;
    }
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

    try {
      if (isDebugEnabled() && response && isApiUrl(url)) {
        const status = Number(response.status);
        const ok = Boolean(response.ok);
        const durationMs = performance.now() - startedAt;
        let responseText = null;
        let responseBytes = null;
        if (shouldCaptureBody(url) && typeof response.clone === "function") {
          response
            .clone()
            .text()
            .then((text) => {
              try {
                responseBytes = text ? text.length : 0;
                const reduced = text ? buildDebugBody(url, text) : null;
                responseText = reduced ? clampText(reduced, 20_000) : null;
                postDebug({
                  kind: "fetch",
                  method,
                  url,
                  status,
                  ok,
                  durationMs,
                  responseBytes,
                  responseText,
                });
              } catch {}
            })
            .catch(() => {
              postDebug({
                kind: "fetch",
                method,
                url,
                status,
                ok,
                durationMs,
                responseBytes: null,
                responseText: null,
              });
            });
        } else {
          postDebug({
            kind: "fetch",
            method,
            url,
            status,
            ok,
            durationMs,
            responseBytes: null,
            responseText: null,
          });
        }
      }
    } catch {}

    return response;
  };
})();
