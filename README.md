# Dreamable.studio

Next.js 15 / React 19 / TypeScript / Tailwind portfolio & lead-capture site backed by Supabase (PostgreSQL) and Prisma.

---

## Local Development

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local   # fill in your values
npx prisma generate
npm run dev
```

---

## Using Supabase with Prisma

Supabase uses **PgBouncer** (connection pooler) by default, which is incompatible with Prisma's migration engine. You need **two** connection strings:

| Variable | Purpose | Where to find it |
|---|---|---|
| `DATABASE_URL` | Runtime queries (pooled via PgBouncer) | Supabase → Settings → Database → Connection string → **Transaction mode** (port 6543) |
| `DIRECT_URL` | Prisma Migrate (bypasses PgBouncer) | Supabase → Settings → Database → Connection string → **Session mode** (port 5432) |

Both strings require `?sslmode=require`. Example `.env.local`:

```
DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxx.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres?sslmode=require"
```

> If you are **not** using PgBouncer (e.g. a plain Postgres instance), set both variables to the same connection string.

### Apply the database schema

**Fresh setup (recommended for Supabase):**
```bash
npx prisma db push
```

**Or using Prisma Migrate:**
```bash
npx prisma migrate deploy   # apply pending migrations
npx prisma generate         # regenerate client
```

**If the table already exists and you want Prisma to track migrations:**
```bash
npx prisma migrate resolve --applied "20250101000000_init"
```

---

## Data Model

### Tables

| Table | Description |
|---|---|
| `inquiries` | Raw lead records created by the public contact form. Source of truth. |
| `companies` | Client company created when an inquiry is approved. |
| `users` | Client user (portal login) created when an inquiry is approved. |
| `projects` | Active project created when an inquiry is approved. |

Each of `companies`, `users`, and `projects` carries a unique `inquiry_id` foreign key so the same inquiry can never accidentally spawn duplicate records.

### Approval flow

`POST /api/inquiries/:id/approve` is **admin-only**. The caller must have a valid session *and* be a currently active administrator in the database (401 if signed out or revoked, 403 if not an admin); nothing is looked up or written for anyone else. When called:

1. The inquiry is validated — `name`, `email`, `service`, and `description` must be present.
2. A single Prisma `$transaction` runs. It first locks the inquiry row (`SELECT … FOR UPDATE`) so two simultaneous approvals cannot duplicate records, then:
   - `inquiries.status` → `APPROVED`, `approved_at` → now, `approved_by_id` → the approving admin
   - Creates one `companies` record (name defaults to `inquiry.company ?? inquiry.name`)
   - Creates one `users` record linked to that company, `status = INVITED`
   - Creates one `projects` record linked to both company and user, `status = ONBOARDING`
   - Writes an `audit_logs` row (`inquiry.approve`) — if any step fails, nothing is kept.
3. The endpoint is idempotent — if all three records already exist it returns them without writing anything.
4. The response contains only an allowlisted set of fields (see `lib/approvalDto.ts`); password hashes, login codes and tokens are never returned.

**Error responses**

| Status | Meaning |
|---|---|
| 404 | Inquiry ID not found |
| 409 | `users.email` already exists on a different record |
| 422 | Required field missing on the inquiry |
| 500 | Unexpected server error |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Pooled Postgres connection (Supabase Transaction mode) |
| `DIRECT_URL` | Yes | Direct Postgres connection for Prisma Migrate |
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | For email | SMTP login username |
| `SMTP_PASS` | For email | SMTP login password |
| `INQUIRY_TO_EMAIL` | For email | Address that receives new inquiry notifications |
| `INQUIRY_FROM_EMAIL` | No | From address (defaults to `SMTP_USER`) |
| `APP_URL` | No | Canonical URL of the deployed site |
| `SESSION_SECRET` | **Yes** | Signs session cookies. ≥ 32 random chars. `openssl rand -hex 32` |
| `RESET_SECRET` | **Yes** | Keys the stored hash of password-reset links. ≥ 32 random chars, different from `SESSION_SECRET`. |

Email sending is **optional** — if SMTP vars are missing the app logs a warning and continues normally.

---

## Production Setup

### Vercel (recommended)

1. Push the repo to GitHub and connect it to a new Vercel project.
2. Add all env vars from `.env.example` in **Vercel → Settings → Environment Variables**.
3. Vercel automatically runs `npm run build` on every push. The `postinstall` script runs `prisma generate` so the Prisma client is always up to date.

### Supabase notes

- **Region:** Choose a region close to your users (and match your Vercel region) to minimise latency.
- **Connection pooling:** Supabase provides PgBouncer in Transaction mode — use the port-6543 URL as `DATABASE_URL` in production. This handles burst traffic without exhausting Postgres connections.
- **SSL:** Always include `?sslmode=require` in both connection strings.
- **Row-level security:** If you enable RLS on the `inquiries` table, make sure the Prisma service role (or your Postgres user) has the necessary policies.

### Rate limiting

The in-memory rate limiter in `/api/inquiries` works per-process and resets on redeploy. For production deployments with multiple instances (e.g. Vercel's serverless functions), replace `isRateLimited()` with a Redis/Upstash-backed implementation using `@upstash/ratelimit`.

---

## Commands Reference

```bash
npm run dev            # start dev server
npm run build          # production build
npm run lint           # ESLint check
npx prisma validate    # validate schema.prisma
npx prisma generate    # regenerate Prisma client
npx prisma db push     # push schema to DB without migrations
npx prisma migrate dev # create & apply a new migration (local)
npx prisma migrate deploy  # apply pending migrations (CI/production)
npx prisma studio      # open Prisma Studio GUI
```

---

## Authentication & Security

### Secrets
`SESSION_SECRET` and `RESET_SECRET` have **no fallback**. Each must be set, at least 32 characters, not a placeholder, and different from the other (`lib/secretPolicy.mjs`). If they are not, sign-in, password reset and every protected request fail closed (503/500 with a configuration message; values are never logged). Startup logs the problem (names only), and `npm run build` fails on Vercel/CI (`scripts/check-secrets.mjs`); locally it only warns.

```bash
openssl rand -hex 32   # run twice: once per secret
```

**Rotation** (do this at once if any deployment ever ran with the old `change-me-in-production` default, or a secret/cookie was exposed):
1. Generate two new values and set them in the host's environment (Vercel → Settings → Environment Variables, Production and Preview).
2. Redeploy. Rotating `SESSION_SECRET` signs everyone out. Rotating `RESET_SECRET` invalidates every outstanding reset link (they are stored as a keyed hash).
3. Cookies issued before this release have no session version and are also rejected, so the first deploy forces everyone to sign in again.

### Authorization
A signed cookie is only a *claim*. `lib/authz.ts` (`requireUser`, `requireAdmin`, `requireAdminPage`, `requireClientPage`) re-reads the user row on every protected request and requires: user exists, `status = ACTIVE`, `session_version` matches the cookie, and (for admin) `admin = true`. Demoting, suspending or deleting someone takes effect on their very next request. `middleware.ts` is only an early navigation gate. 401 = not signed in / session no longer valid; 403 = signed in but not allowed. Any new route must call one of these helpers (`tests/routeGuards.test.ts` enforces it for admin routes).

### Account states (`users.status`)
| Status | Sign in | Password link/code | Notes |
|---|---|---|---|
| `INVITED` | no | yes — completing it activates the account | Created by inquiry approval or "Add client" |
| `ACTIVE` | yes | yes (stays `ACTIVE`) | |
| `SUSPENDED` | no | **no** — never reactivated by a reset | Only an admin action changes it |
| anything else | no | no | Fails closed |

Admin controls: `PATCH /api/admin/users/:id` (`{status: "ACTIVE"|"SUSPENDED", admin?: boolean}`) and `POST /api/admin/users/:id/revoke-sessions`. Both bump the user's session version, write an audit row, and refuse to act on the caller's own account. (API only — no UI yet.)

### Session revocation
`users.session_version` is stored in the cookie and compared on every request. It is incremented on password change/reset, suspension, role change and revoke-all, so old cookies stop working on every device. Cookie lifetime is unchanged: 1 day, or 30 days with "remember me". Logout clears the cookie.

### Password reset
Links are random 32-byte tokens; only an HMAC (keyed with `RESET_SECRET`) is stored in `password_reset_tokens`. A link is single use (claimed with a conditional update inside the same transaction that changes the password), expires after 1 hour, and is retired when a newer one is requested or the password changes. `verify-reset-token` is read-only and returns no account details. The emailed-code flow (`request-code` → `update-password`) follows the same account-state rules and is also single use.

### Tests
`npm test` runs the Vitest suite in `tests/` (secret policy, denial matrix, approval, reset links, login, route guards). Database calls are mocked, so these prove the application logic, not the real Postgres locking.
