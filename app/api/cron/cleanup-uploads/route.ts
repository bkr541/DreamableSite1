import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { sweepAbandonedUploads } from '@/lib/uploadFlow';

// Daily safety net (see vercel.json): removes uploads that never completed.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    return NextResponse.json({ ok: true, removed: await sweepAbandonedUploads() });
  } catch (err) {
    console.error('[cron cleanup-uploads]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
