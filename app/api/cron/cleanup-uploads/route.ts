import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { sweepAbandonedUploads } from '@/lib/uploadFlow';

// Daily safety net (see vercel.json): removes uploads that never completed. Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET set this endpoint refuses every request.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const ok = !!secret && secret.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    return NextResponse.json({ ok: true, removed: await sweepAbandonedUploads() });
  } catch (err) {
    console.error('[cron cleanup-uploads]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
