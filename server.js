/**
 * CallBoard — Aircall Proxy Server
 *
 * Special endpoint:
 *   GET /api/calls/all?from=UNIX&to=UNIX
 *   → fetches EVERY page from Aircall and returns { calls: [...all...], total: N }
 *
 * Regular proxy:
 *   GET /api/v1/*  → forwards directly to api.aircall.io/v1/*
 *
 * Usage: node server.js
 * Then open http://localhost:3000
 */

const http  = require("http");
const https = require("https");
const fs    = require("fs");
const path  = require("path");
const url   = require("url");

const PORT         = process.env.PORT || 3000;
const AIRCALL_HOST = "api.aircall.io";

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
};

// ── Fetch one page from Aircall ──────────────────────────────────────────────
function aircallGet(aircallPath, auth) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: AIRCALL_HOST,
      path:     aircallPath,
      method:   "GET",
      headers: {
        "Authorization": auth,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "User-Agent":    "CallBoard-Proxy/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: { error: body } });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// ── Fetch ALL pages for a calls query ───────────────────────────────────────
async function fetchAllCalls(auth, from, to) {
  let allCalls = [];
  let page     = 1;
  let fetched  = 0;

  console.log(`[Server] Starting paginated fetch — from:${from||"none"} to:${to||"none"}`);

  while (true) {
    let qs = `?order=DESC&per_page=50&page=${page}`;
    if (from) qs += `&from=${from}`;
    if (to)   qs += `&to=${to}`;

    const { status, data } = await aircallGet(`/v1/calls${qs}`, auth);

    if (status !== 200) {
      throw new Error(`Aircall returned ${status}: ${data.message || data.error || "unknown error"}`);
    }

    const calls = data.calls || [];
    allCalls = allCalls.concat(calls);
    fetched += calls.length;

    const meta = data.meta || {};
    console.log(`[Server] Page ${page}: got ${calls.length} calls | total so far: ${fetched} | meta:`, JSON.stringify(meta));

    // Aircall's reliable stop signal: next_page_link is null/absent when on last page
    if (!meta.next_page_link || calls.length === 0) {
      console.log(`[Server] ✅ All pages fetched. Total: ${allCalls.length} calls`);
      break;
    }

    page++;
    if (page > 200) {
      console.warn("[Server] Safety cap reached at 200 pages");
      break;
    }
  }

  return allCalls;
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // ── /api/calls/all  →  paginated fetch of every call ──────────────────────
  if (pathname === "/api/calls/all") {
    const auth = req.headers["authorization"];
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing Authorization header" }));
    }

    try {
      const { from, to } = parsed.query;
      const calls = await fetchAllCalls(auth, from || null, to || null);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ calls, total: calls.length }));
    } catch(err) {
      console.error("[Server] fetchAllCalls error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── /api/*  →  plain proxy to Aircall ─────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const auth = req.headers["authorization"];
    if (!auth) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Missing Authorization header" }));
    }

    const aircallPath = pathname.replace(/^\/api/, "") + (parsed.search || "");

    try {
      const { status, data } = await aircallGet(aircallPath, auth);
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch(err) {
      console.error("[Server] Proxy error:", err.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Proxy error: " + err.message }));
    }
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────────
  let filePath    = pathname === "/" ? "/index.html" : pathname;
  filePath        = path.join(__dirname, filePath);
  const ext       = path.extname(filePath);
  const mimeType  = MIME[ext] || "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 Not Found");
    }
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅  CallBoard running at http://localhost:${PORT}`);
  console.log(`    /api/calls/all  — paginated all-calls fetch`);
  console.log(`    /api/v1/*       — direct Aircall proxy\n`);
});
