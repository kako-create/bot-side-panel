(() => {
  if (window.__BOT_SIDE_PANEL_INJECT__) return;
  window.__BOT_SIDE_PANEL_INJECT__ = true;

  const allowedHosts = [
    "api.bots.digitalcontact.cloud",
    "new.boteria.com.br",
    "bots.digitalcontact.cloud",
  ];
  const API_HOST = "api.bots.digitalcontact.cloud";
  const AI_INTENTS_URL = "https://api.bots.digitalcontact.cloud/api/v3/conditions/fetch?key=kgjdhURyashsJKSkd2kkd98Yf7";
  const LEX_TOKEN = "ENT1CX7YBV";
  const LEX_INTENTS_URL = `https://ia.bots.digitalcontact.cloud/lex/intent?token=${encodeURIComponent(LEX_TOKEN)}`;
  const buildLexSamplesUrl = (intentName, token = LEX_TOKEN) =>
    `https://ia.bots.digitalcontact.cloud/lex/samples?token=${encodeURIComponent(token)}&intent=${encodeURIComponent(intentName)}`;
  const PAGE_FETCH_AI_INTENTS = "BOT_SP_PAGE_FETCH_AI_INTENTS";
  const PAGE_FETCH_AI_INTENTS_RESULT = "BOT_SP_PAGE_FETCH_AI_INTENTS_RESULT";
  const PAGE_FETCH_LEX_INTENTS = "BOT_SP_PAGE_FETCH_LEX_INTENTS";
  const PAGE_FETCH_LEX_INTENTS_RESULT = "BOT_SP_PAGE_FETCH_LEX_INTENTS_RESULT";
  let latestAuthorization = null;
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

  // Debug: evitar persistir respostas grandes/sensiveis. Mantemos apenas um JSON minimo
  // para uma pequena lista permitida de endpoints que ajuda a mapear ids -> labels.
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

    // empresas
    if (Array.isArray(payload)) {
      return payload.map((item) => pickObject(item, ["_id", "fantasyName", "dateUpdate", "dateCreation"]) || { value: item });
    }
    const obj = payload && typeof payload === "object" ? payload : null;
    if (!obj) return payload;
    // Manter apenas um subconjunto pequeno: suficiente para identificar a empresa.
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
      // Alternativa (legado) caso algum ambiente use uma flag global.
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
    latestAuthorization = token;
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
        latestAuthorization = String(value);
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

  const normalizeIntentPayload = (payload) => {
    if (typeof payload !== "string") return payload;
    const trimmed = payload.trim();
    if (!trimmed) return payload;
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return payload;
    try {
      return JSON.parse(trimmed);
    } catch {
      return payload;
    }
  };

  const runWithConcurrency = async (items, concurrency, worker) => {
    const results = new Array(items.length);
    let cursor = 0;
    const size = Math.max(1, Number(concurrency) || 1);
    const runners = new Array(Math.min(size, items.length || 1)).fill(0).map(async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  };

  const normalizeLexIntentList = (payload) => {
    const intents = Array.isArray(payload?.intents)
      ? payload.intents
      : Array.isArray(payload?.body?.intents)
        ? payload.body.intents
        : [];
    const token = String(payload?.token ?? payload?.body?.token ?? LEX_TOKEN).trim() || LEX_TOKEN;
    return { intents, token };
  };

  const normalizeLexSamples = (payload) =>
    Array.isArray(payload?.body?.data)
      ? payload.body.data
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  window.addEventListener("message", async (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== PAGE_FETCH_AI_INTENTS) return;

    const requestId = String(data.requestId ?? "").trim();
    const botId = String(data.botId ?? "").trim();
    const authorization = String(data.authorization ?? latestAuthorization ?? "").trim();

    if (!requestId) return;
    if (!botId) {
      window.postMessage({ type: PAGE_FETCH_AI_INTENTS_RESULT, requestId, ok: false, error: "botId ausente." }, "*");
      return;
    }
    if (!authorization || !/^bearer\s+/i.test(authorization)) {
      window.postMessage(
        { type: PAGE_FETCH_AI_INTENTS_RESULT, requestId, ok: false, error: "Token de autorização ausente." },
        "*",
      );
      return;
    }

    try {
      const response = await origFetch(AI_INTENTS_URL, {
        method: "POST",
        headers: {
          Accept: "application/json, text/plain, */*",
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ botId }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      let payload = normalizeIntentPayload(safeJsonParse(text) ?? text);
      payload = normalizeIntentPayload(payload);
      const items = Array.isArray(payload) ? payload : [];
      window.postMessage({ type: PAGE_FETCH_AI_INTENTS_RESULT, requestId, ok: true, items }, "*");
    } catch (error) {
      window.postMessage(
        {
          type: PAGE_FETCH_AI_INTENTS_RESULT,
          requestId,
          ok: false,
          error: String(error?.message ?? error),
        },
        "*",
      );
    }
  });

  window.addEventListener("message", async (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== PAGE_FETCH_LEX_INTENTS) return;

    const requestId = String(data.requestId ?? "").trim();
    if (!requestId) return;

    try {
      const intentsResponse = await origFetch(LEX_INTENTS_URL, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          Authorization: "Bearer null",
        },
      });
      const intentsText = await intentsResponse.text();
      if (!intentsResponse.ok) {
        throw new Error(`HTTP ${intentsResponse.status}: ${intentsText}`);
      }

      const intentsPayload = safeJsonParse(intentsText);
      const { intents, token } = normalizeLexIntentList(intentsPayload);

      const items = await runWithConcurrency(intents, 6, async (intentItem) => {
        const intentName = String(intentItem?.name ?? "").trim();
        if (!intentName) return { ...intentItem, token, samples: [] };

        const samplesResponse = await origFetch(buildLexSamplesUrl(intentName, token), {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            Authorization: "Bearer null",
          },
        });
        const samplesText = await samplesResponse.text();
        if (!samplesResponse.ok) {
          throw new Error(`Falha ao buscar samples de "${intentName}": HTTP ${samplesResponse.status}: ${samplesText}`);
        }
        const samplesPayload = safeJsonParse(samplesText);
        return {
          ...intentItem,
          token,
          samples: normalizeLexSamples(samplesPayload),
        };
      });

      window.postMessage({ type: PAGE_FETCH_LEX_INTENTS_RESULT, requestId, ok: true, items }, "*");
    } catch (error) {
      window.postMessage(
        {
          type: PAGE_FETCH_LEX_INTENTS_RESULT,
          requestId,
          ok: false,
          error: String(error?.message ?? error),
        },
        "*",
      );
    }
  });

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
        latestAuthorization = String(auth);
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
