-- HLTV-based team tiering support.
-- Empty hltv_rank means the team is currently unranked and belongs to Tier 3.
BEGIN;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS hltv_rank integer;

DO $mvp$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname='teams_hltv_rank_positive_check'
      AND conrelid='public.teams'::regclass
  ) THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_hltv_rank_positive_check
      CHECK (hltv_rank IS NULL OR hltv_rank BETWEEN 1 AND 9999);
  END IF;
END;
$mvp$;

COMMENT ON COLUMN public.teams.hltv_rank IS
  'Manually maintained position in the current HLTV world team ranking. Used to derive site tiers: 1-10, 11-40, and 41+/unranked.';

COMMIT;
