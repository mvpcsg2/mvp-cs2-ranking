# Neon authentication rollout

The Worker now contains a separate Neon-backed email/password auth API. This is a staged backend change; it does **not** switch the live browser UI away from Supabase Auth yet.

## 1. Create the Neon tables

Run `worker/sql/2026-11-13-neon-auth.sql` in the Neon SQL Editor. It creates private account, session, one-time-token, and rate-limit tables. It does not delete or modify Supabase data.

## 2. Configure email delivery in Cloudflare

In Cloudflare Dashboard → Workers & Pages → `mvp-cs2-api` → Settings → Variables and Secrets:

- Add secret `RESEND_API_KEY` using the API key from Resend.
- Add a non-secret variable `RESEND_FROM_EMAIL` with a sender address on a domain verified in Resend, for example `MVP CS2 Ranking <noreply@your-verified-domain.example>`. Replace the example with the actual verified sender; do not use an unverified domain.

The Worker configuration already sets:
- `AUTH_ADMIN_EMAIL=semkimr@gmail.com`
- `AUTH_PUBLIC_URL=https://mvp-cs2-ranking.pages.dev/`

Only an account that registers with this exact email and successfully verifies ownership of it receives the `admin` role. All other newly registered accounts receive `player`.

## 3. Deploy and test the API

Deploy from the `worker/` directory after the SQL and email settings are in place. Test:
- `GET /health`
- `GET /api/auth/session` (without a token it should return `user: null`)
- `POST /api/auth/register` with `{ "email": "...", "username": "...", "password": "at-least-10-characters" }`
- Click the verification link received by email; it opens the site with an `auth=verify` URL parameter. The browser UI still needs the matching verification handler before this flow is convenient end-to-end.
- `POST /api/auth/login` after verification.

## Important: browser cutover is not complete

The current frontend still uses Supabase Auth and Supabase-backed protected writes/RPC for profile roles, admin/moderator operations, bans, support inbox, and other controls. Do not remove the Supabase project or its users/tables yet. The next engineering stage is to migrate these protected operations to authenticated Worker routes, then connect the frontend to these new auth endpoints and test all admin/moderator actions before switching off Supabase Auth.

Existing Supabase passwords are not exported by this migration. Existing users will need a verified re-registration or a deliberate account migration/reset workflow. The SQL leaves all Supabase data untouched.
