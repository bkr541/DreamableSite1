import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { peekInvoiceNumber } from '@/lib/invoiceNumbers';

// A suggestion for the form only: it reserves nothing. The number is really assigned when the invoice is saved.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ ok: true, invoiceNumber: await peekInvoiceNumber(prisma) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[admin/invoices next-number]', err);
    return NextResponse.json({ ok: false, error: 'Could not suggest a number.' }, { status: 500 });
  }
}
