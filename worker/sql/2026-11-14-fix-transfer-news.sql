-- Install/repair automatic player roster transfer events for the Neon-backed news rail.
-- Safe to run repeatedly. Existing news rows are preserved.
-- A move is represented by:
--   NULL -> team: player_joined (or player_rejoined if the player has history)
--   team -> NULL: player_released
--   team A -> team B: player_transfer
--   release followed by joining another team shortly after: the release row becomes a transfer.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mvp_site_news (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  player_id bigint,
  player_name text,
  player_photo_url text,
  team_id bigint,
  team_name text,
  team_logo text,
  from_team_id bigint,
  from_team_name text,
  from_team_logo text,
  to_team_id bigint,
  to_team_name text,
  to_team_logo text,
  team_snapshot_id bigint,
  from_team_snapshot_id bigint,
  to_team_snapshot_id bigint,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS player_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS player_name text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS player_photo_url text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS team_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS team_logo text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS from_team_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS from_team_name text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS from_team_logo text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS to_team_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS to_team_name text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS to_team_logo text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS team_snapshot_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS from_team_snapshot_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS to_team_snapshot_id bigint;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mvp_site_news ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- An older copied table may have a required id column without a default.
-- Repair automatic ID generation without changing any existing rows.
DO $migration$
DECLARE
  v_data_type text;
  v_identity text;
  v_default text;
  v_sequence regclass;
BEGIN
  SELECT data_type, is_identity, column_default
    INTO v_data_type, v_identity, v_default
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='mvp_site_news'
    AND column_name='id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.mvp_site_news.id does not exist';
  END IF;

  IF v_identity='YES' OR v_default IS NOT NULL THEN
    NULL;
  ELSIF v_data_type IN ('smallint','integer','bigint') THEN
    v_sequence := pg_get_serial_sequence('public.mvp_site_news','id')::regclass;
    IF v_sequence IS NULL THEN
      CREATE SEQUENCE IF NOT EXISTS public.mvp_site_news_id_seq;
      v_sequence := 'public.mvp_site_news_id_seq'::regclass;
    END IF;

    EXECUTE format('ALTER SEQUENCE %s OWNED BY public.mvp_site_news.id',v_sequence);
    PERFORM setval(
      v_sequence,
      GREATEST(COALESCE((SELECT MAX(id)::bigint FROM public.mvp_site_news),0)+1,1),
      false
    );
    EXECUTE format(
      'ALTER TABLE public.mvp_site_news ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
      v_sequence::text
    );
  ELSIF v_data_type='uuid' THEN
    ALTER TABLE public.mvp_site_news ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ELSE
    RAISE EXCEPTION 'Unsupported public.mvp_site_news.id type: %',v_data_type;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS mvp_site_news_created_at_idx
  ON public.mvp_site_news(created_at DESC);
CREATE INDEX IF NOT EXISTS mvp_site_news_player_created_at_idx
  ON public.mvp_site_news(player_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.mvp_record_player_roster_news()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $mvp_fn$
DECLARE
  v_old_team_name text;
  v_old_team_logo text;
  v_new_team_name text;
  v_new_team_logo text;
  v_release_event_id text;
  v_release_from_team_id text;
  v_had_history boolean := false;
  v_event_type text;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.team_id IS NULL THEN RETURN NEW; END IF;

    SELECT t.name,t.logo
      INTO v_new_team_name,v_new_team_logo
    FROM public.teams t
    WHERE t.id=NEW.team_id;

    SELECT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id
        AND n.event_type IN ('player_joined','player_transfer','player_rejoined')
    ) INTO v_had_history;

    v_event_type := CASE WHEN v_had_history THEN 'player_rejoined' ELSE 'player_joined' END;

    -- Avoid a duplicate if an older installation already has a roster trigger.
    IF NOT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id
        AND n.event_type IN ('player_joined','player_rejoined','player_transfer')
        AND n.to_team_id=NEW.team_id
        AND n.created_at>now()-interval '10 seconds'
    ) THEN
      INSERT INTO public.mvp_site_news(
        event_type,player_id,player_name,player_photo_url,
        team_id,team_name,team_logo,
        to_team_id,to_team_name,to_team_logo,created_at,updated_at
      ) VALUES(
        v_event_type,NEW.id,NEW.nickname,NEW.photo_url,
        NEW.team_id,v_new_team_name,v_new_team_logo,
        NEW.team_id,v_new_team_name,v_new_team_logo,now(),now()
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.team_id IS NOT DISTINCT FROM OLD.team_id THEN
    RETURN NEW;
  END IF;

  IF OLD.team_id IS NOT NULL THEN
    SELECT t.name,t.logo INTO v_old_team_name,v_old_team_logo
    FROM public.teams t WHERE t.id=OLD.team_id;
  END IF;

  IF NEW.team_id IS NOT NULL THEN
    SELECT t.name,t.logo INTO v_new_team_name,v_new_team_logo
    FROM public.teams t WHERE t.id=NEW.team_id;
  END IF;

  -- Direct team A -> team B update.
  IF OLD.team_id IS NOT NULL AND NEW.team_id IS NOT NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id AND n.event_type='player_transfer'
        AND n.from_team_id=OLD.team_id AND n.to_team_id=NEW.team_id
        AND n.created_at>now()-interval '10 seconds'
    ) THEN
      INSERT INTO public.mvp_site_news(
        event_type,player_id,player_name,player_photo_url,
        team_id,team_name,team_logo,
        from_team_id,from_team_name,from_team_logo,
        to_team_id,to_team_name,to_team_logo,created_at,updated_at
      ) VALUES(
        'player_transfer',NEW.id,NEW.nickname,NEW.photo_url,
        NEW.team_id,v_new_team_name,v_new_team_logo,
        OLD.team_id,v_old_team_name,v_old_team_logo,
        NEW.team_id,v_new_team_name,v_new_team_logo,now(),now()
      );
    END IF;
    RETURN NEW;
  END IF;

  -- Team -> no team: remember a release. A subsequent roster save can turn it
  -- into one clean transfer event rather than two unrelated news items.
  IF OLD.team_id IS NOT NULL AND NEW.team_id IS NULL THEN
    IF NOT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id AND n.event_type='player_released'
        AND n.from_team_id=OLD.team_id
        AND n.created_at>now()-interval '10 seconds'
    ) THEN
      INSERT INTO public.mvp_site_news(
        event_type,player_id,player_name,player_photo_url,
        team_id,team_name,team_logo,
        from_team_id,from_team_name,from_team_logo,created_at,updated_at
      ) VALUES(
        'player_released',NEW.id,NEW.nickname,NEW.photo_url,
        OLD.team_id,v_old_team_name,v_old_team_logo,
        OLD.team_id,v_old_team_name,v_old_team_logo,now(),now()
      );
    END IF;
    RETURN NEW;
  END IF;

  -- No team -> team: upgrade a very recent release to a transfer/rejoin.
  IF OLD.team_id IS NULL AND NEW.team_id IS NOT NULL THEN
    SELECT n.id::text,COALESCE(n.from_team_id,n.team_id)::text
      INTO v_release_event_id,v_release_from_team_id
    FROM public.mvp_site_news n
    WHERE n.player_id=NEW.id
      AND n.event_type='player_released'
      AND n.created_at>now()-interval '30 minutes'
    ORDER BY n.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_release_event_id IS NOT NULL THEN
      v_event_type := CASE
        WHEN v_release_from_team_id=NEW.team_id::text THEN 'player_rejoined'
        ELSE 'player_transfer'
      END;
      UPDATE public.mvp_site_news
      SET event_type=v_event_type,
          player_name=NEW.nickname,
          player_photo_url=NEW.photo_url,
          team_id=NEW.team_id,
          team_name=v_new_team_name,
          team_logo=v_new_team_logo,
          to_team_id=NEW.team_id,
          to_team_name=v_new_team_name,
          to_team_logo=v_new_team_logo,
          created_at=now(),
          updated_at=now()
      WHERE id::text=v_release_event_id;
      RETURN NEW;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id
        AND n.event_type IN ('player_joined','player_transfer','player_rejoined')
    ) INTO v_had_history;

    v_event_type := CASE WHEN v_had_history THEN 'player_rejoined' ELSE 'player_joined' END;
    IF NOT EXISTS(
      SELECT 1 FROM public.mvp_site_news n
      WHERE n.player_id=NEW.id
        AND n.event_type IN ('player_joined','player_rejoined','player_transfer')
        AND n.to_team_id=NEW.team_id
        AND n.created_at>now()-interval '10 seconds'
    ) THEN
      INSERT INTO public.mvp_site_news(
        event_type,player_id,player_name,player_photo_url,
        team_id,team_name,team_logo,
        to_team_id,to_team_name,to_team_logo,created_at,updated_at
      ) VALUES(
        v_event_type,NEW.id,NEW.nickname,NEW.photo_url,
        NEW.team_id,v_new_team_name,v_new_team_logo,
        NEW.team_id,v_new_team_name,v_new_team_logo,now(),now()
      );
    END IF;
  END IF;

  RETURN NEW;
END
$mvp_fn$;

DROP TRIGGER IF EXISTS mvp_site_news_player_roster_event_trigger ON public.cs2_players;
CREATE TRIGGER mvp_site_news_player_roster_event_trigger
AFTER INSERT OR UPDATE OF team_id ON public.cs2_players
FOR EACH ROW
EXECUTE FUNCTION public.mvp_record_player_roster_news();

COMMIT;
