import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { headerText, safeEmailAddress } from '@/lib/html';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number, extra: object = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });
const EMAIL_TAKEN = 'An account with that email address already exists.';

// Adds a client. Every client starts INVITED with no password: they choose their own through the emailed
// invitation, nobody is ever given (or emailed) a password. Admins cannot set a client's role or status here —
// those are fixed server-side, so a crafted request can't create a privileged or pre-activated account.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('We could not read that request.', 400);

  if (body.role !== undefined && body.role !== 'CLIENT') return fail('Only client accounts can be created here.', 400);
  if (body.status !== undefined && body.status !== 'INVITED') return fail('New clients always start as invited.', 400);

  const name = typeof body.name === 'string' ? headerText(body.name, 120) : '';
  const email = typeof body.email === 'string' ? safeEmailAddress(body.email)?.toLowerCase() : null;
  if (!name) return fail('Name is required.', 400);
  if (!email) return fail('A valid email address is required.', 400);

  const companyId = typeof body.companyId === 'string' && body.companyId ? body.companyId : null;
  const companyName = typeof body.companyName === 'string' ? headerText(body.companyName, 200) : '';
  const companyWebsite = typeof body.companyWebsite === 'string' ? headerText(body.companyWebsite, 300) : '';
  if (companyId && !UUID.test(companyId)) return fail('Choose a company from the list.', 400);

  try {
    // Checked before anything is written, so a conflict leaves the database exactly as it was.
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return fail(EMAIL_TAKEN, 409, { code: 'EMAIL_EXISTS' });

    if (companyId) {
      if (!(await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }))) return fail('That company no longer exists.', 404);
    } else if (companyName && body.confirmNewCompany !== true) {
      // Companies are never merged by name. If one with this name exists, the admin picks it explicitly or confirms a separate one.
      const same = await prisma.company.findFirst({ where: { name: companyName }, select: { id: true, name: true } });
      if (same) return fail(`A company called “${same.name}” already exists. Choose it from the list, or confirm that this is a different company.`, 409, { code: 'COMPANY_EXISTS', company: same });
    }

    // Company, user and invitation are one unit: if any step fails (or the email is taken in the meantime),
    // none of them exists afterwards. The email itself is sent later, by the outbox, after this commits.
    await prisma.$transaction(async (tx) => {
      const linkedCompanyId = companyId ?? (companyName
        ? (await tx.company.create({ data: { name: companyName, website: companyWebsite || null, status: 'ACTIVE' }, select: { id: true } })).id
        : null);

      const user = await tx.user.create({
        data: { name, email, passwordHash: null, role: 'CLIENT', status: 'INVITED', invitedAt: new Date(), companyId: linkedCompanyId },
        select: { id: true, email: true },
      });

      await enqueueEmail(tx, {
        eventType: 'client.invitation', recipient: user.email, dedupeKey: `invite:${user.id}`,
        payload: { userId: user.id }, entityType: 'user', entityId: user.id,
      });
    });
    dispatchOutbox();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      return fail(EMAIL_TAKEN, 409, { code: 'EMAIL_EXISTS' });
    }
    console.error('[admin/clients POST]', err);
    return fail('Internal server error.', 500);
  }
}
