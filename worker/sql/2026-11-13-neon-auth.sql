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
