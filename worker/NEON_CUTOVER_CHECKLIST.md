# Neon cutover checklist

Do not merge this branch as a complete Supabase replacement. It currently contains a safe read-only Worker baseline.

## Phase A — Worker connectivity
- [ ] Add Cloudflare Worker secret `DATABASE_URL` (Neon connection string; never commit it).
- [ ] Deploy Worker from `worker/`.
- [ ] `GET /health` returns `{ok:true}`.
- [ ] `GET /api/db-check` returns `{ok:true,database:"connected"}`.
- [ ] `GET /api/teams` returns the expected team rows.
- [ ] `GET /api/players` returns the expected player rows.
- [ ] `GET /api/player-top-positions` returns aggregate ranking positions.
- [ ] Verify `/api/site-news`, `/api/editorial-news`, `/api/team-matches`, `/api/matches`, `/api/tournaments`, `/api/streams`, `/api/live-matches`, `/api/player-stats`, `/api/season-state`, `/api/season-archives`, `/api/daily-archive-dates`, `/api/site-brand`, `/api/trophy-catalog`, `/api/team-rank-history`, `/api/player-match-history`, `/api/player-trophies`, and `/api/player-prize-money` after Worker deployment.
- [ ] Verify CORS from `https://mvpcsg2.github.io`.
- [ ] Run `worker/sql/2026-11-13-daily-archive-compact.sql` in Neon SQL Editor. It preserves existing legacy snapshots and configures team-only snapshots for future dates.
- [ ] Deploy Worker with the cron trigger configured in `worker/wrangler.toml`; verify the scheduled invocation creates only the previous Berlin day once.
- [ ] Verify new rows contain only `snapshot_date`, `captured_at`, and `teams`; verify old rows still retain their legacy player/match/trophy fields.
- [ ] Do NOT run `VACUUM FULL` yet. Existing JSON snapshots are intentionally retained because the current UI still reads historical player/match/trophy data from them. Reclaim space only after those UI dependencies are migrated and old snapshots can safely be compacted.

## Phase B — browser read migration
- [x] Move team and player-directory reads to typed Worker routes.
- [x] Move player top-position aggregate reads to a typed Worker route.
- [x] Add typed public GET routes for news, tournaments, team matches, archives, site branding, trophy catalog, rank history, and player profile history.
- [x] Add compact daily archive capture for future dates, preserve legacy snapshots needed by historical UI, and remove triggers that generated full-database snapshots.
- [x] Switch selected website public reads (news rail, news hub, daily/season archives, site branding, trophy catalog, player profile history, top players, matches, tournament display, streams, live match display) to the Neon API.
- [ ] Move each remaining public read to a typed Worker route.
- [ ] Confirm response field names and nullability against Neon schema.
- [ ] Compare row counts and representative records with the old source.
- [ ] Add loading/error states; do not silently fall back to empty arrays.
- [ ] Test ranking, team detail, player detail, matches, news, tournaments, and archives, including older dates with legacy snapshots and new team-only dates.

## Phase C — identity and protected writes

### Neon authentication foundation
- [x] Add separate Neon account/session/email-token/rate-limit tables SQL.
- [x] Add Worker endpoints for registration, email verification, login, session lookup, logout, and password reset.
- [x] Hash passwords with PBKDF2-HMAC-SHA-256; store only password hashes/salts and hashed one-time/session tokens.
- [x] Add IP-based rate limiting to auth operations.
- [x] Configure server-side admin allowlist for `semkimr@gmail.com`; admin role is granted only after email verification.
- [ ] Run `worker/sql/2026-11-13-neon-auth.sql` in Neon.
- [ ] Configure Cloudflare secret `RESEND_API_KEY` and verified sender variable `RESEND_FROM_EMAIL`.
- [ ] Deploy Worker and test all auth endpoints and email delivery.
- [ ] Add browser-side verification/reset link handlers and connect registration/login/session UI to Neon auth.

### Protected-operation migration (required before Supabase Auth can be disabled)
- [ ] Move every protected admin/moderator write and read from Supabase to Worker routes.
- [ ] Verify Neon bearer sessions server-side for every protected operation (never trust browser-supplied role/permissions).
- [ ] Implement explicit authorization for each admin/moderator action.
- [ ] Port RPC behavior as separate validated operations, not arbitrary SQL.
- [ ] Add request validation, rate limits, audit logging, and safe error responses.
- [ ] Migrate or reset existing accounts without exposing or copying plaintext passwords.
- [ ] Test unauthorized, non-admin, moderator, and admin cases.

## Phase D — assets and realtime
- [ ] Migrate Storage bucket objects and update URLs, or intentionally retain Supabase Storage.
- [ ] Replace each Realtime subscription with a documented polling/websocket mechanism, or retain Supabase Realtime.
- [ ] Test upload, delete, live ranking, live matches, news rail, and tournament updates.

## Phase E — final cutover
- [ ] Search the final page for all Supabase SDK, table, RPC, auth, storage, and channel references.
- [ ] No remaining dependency unless explicitly retained and documented.
- [ ] Run end-to-end tests on desktop and mobile.
- [ ] Keep the previous GitHub Pages deployment and DB backup available for rollback.
- [ ] Only then call the migration complete.
