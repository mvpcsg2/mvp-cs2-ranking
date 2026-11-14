# Neon-only backend and authentication

The browser app has been switched from the Supabase SDK to a small client adapter that calls the Cloudflare Worker. The Worker uses Neon for database queries, session validation, admin RPC operations, and Cloudflare R2 for new image uploads.

This is a source-code cutover on branch `neon-migration`. It is **not live** until the SQL, Cloudflare secrets/bindings, Worker deployment, and Pages deployment are completed and tested.

## 1. Neon SQL

Run these files in the Neon SQL Editor, in this order:

1. `worker/sql/2026-11-13-neon-auth.sql` — creates auth/session/token/rate-limit tables and the atomic year-archive function.
2. `worker/sql/2026-11-13-daily-archive-compact.sql` — stops full-database daily snapshots and configures team-only snapshots for future dates. It preserves old snapshots because historical UI still reads them.
3. `worker/sql/2026-11-13-neon-legacy-storage-audit.sql` — read-only audit of old object URLs that may still point to Supabase Storage.

Do not delete old archive JSON or the old Supabase project until historical views, users, and image URLs have been checked.

## 2. Cloudflare configuration

In Cloudflare Dashboard → R2, create a bucket named `mvp-cs2-assets`. The Worker config binds it as `MVP_ASSETS`.

In Cloudflare Dashboard → Workers & Pages → `mvp-cs2-api` → Settings → Variables and Secrets, set:

- Secret `DATABASE_URL`: Neon connection string.
- Secret `RESEND_API_KEY`: Resend API key for email verification and password resets.
- Secret `FACEIT_API_KEY`: Faceit Data API key; required only for the Elo sync button.
- Variable `RESEND_FROM_EMAIL`: sender address on a domain verified in Resend, e.g. `MVP CS2 Ranking <noreply@your-verified-domain.example>`. Replace the example with the actual verified sender.

The Worker config sets:
- `AUTH_ADMIN_EMAIL=semkimr@gmail.com`
- `AUTH_PUBLIC_URL=https://mvp-cs2-ranking.pages.dev/`
- `AUTH_API_URL=https://mvp-cs2-api.mvpcsgo2.workers.dev`
- R2 binding `MVP_ASSETS` → `mvp-cs2-assets`

The email address above receives admin role only after ownership is verified by email. The Worker also re-enforces the primary-admin role on each login/session refresh. All other new users receive `player`.

## 3. Deploy

From the `worker/` directory, install dependencies and deploy the Worker after the SQL, secrets, and R2 bucket are ready.

Then deploy the website from branch `neon-migration` to Cloudflare Pages (or merge PR #1 only after review). The current published website may still be running the old branch until that deployment happens.

## 4. What has been switched in code

- Browser authentication: Neon Worker register/login/session/logout, email confirmation, resend verification, password reset.
- Password storage: PBKDF2-HMAC-SHA-256 hashes with per-user random salts; raw passwords are never stored.
- Admin/moderator permissions: read from Neon session user and checked again inside Worker routes.
- Database SDK calls: adapter forwards table reads/writes and RPC calls to allowlisted Worker endpoints.
- Storage uploads: new logo/background/trophy uploads go to R2; existing URLs are preserved until audited/migrated.
- FACEIT sync: Worker endpoint using `FACEIT_API_KEY`.
- Realtime: removed Supabase channels and replaced them with existing polling intervals.

## 5. Existing accounts and assets

Existing Supabase Auth users/password hashes have not been copied. Users must create a Neon-backed account and verify email; the primary admin account is `semkimr@gmail.com`. Existing moderator roles must be re-created after those users register, using the admin moderation panel.

The SQL file `worker/sql/2026-11-13-neon-legacy-storage-audit.sql` reports which old image fields still contain Supabase Storage URLs. If the query returns rows, migrate those objects into R2 and update the URLs before removing the old Supabase project. Previously hosted images outside Supabase (for example, third-party CDN links) remain unchanged.

## 6. Verification before retirement

Do not disable/delete the old Supabase project until:
- The Neon SQL files have run successfully.
- Worker `/health`, `/api/db-check`, and auth endpoints are verified.
- Registration, email confirmation, login, logout, reset password, and admin assignment are tested.
- Public reads, all admin/moderator writes, support chat, FACEIT sync, R2 upload/public reads, and season wipe are tested.
- The storage audit returns zero remaining old storage URLs or all remaining URLs have been moved to R2.
- Existing user access and historical archives are accounted for.
- The Pages website is deployed from the Neon-only branch and tested on desktop and mobile.

No production deployment or database SQL execution is performed by these repository changes alone.
