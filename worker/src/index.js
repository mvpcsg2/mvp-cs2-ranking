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

    // Public aggregate used for player ranking badges; raw match rows stay server-side.
    if (url.pathname === "/api/player-top-positions") {
      try {
        const rows = await sql`
          WITH active_players AS (
            SELECT id, nickname
            FROM public.cs2_players
            WHERE COALESCE(is_banned, false) = false
            ORDER BY nickname ASC
            LIMIT 2000
          ),
          aggregates AS (
            SELECT s.player_id,
                   AVG(COALESCE(s.kd, 0)) AS average,
                   SUM(COALESCE(s.kills, 0)) AS kills,
                   COUNT(*)::int AS matches
            FROM public.match_player_stats s
            INNER JOIN active_players p ON p.id = s.player_id
            GROUP BY s.player_id
          )
          SELECT p.id::text AS id, p.nickname,
                 COALESCE(a.average, 0)::float8 AS average,
                 COALESCE(a.kills, 0)::int AS kills,
                 COALESCE(a.matches, 0)::int AS matches,
                 ROW_NUMBER() OVER (
                   ORDER BY COALESCE(a.average, 0) DESC,
                            COALESCE(a.kills, 0) DESC,
                            p.nickname ASC
                 )::int AS position
          FROM active_players p
          LEFT JOIN aggregates a ON a.player_id = p.id
          ORDER BY position ASC
        `;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Player top positions query failed", error);
        return json({ ok: false, error: "Could not load player rankings" }, 503, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
