-- Repair automatic IDs for tournament trophy awards and player records.
-- Safe to run repeatedly in the PostgreSQL database used by the site.
-- Existing rows are preserved; integer sequences are positioned after MAX(id).

BEGIN;

LOCK TABLE public.player_trophies IN ACCESS EXCLUSIVE MODE;

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
  WHERE table_schema = 'public'
    AND table_name = 'player_trophies'
    AND column_name = 'id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.player_trophies.id does not exist';
  END IF;

  -- Identity columns already generate IDs automatically.
  IF v_identity = 'YES' OR v_default IS NOT NULL THEN
    RAISE NOTICE 'player_trophies.id already has automatic generation; no change needed';
    RETURN;
  END IF;

  IF v_data_type IN ('smallint', 'integer', 'bigint') THEN
    v_sequence := pg_get_serial_sequence('public.player_trophies', 'id')::regclass;

    IF v_sequence IS NULL THEN
      CREATE SEQUENCE IF NOT EXISTS public.player_trophies_id_seq;
      v_sequence := 'public.player_trophies_id_seq'::regclass;
    END IF;

    EXECUTE format(
      'ALTER SEQUENCE %s OWNED BY public.player_trophies.id',
      v_sequence
    );

    -- The next inserted row receives MAX(id) + 1, including on a populated table.
    PERFORM setval(
      v_sequence,
      GREATEST(
        COALESCE((SELECT MAX(id)::bigint FROM public.player_trophies), 0) + 1,
        1
      ),
      false
    );

    EXECUTE format(
      'ALTER TABLE public.player_trophies ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
      v_sequence::text
    );

  ELSIF v_data_type = 'uuid' THEN
    ALTER TABLE public.player_trophies
      ALTER COLUMN id SET DEFAULT gen_random_uuid();

  ELSE
    RAISE EXCEPTION
      'Unsupported player_trophies.id type: %. Set an appropriate ID default manually.',
      v_data_type;
  END IF;
END
$migration$;


-- The team-save function creates new cs2_players rows without supplying id.
-- This default lets PostgreSQL allocate the next ID automatically.
LOCK TABLE public.cs2_players IN ACCESS EXCLUSIVE MODE;

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
  WHERE table_schema = 'public'
    AND table_name = 'cs2_players'
    AND column_name = 'id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.cs2_players.id does not exist';
  END IF;

  IF v_identity = 'YES' OR v_default IS NOT NULL THEN
    RAISE NOTICE 'cs2_players.id already has automatic generation; no change needed';
    RETURN;
  END IF;

  IF v_data_type IN ('smallint', 'integer', 'bigint') THEN
    v_sequence := pg_get_serial_sequence('public.cs2_players', 'id')::regclass;

    IF v_sequence IS NULL THEN
      CREATE SEQUENCE IF NOT EXISTS public.cs2_players_id_seq;
      v_sequence := 'public.cs2_players_id_seq'::regclass;
    END IF;

    EXECUTE format(
      'ALTER SEQUENCE %s OWNED BY public.cs2_players.id',
      v_sequence
    );

    PERFORM setval(
      v_sequence,
      GREATEST(
        COALESCE((SELECT MAX(id)::bigint FROM public.cs2_players), 0) + 1,
        1
      ),
      false
    );

    EXECUTE format(
      'ALTER TABLE public.cs2_players ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
      v_sequence::text
    );

  ELSIF v_data_type = 'uuid' THEN
    ALTER TABLE public.cs2_players
      ALTER COLUMN id SET DEFAULT gen_random_uuid();

  ELSE
    RAISE EXCEPTION
      'Unsupported cs2_players.id type: %. Set an appropriate ID default manually.',
      v_data_type;
  END IF;
END
$migration$;



-- Match statistics are inserted without an explicit id by the match editor.
-- Restore automatic ID generation so per-player match rows can be saved.
LOCK TABLE public.match_player_stats IN ACCESS EXCLUSIVE MODE;

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
  WHERE table_schema = 'public'
    AND table_name = 'match_player_stats'
    AND column_name = 'id';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.match_player_stats.id does not exist';
  END IF;

  IF v_identity = 'YES' OR v_default IS NOT NULL THEN
    RAISE NOTICE 'match_player_stats.id already has automatic generation; no change needed';
    RETURN;
  END IF;

  IF v_data_type IN ('smallint', 'integer', 'bigint') THEN
    v_sequence := pg_get_serial_sequence('public.match_player_stats', 'id')::regclass;

    IF v_sequence IS NULL THEN
      CREATE SEQUENCE IF NOT EXISTS public.match_player_stats_id_seq;
      v_sequence := 'public.match_player_stats_id_seq'::regclass;
    END IF;

    EXECUTE format(
      'ALTER SEQUENCE %s OWNED BY public.match_player_stats.id',
      v_sequence
    );

    PERFORM setval(
      v_sequence,
      GREATEST(
        COALESCE((SELECT MAX(id)::bigint FROM public.match_player_stats), 0) + 1,
        1
      ),
      false
    );

    EXECUTE format(
      'ALTER TABLE public.match_player_stats ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
      v_sequence::text
    );

  ELSIF v_data_type = 'uuid' THEN
    ALTER TABLE public.match_player_stats
      ALTER COLUMN id SET DEFAULT gen_random_uuid();

  ELSE
    RAISE EXCEPTION
      'Unsupported match_player_stats.id type: %. Set an appropriate ID default manually.',
      v_data_type;
  END IF;
END
$migration$;

COMMIT;
