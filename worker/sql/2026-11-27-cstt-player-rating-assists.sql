-- Add assists to per-player match statistics for CSTT Rating.
ALTER TABLE public.match_player_stats
  ADD COLUMN IF NOT EXISTS assists integer NOT NULL DEFAULT 0;
