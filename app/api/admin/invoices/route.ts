import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { invoiceNumber, issueDate, dueDate, clientName, clientEmail, clientCompany, projectName, taxRate, status, lineItems } =
    await req.json();

  if (!invoiceNumber?.trim() || !clientName?.trim() || !clientEmail?.trim() || !projectName?.trim() || !issueDate || !dueDate) {
    return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'At least one line item is required.' }, { status: 400 });
  }

  try {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNumber.trim(),
        issueDate,
        dueDate,
        clientName: clientName.trim(),
        clientEmail: clientEmail.toLowerCase().trim(),
        clientCompany: clientCompany?.trim() || null,
        projectName: projectName.trim(),
        taxRate: Number(taxRate) || 0,
        status: status || 'Unsent',
        lineItems: {
          create: lineItems.map((item: { description: string; qty: number; rate: number }) => ({
            description: item.description,
            qty: Number(item.qty),
            rate: Number(item.rate),
          })),
        },
      },
    });

    return NextResponse.json({ ok: true, id: invoice.id });
  } catch (err) {
    console.error('[admin/invoices POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
