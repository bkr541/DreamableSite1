// Copies files that still live in the database (deliverables.data / inquiry_attachments.data) into private object
// storage, one file at a time, and PROVES each copy before recording it. Nothing is deleted unless you ask.
//
//   node --env-file=.env.local scripts/migrate-files-to-storage.mjs              # dry run: lists what would move
//   node --env-file=.env.local scripts/migrate-files-to-storage.mjs --apply      # copy + verify + record storage_key/sha256
//   node --env-file=.env.local scripts/migrate-files-to-storage.mjs --purge-db-bytes --i-have-a-backup
//        # LATER, once you've checked the app: re-verify each stored copy, then clear the database bytes
//
// Safe to re-run: files already migrated are skipped. While both copies exist the app reads from storage and falls
// back to the database copy, so nothing is ever unavailable.
import { createHash } from 'crypto';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const enc = (key) => key.split('/').map(encodeURIComponent).join('/');

export function restStorage({ url, key, bucket }) {
  const base = `${url.replace(/\/+$/, '')}/storage/v1`;
  const h = { Authorization: `Bearer ${key}`, apikey: key };
  return {
    async put(k, bytes, contentType) {
      const res = await fetch(`${base}/object/${bucket}/${enc(k)}`, { method: 'POST', headers: { ...h, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'false' }, body: bytes });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
    },
    async get(k) {
      const res = await fetch(`${base}/object/${bucket}/${enc(k)}`, { headers: h });
      if (!res.ok) throw new Error(`read failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

const TABLES = [
  { model: 'deliverable', prefix: 'deliverables' },
  { model: 'inquiryAttachment', prefix: 'inquiries' },
];

/** `prisma` and `storage` are injected so this can be tested without a database or a bucket. */
export async function migrate({ prisma, storage, apply = false, purge = false, log = console.log }) {
  const summary = { found: 0, copied: 0, skipped: 0, failed: 0, purged: 0 };

  for (const { model, prefix } of TABLES) {
    if (!purge) {
      const rows = await prisma[model].findMany({ where: { storageKey: null, status: 'READY', NOT: { data: null } }, select: { id: true, fileName: true, size: true, contentType: true } });
      for (const row of rows) {
        summary.found++;
        if (!apply) { log(`[dry-run] ${model} ${row.id}  ${row.fileName}  ${row.size} bytes`); continue; }
        try {
          const full = await prisma[model].findUnique({ where: { id: row.id }, select: { data: true } });
          const bytes = Buffer.from(full.data);
          const key = `${prefix}/${row.id}`;
          await storage.put(key, bytes, row.contentType);
          const back = await storage.get(key);                       // read it back and compare checksums
          if (sha(back) !== sha(bytes) || back.length !== bytes.length) throw new Error('checksum mismatch after upload');
          await prisma[model].update({ where: { id: row.id }, data: { storageKey: key, sha256: sha(bytes) } });
          summary.copied++;
          log(`copied   ${model} ${row.id}  ${row.fileName}`);
        } catch (err) {
          summary.failed++;
          log(`FAILED   ${model} ${row.id}  ${row.fileName}: ${err.message}`);   // original bytes untouched
        }
      }
    } else {
      const rows = await prisma[model].findMany({ where: { NOT: [{ storageKey: null }, { data: null }] }, select: { id: true, storageKey: true, sha256: true, fileName: true } });
      for (const row of rows) {
        summary.found++;
        try {
          const back = await storage.get(row.storageKey);
          if (!row.sha256 || sha(back) !== row.sha256) throw new Error('stored copy does not match its recorded checksum');
          await prisma[model].update({ where: { id: row.id }, data: { data: null } });
          summary.purged++;
          log(`cleared database bytes  ${model} ${row.id}  ${row.fileName}`);
        } catch (err) {
          summary.skipped++;
          log(`kept database bytes     ${model} ${row.id}  ${row.fileName}: ${err.message}`);
        }
      }
    }
  }
  return summary;
}

// ── CLI ──
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Set(process.argv.slice(2));
  const purge = args.has('--purge-db-bytes');
  if (purge && !args.has('--i-have-a-backup')) {
    console.error('Refusing to clear database bytes without --i-have-a-backup. Take a database backup first (Supabase → Database → Backups).');
    process.exit(1);
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET = 'dreamable-files' } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const summary = await migrate({ prisma, storage: restStorage({ url: SUPABASE_URL, key: SUPABASE_SERVICE_ROLE_KEY, bucket: STORAGE_BUCKET }), apply: args.has('--apply'), purge });
    console.log('\nSummary:', summary);
    if (!args.has('--apply') && !purge) console.log('Dry run only. Re-run with --apply to copy.');
    process.exitCode = summary.failed ? 2 : 0;
  } finally {
    await prisma.$disconnect();
  }
}
