import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { customerInvoiceWhere, toInvoiceView, totalsFor } from '@/lib/invoiceService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

// Read-only invoice data for the signed-in customer's own PDF. Ownership comes from the authenticated account and the
// invoice's stored client link — never from anything the browser sends — and drafts are never shown. Anything that
// isn't theirs is simply "not found", so invoice ids can't be probed. (There is no payment of any kind here.)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  try {
    const row = await prisma.invoice.findFirst({
      where: auth.user.admin ? { id } : { id, ...customerInvoiceWhere(auth.user.id) },
      include: { lineItems: true },
    });
    if (!row) return notFound();
    const invoice = toInvoiceView(row);
    return NextResponse.json({ ok: true, invoice, totals: totalsFor(invoice) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[invoices GET]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
