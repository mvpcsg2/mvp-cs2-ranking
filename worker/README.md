# MVP CS2 API (Cloudflare Worker + Neon)

This Worker is a transitional API. The website still contains Supabase integration; do not describe the whole site as migrated until all database, auth, storage, realtime, and RPC use has been replaced and tested.

## Configure

1. In Cloudflare Workers, create or select the Worker `mvp-cs2-api`.
2. Deploy from this directory (or paste `src/index.js` into the Worker editor).
3. Add `DATABASE_URL` as a Worker secret. Use the Neon connection string for the intended database. Never commit it to this repository or put it in `index.html`.
4. Keep `CORS_ORIGIN` set to `https://mvpcsg2.github.io`.
5. Test:
   - `GET https://<worker-host>/health`
   - `GET https://<worker-host>/api/db-check`
   - `GET https://<worker-host>/api/teams`
   - `GET https://<worker-host>/api/players`

The health endpoint checks only that the Worker is running. The DB check verifies a database round trip. The teams/players endpoints additionally verify the expected columns exist.

## Current scope

- Public GET: teams and players.
- No arbitrary table-name endpoint.
- No public writes.
- No admin endpoints until authentication and server-side authorization are implemented.

## Migration gaps (must be completed before removing Supabase)

The current website still uses Supabase directly for:
- authentication/session lifecycle and profile permissions;
- many table reads/writes (the page currently contains 82 `client.from(...)` calls);
- RPC functions (16 `client.rpc(...)` calls);
- Storage (6 calls);
- Realtime subscriptions.

A database migration alone does not recreate Supabase Auth, Storage, Realtime, or Postgres RPC behavior. Keep the existing authentication path until a replacement has been implemented and tested. Never trust a role or user ID supplied only by the browser.

## Security and rollout

- Do not expose `DATABASE_URL` or Neon credentials to the browser.
- Do not add a generic SQL/table proxy.
- Add server-side identity verification and per-operation authorization before adding write/admin routes.
- Restrict CORS to the production origin; CORS is not authentication.
- Deploy this Worker and verify the four endpoints before switching any page reads.
- Migrate page features in small groups; preserve a tested rollback to the current site until parity is proven.
