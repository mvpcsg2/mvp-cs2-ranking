-- CSTT tournament company co-owners.
-- Run once in Neon SQL Editor after 2026-11-13-neon-auth.sql and 2026-11-15-cstt-tournament-platform.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mvp_tournament_organizer_owners (
  organizer_id BIGINT NOT NULL REFERENCES public.mvp_tournament_organizers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.mvp_auth_users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.mvp_auth_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organizer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mvp_tournament_organizer_owners_user
  ON public.mvp_tournament_organizer_owners (user_id, organizer_id);

-- Preserve access for accounts that originally created existing companies.
INSERT INTO public.mvp_tournament_organizer_owners (organizer_id, user_id, assigned_by)
SELECT id, created_by, created_by
FROM public.mvp_tournament_organizers
WHERE created_by IS NOT NULL
ON CONFLICT (organizer_id, user_id) DO NOTHING;

REVOKE ALL ON public.mvp_tournament_organizer_owners FROM PUBLIC;

COMMIT;
