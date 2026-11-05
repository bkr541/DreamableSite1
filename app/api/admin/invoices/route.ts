import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { LIMITS } from '@/lib/invoiceRules';
import { parseInvoiceInput } from '@/lib/invoiceValidation';
import { allocateInvoiceNumber } from '@/lib/invoiceNumbers';
import { lineCreateData, resolveLinks } from '@/lib/invoiceService';

const isUnique = (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
const invalid = (errors: Record<string, string>, status = 422) =>
  NextResponse.json({ ok: false, error: Object.values(errors)[0] ?? 'Invalid invoice.', errors }, { status });

// Creates an invoice. The server validates everything (the form's checks are a convenience, not the rule) and owns the
// numbering: leave the number blank (or send autoNumber) to get the next DS-YYYY-NNN; a number typed by hand must be unused.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  if (Number(req.headers.get('content-length') ?? 0) > LIMITS.maxPayloadBytes) return invalid({ _: 'That invoice is too large.' }, 413);
  const body = await req.json().catch(() => null);
  const parsed = parseInvoiceInput(body, 'create');
  if (!parsed.ok) return invalid(parsed.errors, parsed.errors._ ? 400 : 422);
  const d = parsed.data;

  try {
    const linked = await resolveLinks(prisma, d.clientUserId as string, d.projectId);
    if (!linked.ok) return invalid(linked.errors);

    // An auto-allocated number can only collide with a number someone typed in the same instant: allocate again.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          if (d.invoiceNumber) {
            const taken = (await tx.$queryRawUnsafe('SELECT 1 AS taken FROM invoices WHERE lower(btrim(invoice_number)) = lower($1) LIMIT 1', d.invoiceNumber)) as unknown[];
            if (taken.length) return { conflict: true as const };
          }
          const invoiceNumber = d.invoiceNumber ?? (await allocateInvoiceNumber(tx));
          const created = await tx.invoice.create({
            data: {
              invoiceNumber, issueDate: d.issueDate, dueDate: d.dueDate, status: d.status, taxRate: d.taxRate,
              clientName: d.clientName, clientEmail: d.clientEmail, clientCompany: d.clientCompany, projectName: d.projectName,
              clientUserId: linked.links.clientUserId, companyId: linked.links.companyId, projectId: linked.links.projectId,
              lineItems: { create: lineCreateData(d.lineItems) },
            },
            select: { id: true, invoiceNumber: true },
          });
          await recordAudit(tx, { actorId: auth.user.id, action: 'invoice.create', targetType: 'invoice', targetId: created.id, metadata: { number: created.invoiceNumber, status: d.status } });
          return { conflict: false as const, ...created };
        });
        if (result.conflict) return invalid({ invoiceNumber: 'That invoice number is already in use. Choose another, or leave it blank for the next one.' }, 409);
        return NextResponse.json({ ok: true, id: result.id, invoiceNumber: result.invoiceNumber });
      } catch (err) {
        if (!isUnique(err)) throw err;
        if (d.invoiceNumber) return invalid({ invoiceNumber: 'That invoice number is already in use. Choose another, or leave it blank for the next one.' }, 409);
      }
    }
    return invalid({ _: 'Could not reserve an invoice number. Please try again.' }, 503);
  } catch (err) {
    console.error('[admin/invoices POST]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
