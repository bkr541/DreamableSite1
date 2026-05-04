import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  const {
    invoiceNumber, issueDate, dueDate,
    clientName, clientEmail, clientCompany,
    projectName, taxRate, lineItems,
  } = await req.json();

  if (!invoiceNumber?.trim()) return NextResponse.json({ ok: false, error: 'Invoice number is required.' }, { status: 400 });
  if (!clientName?.trim()) return NextResponse.json({ ok: false, error: 'Client name is required.' }, { status: 400 });
  if (!clientEmail?.trim()) return NextResponse.json({ ok: false, error: 'Client email is required.' }, { status: 400 });
  if (!projectName?.trim()) return NextResponse.json({ ok: false, error: 'Project name is required.' }, { status: 400 });
  if (!issueDate) return NextResponse.json({ ok: false, error: 'Issue date is required.' }, { status: 400 });
  if (!dueDate) return NextResponse.json({ ok: false, error: 'Due date is required.' }, { status: 400 });
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'At least one line item is required.' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: invoiceNumber.trim(),
          issueDate,
          dueDate,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientCompany: clientCompany?.trim() || null,
          projectName: projectName.trim(),
          taxRate: taxRate ?? 0,
          lineItems: {
            create: lineItems.map((item: { description: string; qty: number; rate: number }) => ({
              description: item.description,
              qty: item.qty,
              rate: item.rate,
            })),
          },
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/invoices PUT]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: process.env.NODE_ENV === 'development' ? msg : 'Internal server error.' },
      { status: 500 }
    );
  }
}
