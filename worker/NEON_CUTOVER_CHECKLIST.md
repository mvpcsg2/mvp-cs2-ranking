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
- [ ] Verify CORS from `https://mvpcsg2.github.io`.

## Phase B — browser read migration
- [x] Move team and player-directory reads to typed Worker routes.
- [x] Move player top-position aggregate reads to a typed Worker route.
- [ ] Move each remaining public read to a typed Worker route.
- [ ] Confirm response field names and nullability against Neon schema.
- [ ] Compare row counts and representative records with the old source.
- [ ] Add loading/error states; do not silently fall back to empty arrays.
- [ ] Test ranking, team detail, player detail, matches, news, tournaments, and archives.

## Phase C — identity and protected writes
- [ ] Decide whether Supabase Auth remains the identity provider during transition.
- [ ] Verify bearer tokens server-side (never trust browser-supplied role/permissions).
- [ ] Implement explicit authorization for each admin/moderator action.
- [ ] Port RPC behavior as separate validated operations, not arbitrary SQL.
- [ ] Add request validation, rate limits, audit logging, and safe error responses.
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
