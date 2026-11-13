-- Compact daily ranking archive for Neon.
-- IMPORTANT: existing legacy snapshots are deliberately preserved because the
-- current website still reads players/matches/trophies from those older JSON documents.
-- New snapshots contain only team ranking state; historical normalized data remains
-- in its source tables. Do not run VACUUM FULL until the UI has been migrated and
-- old snapshots have been safely compacted in a later migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mvp_daily_archives (
  snapshot_date date PRIMARY KEY,
  snapshot jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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

-- Remove every trigger that calls the old full-database snapshot trigger function.
-- This avoids relying on a possibly different trigger name across installations.
DO $$
DECLARE
  trigger_row record;
BEGIN
  FOR trigger_row IN
    SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND pn.nspname = 'public'
      AND p.proname = 'mvp_daily_snapshot_before_change'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
      trigger_row.trigger_name, trigger_row.schema_name, trigger_row.table_name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.mvp_capture_completed_daily_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_day date := (now() AT TIME ZONE 'Europe/Berlin')::date - 1;
  v_snapshot jsonb;
  v_inserted integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mvp_cs2_daily_archive_capture'));

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

COMMIT;

-- Existing JSONB rows are not rewritten by this migration. The current UI still
-- needs their historical player/match/trophy fields. Reclaim disk only after
-- a separate UI migration proves those fields are no longer required.
