-- Compact daily ranking archive for Neon.
-- Keeps daily team state only. Player/match/news/trophy data remains in normalized tables
-- and is not duplicated into a full JSON document every day.
-- Run once in Neon SQL Editor. Existing daily dates and team history are preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mvp_daily_archives (
  snapshot_date date PRIMARY KEY,
  snapshot jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Shrink existing full-database snapshots in place to team-only snapshots.
UPDATE public.mvp_daily_archives
SET snapshot = jsonb_build_object(
  'snapshot_date', snapshot_date,
  'captured_at', COALESCE(snapshot->'captured_at', to_jsonb(captured_at)),
  'teams', COALESCE(snapshot->'teams', '[]'::jsonb)
)
WHERE snapshot ? 'players'
   OR snapshot ? 'team_matches'
   OR snapshot ? 'match_player_stats'
   OR snapshot ? 'player_trophies'
   OR snapshot ? 'player_prize_money'
   OR snapshot ? 'tournaments'
   OR snapshot ? 'site_news'
   OR snapshot ? 'editorial_news'
   OR snapshot ? 'team_rank_history';

-- Daily team ranking rows are stored once per team and date.
CREATE TABLE IF NOT EXISTS public.mvp_team_rank_snapshots (
  team_id bigint NOT NULL,
  snapshot_date date NOT NULL,
  rank_position integer NOT NULL CHECK (rank_position > 0),
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS mvp_daily_archives_created_idx
  ON public.mvp_daily_archives (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS mvp_team_rank_snapshots_date_idx
  ON public.mvp_team_rank_snapshots (snapshot_date DESC, team_id);

CREATE OR REPLACE FUNCTION public.mvp_capture_completed_daily_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_day date := (now() AT TIME ZONE 'Europe/Berlin')::date - 1;
  v_snapshot jsonb;
  v_inserted integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mvp_cs2_daily_archive_capture'));

  -- Only archive the immediately preceding day. We cannot truthfully invent
  -- intermediate daily states if the site was offline for several days.
  v_snapshot := jsonb_build_object(
    'snapshot_date', v_day,
    'captured_at', now(),
    'teams', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'tag', t.tag,
          'points', t.points,
          'players', t.players,
          'logo', t.logo,
          'created_at', t.created_at,
          'player_photos', t.player_photos,
          'tournament_wins', t.tournament_wins,
          'is_banned', t.is_banned,
          'ban_reason', t.ban_reason
        )
        ORDER BY t.points DESC, t.id ASC
      )
      FROM public.teams AS t
    ), '[]'::jsonb)
  );

  INSERT INTO public.mvp_daily_archives (snapshot_date, snapshot, captured_at)
  VALUES (v_day, v_snapshot, now())
  ON CONFLICT (snapshot_date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.mvp_team_rank_snapshots (team_id, snapshot_date, rank_position, captured_at)
  SELECT ranked.id, v_day, ranked.rank_position, now()
  FROM (
    SELECT t.id,
           row_number() OVER (ORDER BY t.points DESC, t.id ASC)::integer AS rank_position
    FROM public.teams AS t
  ) AS ranked
  ON CONFLICT (team_id, snapshot_date) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'latest_completed_day', v_day,
    'latest_saved_day', (SELECT max(snapshot_date) FROM public.mvp_daily_archives),
    'rows_inserted', v_inserted,
    'archive_mode', 'teams_only'
  );
END;
$$;

-- Capture the previous day's ranking only before team changes.
-- Changes to players, news, matches, tournaments and trophies no longer
-- trigger a complete archive operation.
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.cs2_players;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.match_player_stats;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.mvp_editorial_news;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.mvp_site_news;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.mvp_tournaments;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.player_prize_money;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.player_trophies;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.team_matches;
DROP TRIGGER IF EXISTS mvp_daily_snapshot_before_change ON public.teams;

CREATE TRIGGER mvp_daily_snapshot_before_change
BEFORE INSERT OR UPDATE OR DELETE ON public.teams
FOR EACH STATEMENT
EXECUTE FUNCTION public.mvp_daily_snapshot_before_change();

COMMIT;

-- After verifying the migration, reclaim space from old, replaced JSONB rows:
-- VACUUM (FULL, ANALYZE) public.mvp_daily_archives;
-- Run VACUUM separately (outside a transaction). It takes an exclusive table lock.
