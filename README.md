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

When `POST /api/inquiries/:id/approve` is called:

1. The inquiry is validated — `name`, `email`, `service`, and `description` must be present.
2. A single Prisma `$transaction` runs:
   - `inquiries.status` → `APPROVED`, `approved_at` → now
   - Creates one `companies` record (name defaults to `inquiry.company ?? inquiry.name`)
   - Creates one `users` record linked to that company, `status = INVITED`
   - Creates one `projects` record linked to both company and user, `status = ONBOARDING`
3. The endpoint is idempotent — if all three records already exist it returns them immediately without re-running the transaction.

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
