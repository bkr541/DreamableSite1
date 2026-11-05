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
| `SUPABASE_URL` | For large files | Project URL of the Supabase project that holds the file bucket |
| `SUPABASE_SERVICE_ROLE_KEY` | For large files | Server-only key used to issue upload/download links. Never expose to the browser. |
| `STORAGE_BUCKET` | No | Private bucket name (default `dreamable-files`) |
| `CRON_SECRET` | For cleanup | Authorises the daily `/api/cron/cleanup-uploads` job (≥ 16 chars) |
| `TRUSTED_PROXY` | No | Which proxy headers identify the visitor's IP for rate limiting (`vercel`, `hops:N`, or unset). Automatic on Vercel. |
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

---

## Abuse protection

### One shared rate limiter
`lib/rateLimit.ts` is the only limiter. Counters live in the Postgres table `rate_limits`, updated with a single atomic `INSERT … ON CONFLICT DO UPDATE`, so every serverless instance and every redeploy sees the same numbers and simultaneous requests can't slip past. Keys are hashed (no emails or IPs are stored). A bucket that goes over budget is blocked until its window ends; repeat offences within 24 h double the block, capped per rule — **every block expires**, so nobody is locked out for good. If the database is unreachable the limiter fails open and logs a `rate_limit.store_error` alert (it never takes sign-in or the contact form down).

| Where | Budget (per window) | Notes |
|---|---|---|
| Sign-in, per IP | 30 attempts / 15 min | |
| Sign-in, per IP + email | 5 **failures** / 15 min | counted only on failure; a correct sign-in clears it |
| Sign-in, per email | 10 **failures** / 15 min | many-source guessing at one account; expires, then the owner can sign in |
| Reset link / code email, per email | 3 / hour | **shared** by `forgot-password` and `request-code`; same answer whether or not the account exists |
| Reset link / code email, per IP | 10 / hour | |
| Code check (`verify-code`, `update-password`), per IP + email / email | 5 / 10 failures per 15 min | wrong code attempts only; plus 30 attempts / 15 min per IP |
| Reset-link use / check, per IP | 30 / 15 min | |
| Public inquiry, per IP | 8 / 10 min | an office of several people can all submit |
| Public inquiry, per email | 3 / hour | duplicates (same email + text within 10 min) return the original and don't count |
| Share comments, per IP / per IP + file / per link | 10 per 10 min / 5 per 10 min / 60 per hour | |

A blocked request gets `429` with a `Retry-After` header and a message such as *"Too many sign-in attempts. Please wait 12 minutes and try again."* (the comment box also counts down on its button). Throttle events are logged as `[security] {…}` JSON lines with hashed references only; a repeat offender (3+ strikes) or a 10× burst logs at `"level":"alert"` (stderr) — point a log-drain alert at `[security]` + `"level":"alert"`.

### Client IP and trusted proxies
`lib/clientIp.ts` is the only code that reads forwarding headers. On Vercel (automatic) it uses the platform's client-IP header. Behind your own proxies set `TRUSTED_PROXY=hops:N`. With nothing trusted, headers are ignored — so `X-Forwarded-For: <anything>` never earns a new bucket. IPv6 addresses are grouped by /64.

### Recovery codes
Emailed 8-character codes are stored as an HMAC (`lib/recoveryCode.ts`, keyed with `RESET_SECRET`), expire after 10 minutes, are cleared when used, and can only be spent once. Codes issued before this release were stored in clear text and simply stop working — the user requests a new one.

### Public comments
Folders have **Allow comments** and **Review comments before they appear** switches (folder dialog). Every comment write re-checks that the link is live (public folder, matching token) and that comments are on. With review on, new comments are `PENDING` — not returned to the poster or any visitor — until approved in the admin (Approve / Hide on each comment; both are audited as `comment.moderate`, deletions as `comment.delete`). Hidden comments are never sent to the public page. Guests are always labelled **"Guest · unverified"** (nothing proves a typed name); names that would pass for the studio ("Admin", "Dreamable…", "Support", …) are refused; comments are cleaned of control characters, capped at 2,000 characters and 3 links, and an identical repeat within 10 minutes is rejected.

### Email content
All visitor text in notification emails is built by `lib/inquiryEmails.ts` and escaped exactly once (`lib/html.ts`); descriptions keep their line breaks via `<br>` added by our code. Subjects and display names have control characters (CR/LF included) stripped; Reply-To is set only when the address is a clean single mailbox; the inquiry form now also rejects addresses containing `<>,;"` or whitespace, bounds each field, and rejects oversized bodies (413).

### Testing multi-instance behaviour
`npm test` runs the limiter against a **real in-process Postgres (PGlite)** using the exact DDL from the migration. Each "application process" in the tests is a fresh module registry (`vi.resetModules()`) that shares only the database, which is how a second serverless instance or a redeploy behaves. To check it by hand on a deployment: send 10 quick `POST /api/inquiries` requests (the 9th returns 429), then redeploy and repeat within 10 minutes — it still returns 429; add a fake `X-Forwarded-For` — still 429.

---

## Files & storage

### Hosting limits (why uploads changed)
| Where | Limit | Consequence |
|---|---|---|
| Vercel Functions | **4.5 MB** request body, and 4.5 MB for a *buffered* response | A 25 MB upload or download cannot pass through a route handler |
| Supabase Storage | file size cap is per bucket, and per plan (50 MB on Free); 1 GB storage / 5 GB egress on Free | 25 MB deliverables fit; watch the quota as clients accumulate files |
| Function memory/time | validation and watermarking read a whole file (≤ 25 MB) into memory | fine at 1 GB default memory; files above the limits are refused, not truncated |

So file bytes now travel **browser ⇄ private storage** on short-lived, single-object links. PostgreSQL keeps ownership, names, type, size, SHA-256, object key and state. These limits are hosting-specific: a self-hosted server without the 4.5 MB cap could use the old route (`SUPABASE_*` unset) — the app falls back to it automatically.

### One-time setup (Supabase)
1. **Run the SQL first:** `prisma/migrations/20261105010000_files_sharing_archive/migration.sql` (additive, idempotent; safe while the old code is live).
2. **Storage → New bucket** `dreamable-files` → leave **Public bucket OFF** → set *File size limit* to `26214400` (25 MB) → optionally restrict allowed MIME types.
3. Add the environment variables above in Vercel (and `.env.local`), then redeploy.
4. Run `node --env-file=.env.local scripts/verify-storage.mjs`. It uploads 1/10/25 MB objects through signed URLs, reads them back through signed URLs, confirms the bucket is private and forged/unsigned links are refused, then deletes its test objects. **Do not rely on direct uploads until every line says PASS.**
5. `vercel.json` schedules `/api/cron/cleanup-uploads` daily (Hobby-plan compatible). Uploads that were started but never completed are also swept opportunistically.

### How an upload works
1. **init** – server checks the caller (admin, or the rate-limited public form), the count/size/extension rules, and records each file as `PENDING` with an opaque key (`deliverables/<uuid>`, never derived from the filename); it returns one-object upload URLs.
2. **upload** – the browser PUTs the bytes straight to storage, showing per-file progress.
3. **complete** – the server confirms the object exists and is the declared size, reads it, validates the *real content* (below), records its SHA-256 and only then marks it `READY`. A file that fails is removed — object and record — and the reason is shown. Only `READY` files are ever listed, shared or served.
4. Abandoned `PENDING` files and objects are removed after 1 hour (opportunistically) and by the daily job. Deleting a file, folder or project also removes the stored objects; if storage is unreachable at that moment the keys are logged (`[storage] could not remove objects; remove them manually: …`).

Public inquiry attachments work the same way via `/api/inquiries/uploads` (rate limited, max 5 × 10 MB, 300 unclaimed uploads at once), claimed and verified when the inquiry is submitted. In storage mode attachments are **listed in the notification email rather than attached** (a 50 MB email is not deliverable) — open the inquiry in the admin to download them.

### Downloads
Ownership / admin / live-share-token checks run first. Then:
* **Download** → `302` to a signed storage link that expires in **30 seconds** (`Cache-Control: no-store`). A link already issued when you revoke sharing stays usable for up to those 30 seconds; nothing new is issued.
* **Preview** (`?inline=1`) → streamed through the server so our headers always apply (`X-Content-Type-Options: nosniff`, fixed content type, `Content-Security-Policy: …sandbox` for everything but PDF, `Cache-Control: private, no-store`); `Range` is forwarded so video can seek.
* **Watermarked** files are watermarked per request from the stored original; the clean file is never linked or sent, and if the watermark can't be applied the request fails. Limits: ≤ 25 MB, ≤ 100 megapixels, ≤ 300 PDF pages.
* Download names are sanitised (no path parts, quotes, control characters) with an ASCII fallback + RFC 5987 name. Only PNG/JPG/GIF/SVG/PDF/video/text are ever shown inline; Office, archive and design files are download-only.

### Content validation (`lib/fileValidation.ts`)
Name, extension, declared type **and the actual bytes** must agree with one allowlist (`lib/fileTypes.ts`): magic bytes for PNG/JPEG/GIF/PDF/MP4/MOV/WebM/OLE; a complete, bounded read of the ZIP central directory for DOCX/XLSX/PPTX/ZIP/Sketch/XD/Fig (entries ≤ 5,000, no path traversal, claimed expansion ≤ 4 GB and ≤ 1000:1 — **nothing is unpacked**); images ≤ 100 MP and 20,000 px a side; PDFs ≤ 1,000 pages with a truncation check and no `/Launch`; SVG refused if it contains script, event handlers, `foreignObject`, entities or external references; text files must be text (executables, HTML, PHP and shell scripts are refused). A whole check is time-bounded (20 s).

**What this is not:** it is format validation, not malware scanning. Supabase Storage has no built-in scanner, so nothing here claims a file is virus-free. Old-format Office files (`.doc/.xls/.ppt`) can contain macros and ZIPs can contain programs; they are only ever delivered as downloads, never rendered. If you need scanning, add a scanner at the `complete` step (`lib/uploadFlow.ts → finalizeUpload`).

### Moving existing database-stored files
Existing files keep working untouched. When you're ready:
1. **Back up** (Supabase → Database → Backups; Phase 08 covers scheduled backups/retention).
2. `node --env-file=.env.local scripts/migrate-files-to-storage.mjs` — dry run, lists what would move.
3. `… --apply` — uploads each file, **reads it back and compares SHA-256**, and only then records `storage_key` + `sha256`. Failures leave the original untouched. Re-runnable.
4. From now on the app serves migrated files from storage and **falls back to the database copy** if storage can't be reached.
5. After you've checked the app (and at least one backup after migration): `… --purge-db-bytes --i-have-a-backup` re-verifies every stored copy against its recorded checksum and only then clears the database bytes (any mismatch keeps its database copy). Until then nothing is removed.

### Rollback
Everything before step 5 is reversible: unset `SUPABASE_*` and the app reverts to database-stored uploads; migrated rows still hold their bytes, so they keep working. After step 5, the objects in the bucket (and your backup) are the only copies — keep the bucket.

## Sharing links
A share link is a bearer URL, so its token is the only protection. Rules (`lib/shareLinks.ts`):
* Tokens are 192 random bits. **A token is never reused**: turning sharing **off** replaces it, turning sharing **on** issues a fresh one, and **New link** (folder dialog → *New link*, two clicks) replaces it while sharing stays on. A URL that has leaked can never be revived by toggling sharing.
* Every public lookup matches the *current* token and `isPublic`, so an old URL is a plain 404 for the page, file downloads and comments. Responses are `no-store`, and the page is rendered per request.
* Admin-only: `POST /api/admin/deliverable-folders/:id/share` with `{"action":"rotate"|"revoke"}`; all changes are audited (`folder.share_rotate|share_revoke|share_enable`).
* Not implemented (optional): link expiry dates and per-view audit records.

## Archiving inquiries
* The trash icon is now **Archive**. It only sets `archived_at`: the project, client, company, delivery folders, files, comments and share links are untouched, so clients keep access. Archived inquiries are hidden from the open list and from the *Open inquiries* count; pick **Status → Archived** to see them and **Restore** (row or detail) to bring one back. Audited (`inquiry.archive|restore`). An archived, never-approved inquiry must be restored before it can be approved.
* The database no longer cascades from inquiries into deliverables: `deliverables.inquiry_id` and `deliverable_folders.inquiry_id` are `ON DELETE RESTRICT`. (Deleting a *project* still removes that project's own folders and files — that is an explicit action with its own confirmation.)
* **Permanent delete** is a separate API only (`GET /api/admin/inquiries/:id/purge` previews, `POST` with `{"confirm":"<inquiry id>"}` deletes). It requires admin, an archived inquiry, no client/company/project linked to it, and no delivery folders or files; it removes the lead's own attachments and is audited (`inquiry.purge`). There is no UI for it and no `DELETE` handler.
* Recovery: archived inquiries are fully restorable. For anything permanently deleted, restore from a database backup (see Phase 08).

## Manual verification (what the automated tests cannot prove)
Run on the deployed site after the setup above:
1. Admin → a folder → upload a ~1 MB, a ~10 MB and a ~25 MB file: each shows a progress bar and appears when done. Upload a PNG that is really a renamed `.exe`: it is rejected with a message and doesn't appear.
2. As the client (portal), open and download all three. As a *different* client, try the first one's `/api/deliverables/<id>` URL: 404.
3. Share a folder, open the link in a private window, download the 25 MB file. Rotate the link: the old URL is 404 within seconds; the new one works. Turn sharing off then on: yet another URL.
4. Start-a-Project form: attach an 8 MB file; the button shows upload progress; the admin inquiry shows the file.
5. Archive an approved inquiry: the client still sees their files; Restore it.
6. Wait ~1 minute after starting an upload without finishing it, then check (SQL) that a `PENDING` row exists, and again after the sweep that it is gone.

### Tests
`npm test` covers content validation (including disguised/corrupt/bomb-like inputs), the upload → verify → ready flow and its cleanup, signed-link and cross-client authorization, watermark fail-closed behaviour, link rotation/revocation, archive/purge guards, the existing-file migration tool, and — on a real in-process Postgres built from the migration files — the FK and idempotency guarantees. **Not covered:** real Supabase Storage behaviour and real Vercel limits; that is what `scripts/verify-storage.mjs` and the checklist above are for.

