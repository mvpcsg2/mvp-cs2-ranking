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


    // Public read-only content endpoints. Private account and support tables are deliberately excluded.
    if (url.pathname === "/api/site-news") {
      try {
        const rows = await sql`SELECT id, event_type, player_id, player_name, team_id, team_name, from_team_id, from_team_name, to_team_id, to_team_name, reason, created_at, updated_at, player_photo_url, from_team_logo, to_team_logo, team_logo, team_snapshot_id, from_team_snapshot_id, to_team_snapshot_id FROM public.mvp_site_news ORDER BY created_at DESC LIMIT 500`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Site news query failed", error);
        return json({ ok: false, error: "Could not load site news" }, 503, cors);
      }
    }

    if (url.pathname === "/api/editorial-news") {
      try {
        const rows = await sql`SELECT id, title, category, summary, body, image_url, external_url, author_name, published, created_at, updated_at FROM public.mvp_editorial_news WHERE published = true ORDER BY created_at DESC LIMIT 300`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Editorial news query failed", error);
        return json({ ok: false, error: "Could not load editorial news" }, 503, cors);
      }
    }

    if (url.pathname === "/api/team-matches") {
      try {
        const teamId = url.searchParams.get("team_id");
        const rows = teamId
          ? await sql`SELECT * FROM public.team_matches WHERE team_id = ${teamId}::bigint OR opponent_team_id = ${teamId}::bigint ORDER BY played_at DESC LIMIT 500`
          : await sql`SELECT * FROM public.team_matches ORDER BY played_at DESC LIMIT 1000`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Team matches query failed", error);
        return json({ ok: false, error: "Could not load team matches" }, 503, cors);
      }
    }

    if (url.pathname === "/api/tournaments") {
      try {
        const rows = await sql`SELECT id, name, best_of, status, is_active, bracket_data, created_at, updated_at FROM public.mvp_tournaments ORDER BY updated_at DESC LIMIT 100`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Tournaments query failed", error);
        return json({ ok: false, error: "Could not load tournaments" }, 503, cors);
      }
    }

    if (url.pathname === "/api/season-state") {
      try {
        const rows = await sql`SELECT active_year, updated_at FROM public.mvp_season_state WHERE id = 1 LIMIT 1`;
        return json({ ok: true, data: rows[0] || null }, 200, cors);
      } catch (error) {
        console.error("Season state query failed", error);
        return json({ ok: false, error: "Could not load season state" }, 503, cors);
      }
    }

    if (url.pathname === "/api/season-archives") {
      try {
        const rows = await sql`SELECT season_year, created_at, note FROM public.mvp_season_archives ORDER BY season_year ASC LIMIT 100`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Season archives query failed", error);
        return json({ ok: false, error: "Could not load season archives" }, 503, cors);
      }
    }

    if (url.pathname === "/api/season-archive") {
      const year = Number(url.searchParams.get("year"));
      if (!Number.isInteger(year) || year < 2000 || year > 2200) {
        return json({ ok: false, error: "A valid year is required" }, 400, cors);
      }
      try {
        const rows = await sql`SELECT snapshot FROM public.mvp_season_archives WHERE season_year = ${year} LIMIT 1`;
        return json({ ok: true, data: rows[0] || null }, 200, cors);
      } catch (error) {
        console.error("Season archive query failed", error);
        return json({ ok: false, error: "Could not load season archive" }, 503, cors);
      }
    }

    if (url.pathname === "/api/daily-archive-dates") {
      try {
        const rows = await sql`SELECT snapshot_date FROM public.mvp_daily_archives ORDER BY snapshot_date ASC LIMIT 5000`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Daily archive dates query failed", error);
        return json({ ok: false, error: "Could not load daily archive dates" }, 503, cors);
      }
    }

    if (url.pathname === "/api/daily-archive") {
      const date = url.searchParams.get("date");
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ ok: false, error: "A valid date is required" }, 400, cors);
      }
      try {
        const rows = await sql`SELECT snapshot FROM public.mvp_daily_archives WHERE snapshot_date = ${date}::date LIMIT 1`;
        return json({ ok: true, data: rows[0] || null }, 200, cors);
      } catch (error) {
        console.error("Daily archive query failed", error);
        return json({ ok: false, error: "Could not load daily archive" }, 503, cors);
      }
    }

    if (url.pathname === "/api/site-brand") {
      try {
        const rows = await sql`SELECT setting_key, setting_value FROM public.mvp_site_settings WHERE setting_key IN ('site_logo_url', 'site_background_url')`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Site brand query failed", error);
        return json({ ok: false, error: "Could not load site branding" }, 503, cors);
      }
    }

    if (url.pathname === "/api/trophy-catalog") {
      try {
        const rows = await sql`SELECT id, name, description, image_url, created_at FROM public.mvp_trophy_catalog ORDER BY created_at DESC LIMIT 100`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Trophy catalog query failed", error);
        return json({ ok: false, error: "Could not load trophy catalog" }, 503, cors);
      }
    }

    if (url.pathname === "/api/player-trophies") {
      const playerId = url.searchParams.get("player_id");
      if (!playerId || !/^\d+$/.test(playerId)) return json({ ok: false, error: "A valid player_id is required" }, 400, cors);
      try {
        const rows = await sql`SELECT id, player_id, team_id, place, tournament_name, awarded_at, custom_trophy_name, custom_trophy_image_url, custom_trophy_description FROM public.player_trophies WHERE player_id = ${playerId}::bigint ORDER BY awarded_at DESC LIMIT 300`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Player trophies query failed", error);
        return json({ ok: false, error: "Could not load player trophies" }, 503, cors);
      }
    }

    if (url.pathname === "/api/player-prize-money") {
      const playerId = url.searchParams.get("player_id");
      if (!playerId || !/^\d+$/.test(playerId)) return json({ ok: false, error: "A valid player_id is required" }, 400, cors);
      try {
        const rows = await sql`SELECT id, player_id, team_id, tournament_name, amount, currency, awarded_at FROM public.player_prize_money WHERE player_id = ${playerId}::bigint ORDER BY awarded_at DESC LIMIT 300`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Player prize money query failed", error);
        return json({ ok: false, error: "Could not load player prize money" }, 503, cors);
      }
    }


    if (url.pathname === "/api/team-rank-history") {
      try {
        const rows = await sql`SELECT team_id, previous_rank, current_rank, movement_delta, changed_at FROM public.mvp_team_rank_history WHERE changed_at >= now() - interval '3 days' ORDER BY changed_at DESC LIMIT 1000`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Team rank history query failed", error);
        return json({ ok: false, error: "Could not load team rank history" }, 503, cors);
      }
    }

    if (url.pathname === "/api/player-match-history") {
      const playerId = url.searchParams.get("player_id");
      if (!playerId || !/^\d+$/.test(playerId)) return json({ ok: false, error: "A valid player_id is required" }, 400, cors);
      try {
        const rows = await sql`
          SELECT s.id, s.match_id, s.player_id, s.team_id, s.kills, s.deaths, s.kd, s.created_at,
                 m.opponent_name, m.opponent_team_id, m.team_score, m.opponent_score,
                 m.map_name, m.played_at, m.match_status, m.tournament_name
          FROM public.match_player_stats s
          LEFT JOIN public.team_matches m ON m.id = s.match_id
          WHERE s.player_id = ${playerId}::bigint
          ORDER BY m.played_at DESC NULLS LAST, s.created_at DESC
          LIMIT 500
        `;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Player match history query failed", error);
        return json({ ok: false, error: "Could not load player match history" }, 503, cors);
      }
    }


    if (url.pathname === "/api/matches") {
      try {
        const rows = await sql`SELECT id, team_id, opponent_team_id, opponent_name, team_score, opponent_score, map_name, played_at, match_status, tournament_name FROM public.team_matches ORDER BY played_at ASC LIMIT 500`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Matches query failed", error);
        return json({ ok: false, error: "Could not load matches" }, 503, cors);
      }
    }

    if (url.pathname === "/api/tournaments") {
      try {
        const rows = await sql`SELECT id, name, best_of, status, is_active, bracket_data, updated_at FROM public.mvp_tournaments ORDER BY updated_at DESC LIMIT 100`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Tournaments query failed", error);
        return json({ ok: false, error: "Could not load tournaments" }, 503, cors);
      }
    }

    if (url.pathname === "/api/streams") {
      try {
        const rows = await sql`SELECT id, title, youtube_url, created_at FROM public.cs2_streams ORDER BY created_at DESC LIMIT 100`;
        return json({ ok: true, data: rows }, 200, cors);
      } catch (error) {
        console.error("Streams query failed", error);
        return json({ ok: false, error: "Could not load streams" }, 503, cors);
      }
    }

    if (url.pathname === "/api/live-matches") {
      try {
        const matches = await sql`SELECT id, server_key, map_name, status, round_number, score_t, score_ct, started_at, updated_at, finished_at FROM public.mvp_live_matches WHERE status IN ('live','finished') ORDER BY started_at DESC LIMIT 12`;
        if (!matches.length) return json({ ok: true, data: { matches: [], players: [], events: [] } }, 200, cors);
        const ids = matches.map(row => row.id);
        const players = await sql`SELECT match_id, steam_id, player_name, team_num, kills, deaths, assists FROM public.mvp_live_players WHERE match_id = ANY(${ids}) ORDER BY kills DESC`;
        const events = await sql`SELECT match_id, event_type, round_number, payload, created_at FROM public.mvp_live_events WHERE match_id = ANY(${ids}) ORDER BY created_at DESC LIMIT 100`;
        return json({ ok: true, data: { matches, players, events } }, 200, cors);
      } catch (error) {
        console.error("Live matches query failed", error);
        return json({ ok: false, error: "Could not load live matches" }, 503, cors);
      }
    }

    return json({ ok: false, error: "Not found" }, 404, cors);
  },
};
