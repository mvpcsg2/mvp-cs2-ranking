-- Read-only audit: find any remaining public object URLs that still point to Supabase Storage.
-- Run in Neon SQL Editor after the Neon tables have been migrated.
-- This does not contact Supabase and does not change any records.

SELECT source, COUNT(*)::bigint AS remaining_urls
FROM (
  SELECT 'teams.logo' AS source, logo AS value FROM public.teams
  UNION ALL
  SELECT 'teams.player_photos', player_photos::text FROM public.teams
  UNION ALL
  SELECT 'cs2_players.photo_url', photo_url FROM public.cs2_players
  UNION ALL
  SELECT 'mvp_site_settings.setting_value', setting_value FROM public.mvp_site_settings
  UNION ALL
  SELECT 'mvp_trophy_catalog.image_url', image_url FROM public.mvp_trophy_catalog
  UNION ALL
  SELECT 'player_trophies.custom_trophy_image_url', custom_trophy_image_url FROM public.player_trophies
  UNION ALL
  SELECT 'mvp_editorial_news.image_url', image_url FROM public.mvp_editorial_news
  UNION ALL
  SELECT 'mvp_site_news.player_photo_url', player_photo_url FROM public.mvp_site_news
  UNION ALL
  SELECT 'mvp_site_news.from_team_logo', from_team_logo FROM public.mvp_site_news
  UNION ALL
  SELECT 'mvp_site_news.to_team_logo', to_team_logo FROM public.mvp_site_news
  UNION ALL
  SELECT 'mvp_site_news.team_logo', team_logo FROM public.mvp_site_news
  UNION ALL
  SELECT 'mvp_tournaments.bracket_data', bracket_data::text FROM public.mvp_tournaments
  UNION ALL
  SELECT 'mvp_daily_archives.snapshot', snapshot::text FROM public.mvp_daily_archives
  UNION ALL
  SELECT 'mvp_season_archives.snapshot', snapshot::text FROM public.mvp_season_archives
) AS refs
WHERE value ILIKE '%supabase%'
GROUP BY source
ORDER BY source;

-- If this returns zero rows, no URLs in the listed image fields point to Supabase.
-- If rows remain, copy/migrate these public objects into Cloudflare R2 and update the URLs
-- before deleting the old Supabase project. Other JSON/document fields should also be audited
-- if the application stores external image URLs there.
