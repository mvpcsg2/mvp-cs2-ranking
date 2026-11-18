-- Minimal schema required by admin_get_team_captain/admin_assign_team_captain.
-- Safe to run more than once; preserves existing assignments.
BEGIN;
CREATE TABLE IF NOT EXISTS public.mvp_team_captains (
  team_id bigint PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.mvp_auth_users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
