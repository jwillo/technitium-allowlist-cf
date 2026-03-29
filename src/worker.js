const DEFAULT_OBJECT_KEY = "allowlist.txt";
const ABP_HEADER = "[Adblock Plus 2.0]";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(buildUiHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "GET" && url.pathname === "/api/domains") {
      const domains = await loadAllowlist(env);
      return json({ domains });
    }

    if (request.method === "POST" && url.pathname === "/api/domains") {
      return addDomain(request, env);
    }

    if (request.method === "GET" && url.pathname === "/allowlist.txt") {
      const body = await loadAllowlistRaw(env);
      return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};

async function addDomain(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const candidate = typeof payload?.domain === "string" ? payload.domain.trim() : "";
  const normalized = normalizeDomain(candidate);

  if (!normalized) {
    return json({ error: "Invalid domain format" }, 400);
  }

  const domains = await loadAllowlist(env);
  const set = new Set(domains);

  if (set.has(normalized)) {
    return json({ error: "Domain already exists", domain: normalized }, 409);
  }

  set.add(normalized);
  const updated = Array.from(set).sort();
  await saveAllowlist(env, updated);

  return json({ ok: true, domain: normalized, total: updated.length }, 201);
}

async function loadAllowlist(env) {
  const text = await loadAllowlistRaw(env);
  return parseAllowlistDomains(text);
}

async function loadAllowlistRaw(env) {
  const object = await env.ALLOWLIST_BUCKET.get(getObjectKey(env));
  if (!object) {
    return buildAbpAllowlist([]);
  }

  return await object.text();
}

function parseAllowlistDomains(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!") && line !== ABP_HEADER.toLowerCase())
    .map((line) => parseDomainFromRule(line))
    .filter((domain) => domain !== null);
}

async function saveAllowlist(env, domains) {
  const body = buildAbpAllowlist(domains);
  await env.ALLOWLIST_BUCKET.put(getObjectKey(env), body, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
}

function buildAbpAllowlist(domains) {
  const lines = [
    ABP_HEADER,
    "! Technitium DNS allowlist exceptions",
    "! Format: @@||domain^",
    "",
    ...domains.map((domain) => toAbpExceptionRule(domain)),
  ];

  return lines.join("\n") + "\n";
}

function toAbpExceptionRule(domain) {
  return `@@||${domain}^`;
}

function parseDomainFromRule(line) {
  if (line.startsWith("@@||")) {
    const body = line.slice(4);
    const end = body.indexOf("^");
    const candidate = end === -1 ? body : body.slice(0, end);
    const normalized = normalizeDomain(candidate);
    return normalized || null;
  }

  const normalized = normalizeDomain(line);
  return normalized || null;
}

function getObjectKey(env) {
  return env.ALLOWLIST_OBJECT_KEY || DEFAULT_OBJECT_KEY;
}

function normalizeDomain(value) {
  const lower = value.toLowerCase().replace(/^\.+|\.+$/g, "");
  const pattern = /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  if (!pattern.test(lower)) {
    return null;
  }
  return lower;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function buildUiHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Technitium Allowlist</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap");

      :root {
        --bg-deep: #0c1216;
        --bg-mid: #111f26;
        --card: rgba(255, 255, 255, 0.09);
        --card-border: rgba(255, 255, 255, 0.16);
        --text: #eaf2ee;
        --muted: #adc0b8;
        --accent: #39d18f;
        --accent-2: #57f2c7;
        --error: #ff896b;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at 10% 20%, #1e3c35 0%, transparent 40%),
          radial-gradient(circle at 90% 10%, #1e4a5b 0%, transparent 35%),
          linear-gradient(135deg, var(--bg-deep), var(--bg-mid));
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .panel {
        width: min(900px, 100%);
        backdrop-filter: blur(14px);
        background: var(--card);
        border: 1px solid var(--card-border);
        border-radius: 20px;
        padding: 1.25rem;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        animation: rise 0.5s ease-out;
      }

      @keyframes rise {
        from { transform: translateY(12px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      h1 {
        margin: 0 0 0.4rem;
        font-size: clamp(1.4rem, 2vw, 2rem);
      }

      .meta {
        margin: 0 0 1rem;
        color: var(--muted);
      }

      form {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      input {
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(0, 0, 0, 0.24);
        color: var(--text);
        padding: 0.8rem 0.95rem;
        font: inherit;
      }

      input::placeholder { color: #9ab0a7; }

      button {
        border: 0;
        border-radius: 12px;
        padding: 0.8rem 1rem;
        font: inherit;
        font-weight: 700;
        color: #032f1f;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        cursor: pointer;
      }

      #status {
        min-height: 1.4rem;
        margin-bottom: 0.8rem;
        color: var(--muted);
      }

      #status.error { color: var(--error); }
      #status.ok { color: var(--accent-2); }

      .list {
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.2);
        max-height: 52vh;
        overflow: auto;
      }

      .row {
        display: flex;
        justify-content: space-between;
        padding: 0.72rem 0.9rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-family: "IBM Plex Mono", monospace;
        font-size: 0.92rem;
      }

      .row:last-child { border-bottom: 0; }
      .empty { padding: 0.9rem; color: var(--muted); }

      @media (max-width: 640px) {
        form { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>Technitium DNS Allowlist</h1>
      <p class="meta">Backed by R2 object <code>/allowlist.txt</code> in Adblock Plus format using exception rules like <code>@@||example.com^</code>.</p>
      <form id="add-form">
        <input id="domain" name="domain" placeholder="example.com or *.trusted.org" required />
        <button type="submit">Add Domain</button>
      </form>
      <div id="status"></div>
      <section class="list" id="list"></section>
    </main>

    <script>
      const form = document.getElementById("add-form");
      const input = document.getElementById("domain");
      const list = document.getElementById("list");
      const statusEl = document.getElementById("status");

      function setStatus(msg, type = "") {
        statusEl.textContent = msg;
        statusEl.className = type;
      }

      function renderDomains(domains) {
        if (!domains.length) {
          list.innerHTML = '<div class="empty">No domains yet.</div>';
          return;
        }
        list.innerHTML = domains
          .map((domain, i) => `<div class="row"><span>${domain}</span><span>#${i + 1}</span></div>`)
          .join("");
      }

      async function loadDomains() {
        const res = await fetch("/api/domains");
        const data = await res.json();
        renderDomains(data.domains || []);
        setStatus(`Loaded ${data.domains?.length || 0} domains.`, "");
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const domain = input.value.trim();
        if (!domain) return;

        setStatus("Adding domain...", "");

        const res = await fetch("/api/domains", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus(data.error || "Unable to add domain", "error");
          return;
        }

        input.value = "";
        setStatus(`Added ${data.domain}`, "ok");
        await loadDomains();
      });

      loadDomains().catch(() => setStatus("Failed to load allowlist", "error"));
    </script>
  </body>
</html>`;
}
