import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { prisma } from '@/lib/prisma';
import { processOutbox } from '@/lib/emailOutbox';

const DAY = 24 * 60 * 60 * 1000;

// The retry worker. Run it as often as your plan allows (see README → Email): every few minutes on Vercel Pro, or
// from any scheduler that can send the Authorization header. It also sends anything left over from a request that
// was cut short, and trims old records.
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    const result = { sent: 0, retry: 0, dead: 0, suppressed: 0 };
    // A few rounds, so a backlog after an outage clears in one run without holding the function open for long.
    for (let round = 0; round < 5; round++) {
      const r = await processOutbox({ limit: 20 });
      const n = r.sent + r.retry + r.dead + r.suppressed;
      for (const k of Object.keys(result) as (keyof typeof result)[]) result[k] += r[k];
      if (n < 20) break;
    }

    // Retention: delivered/ suppressed email rows hold a recipient address, so they don't live forever;
    // failed ones stay until staff deal with them. Notifications are kept for six months.
    const pruned = await Promise.all([
      prisma.emailOutbox.deleteMany({ where: { status: { in: ['SENT', 'SUPPRESSED'] }, createdAt: { lt: new Date(Date.now() - 90 * DAY) } } }),
      prisma.adminNotification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 180 * DAY) } } }),
    ]);
    return NextResponse.json({ ok: true, ...result, pruned: { emails: pruned[0].count, notifications: pruned[1].count } });
  } catch (err) {
    console.error('[cron process-email-outbox]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
