import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { LIMITS, canTransition, contentIsLocked, numberIsLocked } from '@/lib/invoiceRules';
import { contentKey, parseInvoiceInput } from '@/lib/invoiceValidation';
import { lineCreateData, resolveLinks, toInvoiceView } from '@/lib/invoiceService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUnique = (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
const reject = (errors: Record<string, string>, status = 422) =>
  NextResponse.json({ ok: false, error: Object.values(errors)[0] ?? 'Invalid invoice.', errors }, { status });
const NUMBER_TAKEN = 'That invoice number is already in use. Choose another.';

// Edits an invoice under exactly the same rules as creating one, plus the rules for changing an existing record:
//   • status moves only along Unsent → Not Paid → Paid (and Paid → Not Paid as a correction)
//   • an issued invoice (anything but Unsent) keeps its number — except a flagged duplicate, which must be renumbered
//   • a Paid invoice is closed: nothing can change until it is put back to Not Paid, and that can't be combined with other edits
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!UUID.test(id)) return reject({ _: 'Invoice not found.' }, 404);
  if (Number(req.headers.get('content-length') ?? 0) > LIMITS.maxPayloadBytes) return reject({ _: 'That invoice is too large.' }, 413);

  const parsed = parseInvoiceInput(await req.json().catch(() => null), 'update');
  if (!parsed.ok) return reject(parsed.errors, parsed.errors._ ? 400 : 422);
  const d = parsed.data;

  try {
    const row = await prisma.invoice.findUnique({ where: { id }, include: { lineItems: true } });
    if (!row) return reject({ _: 'Invoice not found.' }, 404);
    const existing = toInvoiceView(row);

    if (!canTransition(existing.status, d.status)) {
      return reject({ status: `An invoice can’t go from ${existing.status} to ${d.status}.` }, 409);
    }

    const typedNumber = d.invoiceNumber as string;                       // required on update
    const renumbered = typedNumber.toLowerCase() !== existing.invoiceNumber.trim().toLowerCase();
    if (row.numberConflict && !renumbered) return reject({ invoiceNumber: 'This number is used by another invoice. Enter a new, unused number to resolve the duplicate.' }, 422);
    if (renumbered && numberIsLocked(existing.status) && !row.numberConflict) return reject({ invoiceNumber: 'An issued invoice keeps its number.' }, 409);

    // Which account it belongs to: keep what is stored unless the admin chose one (legacy unlinked invoices stay editable).
    const wantedClient = d.clientUserId ?? row.clientUserId;
    let links = { clientUserId: row.clientUserId, companyId: row.companyId, projectId: d.clientUserId ? d.projectId : row.projectId };
    if (wantedClient) {
      const r = await resolveLinks(prisma, wantedClient, d.clientUserId ? d.projectId : row.projectId);
      if (!r.ok) return reject(r.errors);
      links = r.links;
    }

    if (contentIsLocked(existing.status)) {
      // Closed record: the only thing that may differ is the status going back to Not Paid, or a flagged duplicate's number.
      const sameContent = contentKey(existing, false) === contentKey(d, false) && links.clientUserId === row.clientUserId && links.projectId === row.projectId;
      if (!sameContent || (renumbered && !row.numberConflict)) {
        return reject({ _: 'A paid invoice can’t be edited. Mark it Not Paid first (on its own), then make your changes.' }, 409);
      }
    }

    if (renumbered) {
      const taken = (await prisma.$queryRawUnsafe('SELECT 1 AS taken FROM invoices WHERE lower(btrim(invoice_number)) = lower($1) AND id <> $2::uuid LIMIT 1', typedNumber, id)) as unknown[];
      if (taken.length) return reject({ invoiceNumber: NUMBER_TAKEN }, 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: typedNumber, numberConflict: renumbered ? false : row.numberConflict,
          issueDate: d.issueDate, dueDate: d.dueDate, status: d.status, taxRate: d.taxRate,
          clientName: d.clientName, clientEmail: d.clientEmail, clientCompany: d.clientCompany, projectName: d.projectName,
          clientUserId: links.clientUserId, companyId: links.companyId, projectId: links.projectId,
          lineItems: { create: lineCreateData(d.lineItems) },
        },
      });
      await recordAudit(tx, {
        actorId: auth.user.id, action: existing.status !== d.status ? 'invoice.status' : 'invoice.update', targetType: 'invoice', targetId: id,
        metadata: { number: typedNumber, ...(existing.status !== d.status ? { from: existing.status, to: d.status } : {}), ...(renumbered ? { renumberedFrom: existing.invoiceNumber } : {}) },
      });
    });
    return NextResponse.json({ ok: true, invoiceNumber: typedNumber });
  } catch (err) {
    if (isUnique(err)) return reject({ invoiceNumber: NUMBER_TAKEN }, 409);
    console.error('[admin/invoices PUT]', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
