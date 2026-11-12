import { neon } from "@neondatabase/serverless";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.CORS_ORIGIN || "https://mvpcsg2.github.io";
    const cors = origin === allowedOrigin
      ? {
          "access-control-allow-origin": allowedOrigin,
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
          "vary": "Origin",
        }
      : {};

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "mvp-cs2-api" }, 200, cors);
    }

    // Temporary read-only connectivity check. No user data is returned.
    if (url.pathname === "/api/db-check" && request.method === "GET") {
      if (!env.DATABASE_URL) {
        return json({ ok: false, error: "DATABASE_URL secret is missing" }, 500, cors);
      }
      try {
        const sql = neon(env.DATABASE_URL);
        const rows = await sql`SELECT 1 AS ok`;
        return json({ ok: rows?.[0]?.ok === 1, database: "connected" }, 200, cors);
      } catch (error) {
        console.error("Neon connectivity check failed", error);
        return json({ ok: false, error: "Database connection failed" }, 503, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
