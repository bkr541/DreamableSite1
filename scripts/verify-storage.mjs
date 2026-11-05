// Proves the file path works on YOUR project and host, using the same calls the app makes.
//   node --env-file=.env.local scripts/verify-storage.mjs
// It uploads 1 MB, 10 MB and 25 MB test objects through signed upload URLs, reads them back through signed
// download URLs, checks that anonymous access to the bucket is refused, then removes everything it created.
// Nothing is printed that could be a secret.
import { createHash, randomBytes, randomUUID } from 'crypto';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_BUCKET = 'dreamable-files' } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).'); process.exit(1); }

const base = `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1`;
const auth = { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, apikey: SUPABASE_SERVICE_ROLE_KEY };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

const bucket = await fetch(`${base}/bucket/${STORAGE_BUCKET}`, { headers: auth });
if (!bucket.ok) { console.error(`Bucket "${STORAGE_BUCKET}" not found (${bucket.status}). Create it first (private).`); process.exit(1); }
const info = await bucket.json();
check('bucket exists and is PRIVATE', info.public === false, info.public ? 'it is public — turn Public off' : '');
console.log(`      bucket file size limit: ${info.file_size_limit ?? 'none (set it to 26214400 = 25 MB)'}`);

const created = [];
for (const mb of [1, 10, 25]) {
  const key = `verify/${randomUUID()}`;
  const bytes = randomBytes(mb * 1024 * 1024);
  created.push(key);
  try {
    const grant = await fetch(`${base}/object/upload/sign/${STORAGE_BUCKET}/${key}`, { method: 'POST', headers: { ...auth, 'x-upsert': 'false' } });
    check(`${mb} MB: signed upload URL issued`, grant.ok, `HTTP ${grant.status}`);
    const { url } = await grant.json();
    const t0 = Date.now();
    const put = await fetch(url.startsWith('http') ? url : `${base}${url}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    check(`${mb} MB: browser-style PUT accepted`, put.ok, `HTTP ${put.status}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const head = await fetch(`${base}/object/${STORAGE_BUCKET}/${key}`, { method: 'HEAD', headers: auth });
    check(`${mb} MB: size reported correctly`, Number(head.headers.get('content-length')) === bytes.length);
    const sign = await fetch(`${base}/object/sign/${STORAGE_BUCKET}/${key}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 30 }) });
    const { signedURL } = await sign.json();
    const dl = await fetch(`${base}${signedURL}&download=test.bin`);
    const got = Buffer.from(await dl.arrayBuffer());
    check(`${mb} MB: signed download returns identical bytes`, dl.ok && sha(got) === sha(bytes), `disposition: ${dl.headers.get('content-disposition') ?? 'none'}`);
  } catch (e) { check(`${mb} MB round trip`, false, e.message); }
}

const anon = await fetch(`${base}/object/public/${STORAGE_BUCKET}/${created[0]}`);
check('anonymous public URL is refused', !anon.ok, `HTTP ${anon.status}`);
const unsigned = await fetch(`${base}/object/${STORAGE_BUCKET}/${created[0]}`);
check('unsigned, unauthenticated read is refused', !unsigned.ok, `HTTP ${unsigned.status}`);
const bad = await fetch(`${base}/object/sign/${STORAGE_BUCKET}/${created[0]}?token=not-a-real-token`);
check('a forged signed-URL token is refused', !bad.ok, `HTTP ${bad.status}`);

const del = await fetch(`${base}/object/${STORAGE_BUCKET}`, { method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: created }) });
check('test objects removed', del.ok, `HTTP ${del.status}`);

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) FAILED — do not rely on direct uploads until these pass.` : '\nAll checks passed.');
console.log('Also check, on your deployed site: upload a 25 MB file in the admin and download it as a client (README → "Manual verification").');
process.exit(failed ? 1 : 0);
