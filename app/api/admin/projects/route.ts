import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { canonicalServiceLabel } from '@/lib/services';

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const {
    name, companyId, newCompanyName, primaryUserId, service, subCategory, description,
    budgetRange, timeline, status, startDate, targetEndDate,
  } = await req.json();

  if (!name?.trim()) return fail('Project name is required.');
  if (!companyId && !newCompanyName?.trim()) return fail('Company is required.');
  if (!service?.trim()) return fail('Service is required.');
  if (!description?.trim()) return fail('Description is required.');

  try {
    // The client and company have to agree, otherwise the project would be linked to a mismatched pair.
    const client = primaryUserId
      ? await prisma.user.findUnique({ where: { id: primaryUserId }, select: { id: true, companyId: true } })
      : null;
    if (primaryUserId && !client) return fail('The selected client was not found.');

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) return fail('The selected company was not found.');
      if (client?.companyId && client.companyId !== companyId) return fail('That client belongs to a different company.');
    }

    const project = await prisma.$transaction(async (tx) => {
      // A client with no company yet gets one here, so the project and the client end up under the same company.
      let projectCompanyId: string = companyId;
      if (!projectCompanyId) {
        const created = await tx.company.create({ data: { name: newCompanyName.trim(), status: 'ACTIVE' } });
        projectCompanyId = created.id;
      }
      if (client && !client.companyId) {
        await tx.user.update({ where: { id: client.id }, data: { companyId: projectCompanyId } });
      }

      return tx.project.create({
        data: {
          name: name.trim(),
          companyId: projectCompanyId,
          primaryUserId: client?.id ?? null,
          service: canonicalServiceLabel(service),
          subCategory: subCategory?.trim() || null,
          description: description.trim(),
          budgetRange: budgetRange?.trim() || null,
          timeline: timeline?.trim() || null,
          status: status || 'ONBOARDING',
          startDate: startDate ? new Date(startDate) : null,
          targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
        },
        select: { id: true, companyId: true },
      });
    });

    return NextResponse.json({ ok: true, id: project.id, companyId: project.companyId });
  } catch (err) {
    console.error('[admin/projects POST]', err);
    return fail('Something went wrong while creating the project.', 500);
  }
}
