-- Neon authentication tables for MVP CS2 Ranking.
-- Run in Neon SQL Editor before deploying the updated Worker.
-- The Worker connects with DATABASE_URL; do not expose this connection string in the browser.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mvp_auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  username varchar(24) NOT NULL,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'moderator', 'admin')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mvp_auth_username_length CHECK (char_length(username) BETWEEN 2 AND 24)
);

CREATE UNIQUE INDEX IF NOT EXISTS mvp_auth_users_email_lower_uidx
  ON public.mvp_auth_users (lower(email));
CREATE INDEX IF NOT EXISTS mvp_auth_users_created_idx
  ON public.mvp_auth_users (created_at DESC);

CREATE TABLE IF NOT EXISTS public.mvp_auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mvp_auth_sessions_user_idx
  ON public.mvp_auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS mvp_auth_sessions_expiry_idx
  ON public.mvp_auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.mvp_auth_email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mvp_auth_email_tokens_user_purpose_idx
  ON public.mvp_auth_email_tokens (user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS mvp_auth_email_tokens_expiry_idx
  ON public.mvp_auth_email_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.mvp_auth_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count >= 0)
);

REVOKE ALL ON public.mvp_auth_users FROM PUBLIC;
REVOKE ALL ON public.mvp_auth_sessions FROM PUBLIC;
REVOKE ALL ON public.mvp_auth_email_tokens FROM PUBLIC;
REVOKE ALL ON public.mvp_auth_rate_limits FROM PUBLIC;

COMMIT;

-- Admin designation is controlled by the Cloudflare Worker variable AUTH_ADMIN_EMAIL.
-- The account receives the admin role only after its email verification token is used.
-- No existing Supabase users or password hashes are deleted or modified by this script.

-- Archive and reset the active season atomically from the Worker.
CREATE OR REPLACE FUNCTION public.mvp_wipe_and_advance_season(p_next_year integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $
DECLARE
  v_current_year integer;
  v_snapshot jsonb;
BEGIN
  SELECT active_year INTO v_current_year
  FROM public.mvp_season_state
  WHERE id = 1
  FOR UPDATE;

  IF v_current_year IS NULL THEN
    RAISE EXCEPTION 'Active season state not found';
  END IF;
  IF p_next_year <> v_current_year + 1 THEN
    RAISE EXCEPTION 'Next year must be exactly one year after active season';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mvp_season_archives WHERE season_year = v_current_year) THEN
    RAISE EXCEPTION 'Season archive already exists for %', v_current_year;
  END IF;

  v_snapshot := jsonb_build_object(
    'season_year', v_current_year,
    'captured_at', now(),
    'teams', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.points DESC, t.id) FROM public.teams t), '[]'::jsonb),
    'players', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.nickname) FROM public.cs2_players p), '[]'::jsonb),
    'team_matches', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.played_at) FROM public.team_matches m), '[]'::jsonb),
    'match_player_stats', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.match_player_stats s), '[]'::jsonb),
    'player_trophies', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.awarded_at) FROM public.player_trophies t), '[]'::jsonb),
    'player_prize_money', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.awarded_at) FROM public.player_prize_money p), '[]'::jsonb)
  );

  INSERT INTO public.mvp_season_archives (season_year, snapshot, note)
  VALUES (v_current_year, v_snapshot, 'Automatic season archive before reset');

  DELETE FROM public.match_player_stats;
  DELETE FROM public.team_matches;
  DELETE FROM public.player_trophies;
  DELETE FROM public.player_prize_money;

  UPDATE public.teams
  SET points = 0,
      tournament_wins = 0;

  UPDATE public.mvp_season_state
  SET active_year = p_next_year,
      updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'archived_year', v_current_year,
    'active_year', p_next_year,
    'success', true
  );
END;
$;

REVOKE ALL ON FUNCTION public.mvp_wipe_and_advance_season(integer) FROM PUBLIC;
