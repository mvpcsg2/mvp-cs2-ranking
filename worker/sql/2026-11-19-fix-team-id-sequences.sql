-- Repair PostgreSQL identity/serial sequences after imported or manually assigned IDs.
-- Safe to run repeatedly. Existing team/player rows and IDs are never changed.
BEGIN;

DO $repair$
DECLARE
  v_table text;
  v_sequence text;
  v_max_id bigint;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['teams','cs2_players'] LOOP
    v_sequence := pg_get_serial_sequence('public.' || v_table, 'id');
    IF v_sequence IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM public.%I', v_table)
        INTO v_max_id;

      IF v_max_id > 0 THEN
        PERFORM setval(v_sequence::regclass, v_max_id, true);
      ELSE
        PERFORM setval(v_sequence::regclass, 1, false);
      END IF;
    END IF;
  END LOOP;
END;
$repair$;

COMMIT;

-- Verification: these statements should return the sequence attached to each ID.
SELECT
  'teams' AS table_name,
  (SELECT MAX(id) FROM public.teams) AS max_existing_id,
  pg_get_serial_sequence('public.teams', 'id') AS id_sequence
UNION ALL
SELECT
  'cs2_players',
  (SELECT MAX(id) FROM public.cs2_players),
  pg_get_serial_sequence('public.cs2_players', 'id');
