# Neon-only cutover checklist

The website source on this branch no longer loads the Supabase SDK or calls Supabase Auth, database, Storage, Edge Functions, or Realtime APIs. Browser calls go through the Cloudflare Worker to Neon and R2.

**Important:** source-code changes are committed to `neon-migration`, but they are not production until SQL is run, Worker secrets/R2 are configured, Worker is deployed, and Pages is deployed from this branch. Keep the old project available for rollback until the checks below pass.

## Phase A — Neon and Worker setup
- [ ] Verify Cloudflare Worker secret `DATABASE_URL` points to the intended Neon database.
- [ ] Run `worker/sql/2026-11-13-neon-auth.sql` in Neon SQL Editor.
- [ ] Run `worker/sql/2026-11-13-daily-archive-compact.sql` in Neon SQL Editor; it preserves old archive JSON and makes future daily snapshots team-only.
- [ ] Create Cloudflare R2 bucket `mvp-cs2-assets`; Worker binding is `MVP_ASSETS`.
- [ ] Set Cloudflare secret `RESEND_API_KEY`.
- [ ] Set Cloudflare variable `RESEND_FROM_EMAIL` to a sender on a domain verified in Resend.
- [ ] Optional: set Cloudflare secret `FACEIT_API_KEY` for FACEIT Elo sync.
- [ ] Deploy Worker from `worker/`.
- [ ] Verify `GET /health` and `GET /api/db-check`.
- [ ] Verify CORS from both the published Pages origin and GitHub Pages origin.
- [ ] Verify cron creates only the previous Berlin day once.

## Phase B — browser data calls
- [x] Remove Supabase JS CDN and Supabase client initialization from `index.html`.
- [x] Replace the browser client with a Neon Worker adapter for select/insert/update/delete/upsert.
- [x] Add allowlisted Neon table access with per-table fields and server-side role/permission checks.
- [x] Replace all 15 browser RPC calls with validated Worker RPC routes (including season reset, team save, player rename/bans, moderation accounts, and email bans).
- [x] Replace Supabase Realtime channels with polling against Neon API routes.
- [x] Move FACEIT Elo sync into a Worker endpoint.
- [ ] Verify actual row counts and CRUD behavior against the production Neon schema for every supported table.
- [ ] Test ranking, teams, player profiles, match history/stat entry, tournaments, streams, news, support chat, moderation, settings, and season archive.

## Phase C — Neon authentication
- [x] Add Neon users, sessions, email-token, and rate-limit tables SQL.
- [x] Add Worker registration, verification, login, session, logout, password reset, and resend-verification endpoints.
- [x] Hash passwords with PBKDF2-HMAC-SHA-256 and store only hashes/salts.
- [x] Add session validation and per-operation permission checks in Worker.
- [x] Configure primary admin allowlist for `semkimr@gmail.com`; ownership must be confirmed by email before admin role is granted.
- [x] Switch browser auth flows to Neon Worker; remove Supabase Auth.
- [ ] Run auth SQL in Neon.
- [ ] Configure Resend and test verification + password reset emails.
- [ ] Register/verify `semkimr@gmail.com` and confirm admin access.
- [ ] Existing users must create/verify Neon accounts; re-create any moderator grants after they register. Existing Supabase password hashes are not copied.

## Phase D — files and live updates
- [x] Replace new site asset uploads with Cloudflare R2 routes for logos, backgrounds, and trophy images.
- [x] Add public R2 asset route and Worker binding.
- [x] Replace live match, tournament, and news Realtime channels with periodic refresh.
- [ ] Create the R2 bucket and test upload/read for each asset category.
- [ ] Run `worker/sql/2026-11-13-neon-legacy-storage-audit.sql` and check for old Supabase Storage URLs.
- [ ] Copy any remaining legacy assets into R2 and update database URLs before removing the old storage project.
- [ ] Verify existing images and new uploads on desktop and mobile.

## Phase E — final verification and retirement
- [ ] Deploy the Pages site from `neon-migration` (or merge PR #1 after reviewing the diff).
- [ ] Run end-to-end checks with unauthenticated, player, moderator, and admin sessions.
- [ ] Verify support chat, moderator permission changes, bans, file uploads, FACEIT, and year wipe.
- [ ] Verify the storage audit returns zero old Supabase URLs, or all remaining URLs are migrated.
- [ ] Confirm old user accounts have been recreated/verified and role assignments restored.
- [ ] Keep a Neon backup and previous site deployment available for rollback.
- [ ] Only after all checks pass, retire the Supabase project.

## Current blockers

The remaining steps above require access to the Neon SQL Editor, Cloudflare Worker settings/R2, Resend sender verification, and a deployment. These are not actions that a Git commit can perform. Do not delete Supabase until the external verification steps are complete.
