import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { normalizeWebsite } from '@/lib/companyWebsite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admin-only: sets or clears a company's website (the "Company Information" group on a client).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, error: 'Company not found.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!('website' in body)) return NextResponse.json({ ok: false, error: 'Nothing to change.' }, { status: 400 });
  const site = normalizeWebsite(body.website);
  if (!site.ok) return NextResponse.json({ ok: false, field: 'website', error: site.error }, { status: 422 });

  try {
    const before = await prisma.company.findUnique({ where: { id }, select: { website: true } });
    if (!before) return NextResponse.json({ ok: false, error: 'Company not found.' }, { status: 404 });
    const company = await prisma.$transaction(async (tx) => {
      const c = await tx.company.update({ where: { id }, data: { website: site.value }, select: { id: true, website: true } });
      await recordAudit(tx, { actorId: auth.user.id, action: 'company.update_website', targetType: 'company', targetId: id, metadata: { from: before.website, to: c.website } });
      return c;
    });
    return NextResponse.json({ ok: true, company });
  } catch (err) {
    console.error('[admin/companies PATCH]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
