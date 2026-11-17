-- Apply after 2026-11-13-neon-auth.sql. Does not modify existing rating tables.
CREATE TABLE IF NOT EXISTS public.mvp_myhud_live (
  user_id uuid PRIMARY KEY REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.mvp_myhud_result_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  client_match_id varchar(128) NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.mvp_auth_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  UNIQUE (user_id,client_match_id)
);
CREATE INDEX IF NOT EXISTS mvp_myhud_submissions_review_idx ON public.mvp_myhud_result_submissions (status,created_at DESC);
