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

function getCors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = new Set([
    env.CORS_ORIGIN || "https://mvpcsg2.github.io",
    "https://mvpcsg2.github.io",
    "https://mvp-cs2-ranking.pages.dev",
  ]);
  return allowedOrigins.has(origin)
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
        "vary": "Origin",
      }
    : {};
}

export default {
  async fetch(request, env) {
    const cors = getCors(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return json({ ok: false, error: "Method not allowed" }, 405, cors);
    }

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "mvp-cs2-api" }, 200, cors);
    }

    if (!env.DATABASE_URL) {
      return json({ ok: false, error: "DATABASE_URL secret is missing" }, 500, cors);
    }

    let sql;
    try {
      sql = neon(env.DATABASE_URL);
    } catch (error) {
      console.error("Neon client initialization failed", error);
      return json({ ok: false, error: "Database client initialization failed" }, 500, cors);
    }

    if (url.pathname === "/api/db-check") {
      try {
        const rows = await sql`SELECT 1 AS ok`;
        return json({ ok: Number(rows?.[0]?.ok) === 1, database: "connected" }, 200, cors);
      } catch (error) {
        console.error("Neon connectivity check failed", error);
        return json({ ok: false, error: "Database connection failed" }, 503, cors);
      }
    }

    // Public, read-only ranking data. Never expose profiles or support messages here.
    if (url.pathname === "/api/teams") {
      try {
        const rows = await sql`
          SELECT id, name, tag, points, players, logo, created_at,
                 player_photos, tournament_wins, is_banned, ban_reason
          FROM public.teams
          ORDER BY points DESC, id ASC
        `;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Teams query failed", error);
        return json({ ok: false, error: "Could not load teams" }, 503, cors);
      }
    }

    if (url.pathname === "/api/players") {
      try {
        const rows = await sql`
          SELECT id, nickname, photo_url, created_at, role, team_id,
                 is_banned, ban_reason, faceit_nickname, steam_id64,
                 faceit_profile_url, faceit_elo, faceit_skill_level,
                 faceit_last_synced_at, country_code
          FROM public.cs2_players
          ORDER BY nickname ASC
          LIMIT 2000
        `;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Players query failed", error);
        return json({ ok: false, error: "Could not load players" }, 503, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
