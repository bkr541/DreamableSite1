import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { outboxProblems } from '@/lib/emailOutbox';

// Admin-only: which emails failed or are waiting to retry. Recipients are masked and no content or secrets are returned.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, ...(await outboxProblems()) });
  } catch (err) {
    console.error('[admin/email-outbox GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
