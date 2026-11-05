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
| `APP_URL` | **Yes** for SEO | Public origin of the deployed site (e.g. `https://dreamable.studio`). Canonical links, `sitemap.xml`, `robots.txt`, Open Graph URLs and structured data are built from it; unset, they point at `http://localhost:3000`. Must be set at **build** time too (static pages bake it in) |
| `SESSION_SECRET` | **Yes** | Signs session cookies. ≥ 32 random chars. `openssl rand -hex 32` |
| `SUPABASE_URL` | For large files | Project URL of the Supabase project that holds the file bucket |
| `SUPABASE_SERVICE_ROLE_KEY` | For large files | Server-only key used to issue upload/download links. Never expose to the browser. |
| `STORAGE_BUCKET` | No | Private bucket name (default `dreamable-files`) |
| `CRON_SECRET` | For cron jobs | Authorises `/api/cron/cleanup-uploads` and `/api/cron/process-email-outbox` (≥ 16 chars) |
| `EMAIL_TRANSPORT` / `EMAIL_DEV_ALLOWLIST` | No | Local/preview email behaviour — see *Email*. Real email is only sent from production. |
| `TRUSTED_PROXY` | No | Which proxy headers identify the visitor's IP for rate limiting (`vercel`, `hops:N`, or unset). Automatic on Vercel. |
| `RESET_SECRET` | **Yes** | Keys the stored hash of password-reset links. ≥ 32 random chars, different from `SESSION_SECRET`. |

Outgoing email is queued and retried (see *Email, notifications & the admin menu*). Without SMTP settings, production emails fail visibly in the admin instead of being skipped silently; non-production environments never send to real recipients.

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
| `INVITED` | no | yes — an **invitation link** (or the emailed code on the sign-in page) completes setup and activates the account | Created by inquiry approval or "Add client"; has no password until then |
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

---

## Email, notifications & the admin menu

### How email is sent (`lib/emailOutbox.ts`)
Nothing is sent from inside a request any more. Instead:
1. **Queue.** The thing that needs an email writes a row to `email_outbox` *in the same database transaction*: a saved inquiry queues the staff alert and the customer acknowledgement; approving an inquiry or adding a client queues the portal invitation; "forgot password" / "email me a code" queue a reset email. If the inquiry is saved, its emails are queued — and if SMTP is down, the inquiry is still saved and its emails wait.
2. **Send.** The worker (`processOutbox`) sends due rows. It is started right after the response (`after()`, Next's supported post-response hook) for speed, **and** by the retry job, **and** whenever staff open the admin (anything due gets another try), **and** by the *Retry* buttons. Each row is claimed with a compare-and-set update, so any number of workers can run at once and each email is sent by one of them; a worker that dies mid-send just lets its 2-minute claim expire.
3. **Retry.** A failure waits 1 min → 5 min → 20 min → 1 h → 3 h → 6 h → 12 h, then after 8 attempts the email is `DEAD`: staff get an **Email failed** notification (and an alert-level `[security]` log line `email.gave_up`) and see it under *Notifications → Email delivery* with **Retry now** / **Retry all failed**. A `SENT` email can never be retried or re-sent.
4. **What is stored.** A job holds the event type, recipient, a dedupe key and **references (ids) only**. The email text is built from current data when it is sent, and reset links / recovery codes are *created at send time*, so no token, code or password is ever in the queue (only the recipient address, which is needed). Errors are stored with addresses, long tokens and SMTP credentials redacted; the admin list masks recipients (`j••@example.com`) and shows no content. Sent/suppressed rows are deleted after 90 days.
5. **No duplicates.** Each event has a unique dedupe key (`inquiry.notification:<id>`, `invite:<userId>`, …), so a retried request or a double click queues one email; reset/code requests are additionally bucketed per 15 seconds and rate limited. Delivery is *at-least-once*: if a server dies in the instant after SMTP accepted a message but before the row was marked sent, it could be sent again; every message carries a stable `Message-ID` (`outbox-<id>@…`) so that is recognisable.

**Reset / code requests never reveal whether an account exists:** the route only checks eligibility and queues, takes the same time, and always answers `ok`.

### Execution: what runs the retries
`vercel.json` runs `/api/cron/process-email-outbox` and `/api/cron/cleanup-uploads` **once a day** — the most the Vercel Hobby plan allows (a more frequent schedule would make a Hobby deployment fail). Because that is slow for retries, the immediate `after()` send and the "admin opened" trigger do the real work; the daily job is the backstop. **For minutes-level retries**, change the schedule to `*/5 * * * *` on Vercel Pro, or call the endpoint from any scheduler (GitHub Actions, Supabase `pg_cron` + `pg_net`, an uptime pinger) with `Authorization: Bearer $CRON_SECRET`.

### SMTP and where email is really sent
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `INQUIRY_FROM_EMAIL`, `INQUIRY_TO_EMAIL` in Vercel (Production). Connection/greeting/socket timeouts are bounded so a dead mail server can't hang a function. In production a missing setting is no longer silently skipped: the email fails, retries, and shows up for staff.

Real delivery happens **only on a production deployment**:

| Environment | Behaviour |
|---|---|
| Production | real SMTP |
| Vercel preview, local dev | **suppressed** (recorded as "not sent: this environment does not deliver real email") |
| …with `EMAIL_DEV_ALLOWLIST=you@x.com,@yourteam.com` | really sent, but **only** to those addresses/domains |
| …with `EMAIL_TRANSPORT=console` (dev only) | printed to the server console, incl. reset links |
| Automated tests | kept in memory; nothing leaves the process |

### Admin notifications
*Notifications* shows real events only, newest first, with an unread badge on the menu icon, All / Unread filter, **Mark all as read** and "Show older" paging. Per-admin read state is stored on the server (survives refresh; one admin reading an item doesn't hide it from another). Clicking an item opens the record (inquiry, project/folder, clients) without a page load. Events (each recorded once, via a unique key): a **new inquiry**, an **approval** (with the invitation queued), a **client activating** their account, a **file uploaded** to a folder, a **guest comment** (flagged if it awaits review), and **email delivery failure**. Everything is served from admin-only endpoints (`/api/admin/notifications`, `/api/admin/email-outbox`); anonymous → 401, customer → 403. Notifications older than 180 days are removed by the daily job.

Deferred: project status/edit events, per-user notification preferences, email/push digests.

### Admin menu
The *Workspace* entry held a single shortcut (Generate invoice) that Billing → Invoices already provides ("New invoice"), so it has been removed rather than renamed; old `?view=workspace` links open Billing. The *Notifications* screen no longer shows "Coming soon". Nothing else in the navigation changed.

### Deploying
1. Run `prisma/migrations/20261105020000_email_outbox_notifications/migration.sql` in the Supabase SQL editor **first** (additive; the inquiry form writes to the new tables).
2. Make sure the SMTP variables and `CRON_SECRET` are set for Production, then deploy.
3. Rollback: redeploying the previous version is safe — the new tables are simply unused. (Emails queued but unsent at that moment stay in the table; you can send them later by redeploying.)

### Manual verification (what the tests can't prove)
1. Submit the contact form in production: the staff alert and the customer acknowledgement arrive; *Notifications* shows "New inquiry from …" with an unread badge; clicking it opens the inquiry.
2. Break SMTP (wrong password in Vercel env, redeploy), submit again: the inquiry still appears in the admin; *Notifications → Email delivery* shows the emails waiting, then (after 8 failed attempts, or you can check the 1st retry) an *Email failed* alert. Restore the password and press **Retry all failed**: the emails arrive, once each.
3. Approve an inquiry: the client receives "Your Dreamable.studio client portal is ready"; setting a password creates a "… activated their account" notification.
4. On a preview deployment or locally, confirm a test inquiry does **not** email the customer.

`npm test` covers the outbox (outage, backoff, give-up, retry, concurrency, crash recovery, no secrets in the queue), mail-mode safety, notification endpoints and event wiring, and — on a real in-process Postgres built from the migrations — the unique-key guarantees. **Not covered:** a real SMTP server, real Vercel Cron timing, and the visual layout of the new screen in a browser.

---

## Inquiry review & client onboarding

### Review workflow
Open an inquiry in **Admin → Inquiries**. Open (`INQUIRY`) inquiries show **Approve** and **Reject**; the status badge and filter distinguish *Inquiry / Approved / Rejected / Archived*.

| From | Action | To | Notes |
|---|---|---|---|
| Inquiry | **Approve** | Approved | Confirmation dialog lists what is created (client, company, project) and that an invitation email follows. Calls `POST /api/inquiries/:id/approve` (admin-only). Repeated clicks are harmless: the second answer is "already approved" and nothing is created or emailed again. |
| Inquiry | **Reject** (optional internal note) | Rejected | `POST /api/admin/inquiries/:id/reject`. Creates nothing, deletes nothing (attachments stay), **emails nobody**. Stores who/when/why; the note is shown only in the admin. |
| Rejected | **Reopen** | Inquiry | `POST /api/admin/inquiries/:id/reopen`. The only way back, so an approval never silently overrides a rejection. |
| Approved | Reject | — refused | It already has a client and project; archive it or manage the project instead. Its project is never touched. |
| Archived | any review action | — refused | Restore it first. |

Rules live in one place (`lib/inquiryReview.ts`). Approval refuses, with an actionable message: missing required fields (422); an email that already belongs to an account (409 `EMAIL_EXISTS` — **an existing account is never overwritten or re-pointed**; review it under Clients); a rejected or archived inquiry (409). Approval and rejection can't race each other (row lock / conditional update). If the invitation email later fails, the approval stands — the email is retried from the outbox.

### Invitations (no passwords are ever generated or emailed)
Approving an inquiry or adding a client creates an `INVITED` account **without a password** and queues an invitation. The email is built when it is sent and contains a single-use link (`/portal/reset-password?token=…`) for a **separate token purpose, `INVITE`**:

* valid **7 days**, one use; a password-reset link (`RESET`, **1 hour**) can't activate an invited account and an invitation can't be used on an active one;
* only works while the account is still `INVITED` — a suspended client can't activate through an invitation (checked again inside the same transaction as the password write);
* the setup page asks for a strong password (≥ 10 characters, not a common password, not containing the email — `lib/passwordPolicy.ts`, the same rule everywhere a password is chosen);
* sending a new invitation retires every older one, so only the newest link works.

**Admin visibility.** *Clients → Status* shows `Invitation queued / sent / failed / expired` under *Invited* clients, and approved inquiries show the same with **Resend invitation**; the *Mail* icon in the Clients row does the same (`POST /api/admin/users/:id/invite`). Resending is refused for active or suspended accounts, is a no-op while one is already on its way, and waits a minute after one was just sent; it is audited (`client.invite_resend`). Delivery failures retry through the outbox (see *Email*) and appear under *Notifications → Email delivery*. "Forgot password" on an account that was never set up sends a fresh invitation instead of a reset link.

### Adding a client (`POST /api/admin/clients`)
Name and email are validated; **role and status can't be chosen** (always `CLIENT` / `INVITED` — anything else is a 400, and the Add Client dialog no longer offers them). Company, user and invitation are created in **one transaction**: a duplicate email (checked first, and again by the database if it races) or any failure leaves **no orphan company** and nothing else behind. Companies are chosen explicitly (existing-company list) or created new; typing a name that already exists asks "use that one / it's a different company" instead of merging or silently duplicating.

### Customer account (portal)
*Your account* on the customer dashboard (collapsed by default): change **name**; change **password** (requires the current password, rate limited, strength rules, signs out every *other* device while this one continues on a fresh session); email and company are shown and changed by the studio. The endpoints (`/api/account/profile`, `/api/account/password`) always act on the signed-in user — there is no id in the request — and refuse any other field (`email`, `role`, `admin`, `status`, `company`…) with a 403. Changing the email address from the portal is deliberately not offered (it is the sign-in identity and would need a verified confirmation flow); contact the studio.

### Admin profile (`PUT /api/admin/profile`)
The user and company changes are one transaction (an email conflict after the company was updated undoes the company update; the conflict is also checked before anything is written). The session cookie is re-issued only after the commit, from the database's role. A company that other people belong to is never edited from one member's profile: the admin gets a company of their own instead. A new email address ends the admin's other sessions (the cookie issued here carries the new version).

### Deploying
1. Run `prisma/migrations/20261105030000_review_and_invitations/migration.sql` first (additive). It also clears the never-usable random password hash of invited clients who have never signed in — they get in through an invitation (**Clients → Resend invitation**), not by anything stored.
2. Deploy. Invitations are only queued for approvals and clients created from now on; **already-invited clients are not emailed automatically** (use Resend). Reset links issued before the deploy keep working for ≤ 1 hour.
3. Rollback: the previous release still runs against the new columns.

### Manual verification
1. Submit the contact form → the inquiry appears; open it → **Approve**: dialog → confirm; the badge becomes *Approved*, the client appears under Clients as *Invited · Invitation queued → sent*, the project under Projects.
2. Open the invitation email, click the link, set a weak password (refused) then a good one → you land on sign-in; sign in. The admin gets an "activated their account" notification. Click the link again: refused.
3. Add a client with an email that exists → clear message, no stray company. Add one with a company name that exists → the use-it/different prompt.
4. Reject a second inquiry with a note → *Rejected*, no client/email; **Reopen**, then approve.
5. As the client: *Your account* → change name (header updates) and password (other browser is signed out).

`npm test` covers all of the above — including the full inquiry → approval → invitation email → activation → sign-in journey, expired/reused/replaced/suspended-holder invitations, outage and resend paths, atomic rollbacks, privilege-escalation attempts and the migration backfill on a real in-process Postgres. **Not covered:** real email delivery and how the new dialogs look in a browser.


---

## Invoices & billing

Invoices are created and edited by staff (**Admin → Billing → Invoices**); customers can see and download their own issued invoices (**Dashboard → Invoices**). **There is no payment processing of any kind** — no checkout, card or provider integration, and no pay button; "Paid" is just a status staff record.

### Money rules (`lib/money.ts`)
US dollars, calculated without floating point (amounts are parsed from text into scaled integers; the same code runs on the server, in the admin form and in the PDF):

* **Quantity** up to 4 decimals, **rate** up to 4 decimals, **tax rate** stored as a *fraction* with 6 decimals (`0.082500` = 8.25%; the form takes a percent).
* **Line total** = quantity × rate, rounded **half-up to the cent**. **Subtotal** = sum of the rounded line totals. **Tax** = subtotal × tax rate, rounded half-up once. **Total** = subtotal + tax. So the printed lines always add up to the printed total.
* Stored as `numeric` (`qty` 12,4 · `rate` 14,4 · `tax_rate` 9,6); the API carries them as text, never as JS numbers. Examples: 0.1 + 0.2 = $0.30 · 3 × $0.10 = $0.30 · 1.5 × $33.333 = $50.00 · 3 × $0.005 = $0.03.

### Numbering
`DS-YYYY-NNN`, assigned **by the server** from a per-year counter in the same transaction that saves the invoice, so simultaneous creations queue and each gets the next number; a failed save hands its number back. The form's number is only a suggestion (`GET /api/admin/invoices/next-number`, reserves nothing): while it is untouched the server assigns a fresh one, so a stale suggestion can't collide. A number typed by hand must be unused (clear 409, also case/space-insensitive); the counter skips hand-typed numbers. Gaps are possible (a number typed by hand that the counter skips; an invoice later removed) but numbers are **never reused**. A unique index backs this up at the database. **An issued invoice (anything but Unsent) keeps its number**; a draft may be renumbered.

### Validation (`lib/invoiceValidation.ts`, same rules for create and edit; field-level 422s)
Real calendar dates (`YYYY-MM-DD`, due ≥ issue) · status ∈ Unsent / Not Paid / Paid · client required (a real, non-admin account) · quantity > 0 and ≤ 1,000,000 · rate ≥ 0 and ≤ $10,000,000 · tax 0–50% · 1–100 line items · total > $0 and ≤ $1 billion · no NaN/Infinity/negative/exponent values, no more decimals than stored (input is refused, never silently rounded) · 64 KB request cap.
**Status changes:** Unsent → Not Paid → Paid, and **Paid → Not Paid** as a correction. An issued invoice never goes back to Unsent. **A Paid invoice is closed**: nothing can change until it is put back to Not Paid (on its own), then edited. The database also has `CHECK` backstops (`NOT VALID`, so they apply to new/edited rows without touching old ones).

### Clients & projects
Each invoice is **linked** to a real client account (required for new invoices; optional project). The project must be that client's own or belong to their company — another customer's project is refused. The printed billing name, email, company and project name are kept as **snapshots** on the invoice, so history survives renames. Deleting a client/project never deletes an invoice (links are set to null).

### Customers
*Dashboard → Invoices* lists invoices linked to **the signed-in account**, once **issued** (Not Paid / Paid; drafts are internal), with number, project, issued/due dates, amount, status and a derived "Past due" chip. **View** / **Download PDF** fetch `GET /api/invoices/:id`, which answers only for invoices linked to that account — anything else is a plain 404, so ids can't be probed. Company membership alone grants nothing. One shared rule (`customerInvoiceWhere`) decides visibility for both the page and the endpoint.

### Deploying (data first)
1. **Look before you leap (read-only):** run `prisma/audits/invoices_before_migration.sql` in the Supabase SQL editor to see duplicate numbers, invalid amounts/dates/statuses and which invoices could be linked.
2. **Run the SQL:** `prisma/migrations/20261105040000_invoice_integrity/migration.sql` (or the combined `prisma/APPLY_ALL_PENDING.sql`). It is idempotent and non-destructive: it converts Float → Decimal, then:
   * **Duplicate numbers are flagged (`number_conflict`), never renumbered.** The oldest keeps the number; the others show "Duplicate number — needs review" in the admin and must be given a new unused number by hand (Edit invoice).
   * **Links** are made only when an email belongs to exactly one client **and** the billed name, company or one of their projects also matches; a project is attached only if that client has exactly one project with that name. Everything else stays unlinked ("Not linked to a client" chip) and **customers cannot see it** until you edit it and choose the client.
   * Everything it finds is written to `invoice_migration_audit` (kinds: `DUPLICATE_NUMBER`, `LINKED_TO_CLIENT`, `LINKED_TO_PROJECT`, `LINK_UNMATCHED`, `LINK_AMBIGUOUS`, `LINK_UNCORROBORATED`, `TOTAL_WOULD_CHANGE`, `LOSSY_AMOUNT`, `INVALID_AMOUNT`, `INVALID_TAX`, `INVALID_DATE_OR_STATUS`).
3. **Review:** `SELECT kind, count(*) FROM invoice_migration_audit GROUP BY 1;` then fix the flagged invoices in the admin. **`TOTAL_WOULD_CHANGE`** lists any invoice whose total moves by a cent because lines are now rounded one by one (old: sum, then round) — a PDF regenerated for it will show the new figure; nothing in the database was rewritten. **`LOSSY_AMOUNT`** lists values with more than 4 decimals (rounded to 4 on conversion).
4. Deploy. Existing invoices keep working throughout; unlinked ones remain editable and downloadable by admins.
5. Rollback: the previous release can't read the new numeric types' text form cleanly, so roll *forward* (the data is intact); don't drop the new columns.

### Manual verification
1. Billing → New Invoice: the number is suggested; open a second browser tab, create an invoice there, then save the first: it gets the *next* number, not a duplicate. Type an existing number: clear "already in use" message.
2. Create an invoice with 1.5 × $33.333 and 3 × $0.10 at 8.25%: form total, list total and PDF all show $54.45.
3. Try a negative quantity or a due date before the issue date by editing the request in the browser dev tools: the server refuses it.
4. Create an invoice for a client, set it to *Not Paid*: sign in as that client — it appears under Invoices; download the PDF. Sign in as another client: it doesn't. Set it back to *Unsent*… it can't (Not Paid → Unsent is refused); a *Unsent* draft is not visible to the client.
5. Mark an invoice *Paid*, then try to edit it: refused until set back to *Not Paid*.

### Known limitations / deferred
* The PDF's **"Payment methods"** block (bank transfer / card / PayPal wording) is the studio's existing static text and is unchanged; it describes how to pay offline and is not connected to anything. Edit `lib/generateInvoice.ts` if you want it reworded now that customers can download invoices.
* Invoices can't be deleted (they are records). Company-wide invoice access (several users of one company seeing the same invoices) isn't implemented — access is per client account.
* Currency is USD only. There is no emailing of invoices.
* `npm test` covers the money vectors, validation, numbering under parallel load on a real Postgres, the migration on a messy legacy dataset, authorization and the PDF/API/form agreement. **Not covered:** the visual layout of the new form and customer panel, and the PDF file's appearance (the test checks the figures it would print).

## Website consistency, SEO, performance & accessibility

### Service names (one catalog)
`lib/services.catalog.mjs` is the only list of services. Each has a permanent `id` (`web-development`, `brand-identity`, `ui-ux-design`, `marketing`, `consulting`, `support`, `other`), a display `label`, legacy `aliases`, its deliverable categories and its sub-categories. The home and contact forms (`intakeOptions()`), the intake and approve APIs, the admin project API, deliverable categories, admin pickers/icons, emails, `prisma/seed.mjs` and the SQL migration all read it. What is stored in `inquiries.service`, `projects.service` and `services.name` is the label, so a label is a stable key: to rename one, keep the old text in `aliases` and add a migration like the one below.
* **"Branding & Identity" / "Branding & Logo" are now "Brand Identity".** Matching ignores case, spacing and `&`/`and`. Unrecognised values are never rewritten, dropped or blanked.
* "Marketing & Ads" was offered on the contact form but defined nowhere else; it is now a real service. **The home form therefore shows a sixth card, "Marketing & Ads"** (an intentional, visible change).
* The services *page* headings ("Logo & Branding Design", "Software Development", …) are marketing copy, not intake names, and were left alone.

### Deploying (data first)
1. **Run the SQL first.** In the Supabase SQL editor run the last section of `prisma/APPLY_ALL_PENDING.sql` (`20261105050000_canonical_services`), or the earlier sections too if you haven't applied them. Additive and idempotent: it rewrites only recognised legacy spellings, folds a duplicate legacy row in `services` into the canonical one (moving its sub-categories), deletes nothing else, and logs every change to `service_migration_audit`. Review it with the queries at the end of the file.
2. Deploy the code, then optionally `npm run seed` (idempotent; it reconciles legacy rows and fills in missing services/sub-categories).
3. Set `APP_URL` (build and runtime).

### Removed: `public/cast/`
`public/cast/sender|receiver/index.html` were an unrelated "DRMVYZ" Google Cast demo. Nothing in the app, config or middleware referenced them. They are deleted; `tests/publicAssets.test.ts` fails if they return, if any `/images/…` or `/fonts/…` path in the code points at a missing file, or if an oversized or unreferenced file appears in `public/`. `public/images/hero.jpg` is referenced nowhere; it was left for you to decide. The 2 MB master logo moved to `design-source/logo_transparent.png`; the site uses a 256 px `public/images/logo.png` (63 KB).

### SEO (`lib/site.ts`)
* Every indexable page (`/`, `/about`, `/services`, `/contact`) has its own title, description, canonical URL and Open Graph/Twitter metadata, all built from `INDEXABLE_PAGES` and `APP_URL`. `app/sitemap.ts` is generated from the same list; `app/robots.ts` points at it.
* **Not indexed:** `/admin`, `/dashboard`, `/portal` (sign-in and reset links), `/share/*` and `/api/*`: `noindex` metadata, an `X-Robots-Tag` header (`next.config.ts`) and, for reset/share links, `Referrer-Policy: no-referrer` because their address carries a token. The portal sign-in page is noindex on purpose (no search value), which is why Lighthouse's SEO score for `/portal` is 66. **`robots.txt` is a request to crawlers, not access control**; those areas are protected by sign-in or unguessable tokens.
* `public/og.png` (1200×630) and `app/icon.png` / `app/apple-icon.png` are generated by `node scripts/generate-brand-images.mjs` from the master logo.
* Structured data is a single `Organization` on the home page with only facts published on the site (name, URL, logo, description). No address, phone or e-mail is claimed because none is published.
* Verified on a production build: titles/canonicals/OG/Twitter/JSON-LD per page, `sitemap.xml`, `robots.txt`, 404 status with `noindex`, `/og.png` resolving, `/cast/…` returning 404.

### Performance
* The animated backdrop (`SplineBackground`, now a still gradient/glow/curves version that lazy-loads `AnimatedBackground`), the hero ribbons, the hero cube and the home page's interactive illustrations only run after first paint, **while on screen and while the tab is visible**, and are unmounted otherwise (`components/OnlyWhenActive.tsx`, `hooks/use-animation-active.ts`). Their code is fetched on demand (`next/dynamic`). The backdrops and ribbons show a still version for visitors who prefer reduced motion or have data-saver on; the illustrations render with movement switched off. If the animation code fails to load, the still version stays; the portal does not depend on it.
* The whole site is wrapped in `MotionConfig reducedMotion="user"`; `globals.css` disables smooth-scroll and CSS animations under `prefers-reduced-motion`.
* Fixed: the hero's connection lines used percentage coordinates inside SVG path data (invalid; 6 console errors per load). They are now `<line>` elements, so **those dashed lines and their travelling dots are now actually visible** (a small intentional visual change). The services page's five 220 KB carousel `<img>` tags now go through `next/image`.
* Measured on production builds served locally (`next start`), Lighthouse via its Node API with the system Google Chrome (headless), *mobile* = Lighthouse's default Moto G Power emulation with simulated slow 4G and 4× CPU slowdown, *desktop* = 1350×940, 10 Mbps / 40 ms RTT, no CPU slowdown. Home: median of 3 runs; other pages: one run each, so small differences (a few hundred ms of LCP) are within noise. Idle CPU/heap: Playwright + CDP `Performance.getMetrics` over a 3 s idle window after load, 390×844 mobile and 1350×940 desktop. The measurement scripts were throwaway and are not in the repo.

| Page (device) | Perf before → after | LCP ms | TBT ms | CLS | Transfer KB | JS KB | Image KB | Main-thread ms | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| Home (mobile) | 95 → 96 | 2862 → 2826 | 18 → 12 | 0 → 0 | 355 → 403 | 194 → 197 | 47 → 47 | 2602 → 1307 | 6 → 0 |
| Home (desktop) | 100 → 100 | 245 → 245 | 0 → 0 | 0 → 0 | 337 → 387 | 194 → 198 | 29 → 29 | 635 → 374 | 6 → 0 |
| Services (mobile) | 100 → 100 | 904 → 904 | 18 → 12 | 0 → 0 | **1438 → 356** | 194 → 195 | **1135 → 2** | 667 → 586 | 1 → 0 |
| Services (desktop) | 100 → 100 | 246 → 246 | 0 → 0 | 0 → 0 | **1437 → 383** | 194 → 195 | **1134 → 29** | 148 → 194 | 1 → 0 |
| Contact (mobile) | 100 → 100 | 904 → 904 | 36 → 10 | 0 → 0 | 309 → 364 | 197 → 203 | 2 → 2 | 334 → 324 | 1 → 0 |
| Portal (mobile) | 94 → 92 | 3021 → 3311 | 22 → 21 | 0 → 0 | 310 → 368 | 197 → 205 | 2 → 2 | 966 → 943 | 1 → 0 |
| Portal (desktop) | 100 → 100 | 632 → 692 | 0 → 0 | 0 → 0 | 309 → 367 | 197 → 205 | 1 → 1 | 269 → 250 | 1 → 0 |

| Idle (3 s, after load) | CPU % before → after | Script % | Heap MB | JS errors |
|---|---|---|---|---|
| Home, mobile | 20.7 → 13.1 | 6.2 → 2.7 | 8.2 → 5.4 | 6 → 0 |
| Home, desktop | 19.3 → 11.7 | 4.4 → 2.4 | 5.7 → 5.6 | 6 → 0 |
| Portal, mobile | 9.6 → 6.7 | 2.1 → 1.5 | 5.9 → 6.8 | 1 → 0 |
| Portal, desktop | 9.2 → 7.5 | 2.0 → 1.6 | 5.8 → 6.1 | 1 → 0 |

Reading the numbers honestly: the big wins are the services page payload (−1.1 MB), main-thread time and idle CPU on the home page, and no console errors. **Transfer rose ~50 KB on every page** because the site now has a favicon (before, `/favicon.ico` was a 404); that table was captured with a 50 KB icon, which was then shrunk to 5 KB and **not re-measured**. Shared JS grew 1–8 KB (motion preferences + animation gating). **Portal mobile LCP and score are slightly worse (about +300 ms, 94 → 92)**; with one run per page I can't tell whether that is noise or real, and I didn't investigate. Remaining idle CPU on the home page is mostly rendering (blurred glows, backdrop blur), not script. Performance numbers were taken before the final navbar and accessibility edits and were not repeated.

### Accessibility & mobile
Scanned with axe-core (WCAG 2.0/2.1/2.2 A+AA and best-practice rules) at 390 px and 1350 px, plus Playwright checks for reflow (320 px, 360 px, 200 % zoom), tap targets, tab order/focus indicators and form error announcements, on a production build of `/`, `/about`, `/services`, `/contact`, `/portal` and `/portal/reset-password`.

| | Before | After |
|---|---|---|
| axe violations (6 pages × 2 widths) | 7 of 12 page-width scans had violations (hidden focusable element, 1.9:1 select placeholders and 2.3:1 / 3.5:1 grey text, **unnamed Remember-me switch (critical)**) | **0** |
| Horizontal overflow at 320 px | all pages (nav 357 px wide; About heading 418 px) | none at 320 / 360 / 200 % zoom |
| Nav links | 18–20 px tall | 44 px tall hit areas |
| Empty contact form submit | nothing announced | "Name is required." announced (`role="alert"`), `aria-invalid` + `aria-describedby` set |
| Keyboard focus on portal | Remember-me switch and password toggle had no indicator / were skipped | visible indicators; password toggle is now reachable by keyboard |

What changed: contrast fixes (placeholder and helper greys to `#6b6b6b`/`#707070`); accessible names; `aria-invalid`/`aria-describedby`/`role="alert"` on both inquiry forms; `<DialogFocus>` (`components/DialogFocus.tsx`, `hooks/use-dialog-focus.ts`) added to all five modal dialogs (file preview, deliverables dialogs, archive confirmation, inquiry review dialogs, shared-folder comments) so focus moves in, Tab stays inside, Escape closes and focus returns to the opener; the navbar compacts and wraps below 380 px; the About heading wraps on tiny screens.

**Not verified by tools:** the admin and customer dashboards and the share page need a database login/token, so they were *not* scanned. The dialog focus behaviour is implemented but was **not exercised in a browser** (only its build and type-check). Please run this smoke test by hand:
1. Tab through each public page: focus order follows the page and every stop is visible. Zoom to 200 % and resize to 320 px: no sideways scrolling.
2. Submit the contact form empty with a screen reader (or VoiceOver): the error is announced and the field is marked invalid.
3. Admin → Inquiries → Archive: focus lands inside the dialog, Tab/Shift+Tab stay inside, Escape closes it and returns focus to the Archive button. Repeat for the file preview, a folder dialog, and the shared-folder comments dialog.
4. Turn on "Reduce motion" in the OS: the home page backdrop and hero are still, nothing drifts, the site otherwise works.
5. Check tap targets on a phone: nav links, Remember-me, Forgot password.

### Tests
`npx vitest run` (service catalog, seed, migration on a messy legacy dataset in an in-process Postgres, SQL ↔ catalog sync, SEO metadata/sitemap/robots/OG image/structured data, public-folder hygiene). `npx tsc --noEmit` is clean. `npx eslint .` still reports 4 errors and 1 warning that were already there (two `react-hooks/refs` in `AdminDashboardClient.tsx`, one `set-state-in-effect` in the reset-password page, one unused disable directive).

### Known limitations / deferred
* `@splinetool/react-spline` and `@splinetool/runtime` are still in `package.json` but nothing imports them; removing them is a separate dependency change.
* `components/HeroCarousel.tsx` is unused dead code (its import was removed from the home page).
* A route-level `not-found` page and a `prefers-reduced-motion` setting for the infinite animations inside the illustrations (they render without movement, but gentle opacity pulses can remain) are not done.
