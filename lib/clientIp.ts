import { isIP } from 'net';

// Which forwarded headers may be believed depends on the hosting setup. Believing them blindly lets any
// visitor send `X-Forwarded-For: <random>` and get a fresh rate-limit bucket on every request.
//
//   TRUSTED_PROXY=vercel   (default when running on Vercel) the platform overwrites the client-IP headers, so they are reliable.
//   TRUSTED_PROXY=hops:N   N trusted proxies append to X-Forwarded-For; the client is the Nth entry from the right.
//   unset / none           no proxy is trusted: forwarded headers are ignored and callers share one 'unknown' bucket.
type Env = Record<string, string | undefined>;

function mode(env: Env): { kind: 'vercel' } | { kind: 'hops'; n: number } | { kind: 'none' } {
  const raw = (env.TRUSTED_PROXY ?? (env.VERCEL ? 'vercel' : 'none')).trim().toLowerCase();
  if (raw === 'vercel') return { kind: 'vercel' };
  const m = /^hops:(\d{1,2})$/.exec(raw);
  if (m && Number(m[1]) >= 1) return { kind: 'hops', n: Number(m[1]) };
  return { kind: 'none' };
}

/** Canonical form used as a rate-limit identity. IPv6 is reduced to its /64 so one household can't rotate addresses. */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let ip = value.trim();
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  const kind = isIP(ip);
  if (kind === 4) return ip;
  if (kind !== 6) return null;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  // Expand "::" and keep the first four groups (the /64 network).
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  if (groups.length !== 8) return null;
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

export function getClientIp(headers: Pick<Headers, 'get'>, env: Env = process.env): string {
  const m = mode(env);
  if (m.kind === 'none') return 'unknown';

  const xff = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let candidate: string | null | undefined;
  if (m.kind === 'vercel') {
    candidate = headers.get('x-vercel-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip') ?? xff[0];
  } else {
    candidate = xff.length >= m.n ? xff[xff.length - m.n] : undefined;
  }
  return normalizeIp(candidate) ?? 'unknown';
}
