import { redirect } from 'next/navigation';
import { requireClientPage } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import CustomerDashboardClient from './CustomerDashboardClient';
import { customerInvoiceWhere, toInvoiceView, totalsFor } from '@/lib/invoiceService';
import { canonicalServiceLabel } from '@/lib/services';

export default async function DashboardPage() {
  const current = await requireClientPage();
  const session = { userId: current.id, name: current.name, email: current.email, admin: current.admin };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      inquiryId: true,
      inquiry: { select: { service: true } },
      company: { select: { name: true } },
      projects: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          service: true,
          status: true,
          description: true,
          startDate: true,
          targetEndDate: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) redirect('/portal');

  const deliverables = await prisma.deliverable.findMany({
    where: {
      status: 'READY',
      OR: [
        { project: { primaryUserId: user.id } },
        ...(user.inquiryId ? [{ inquiryId: user.inquiryId }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, inquiryId: true, projectId: true, folderId: true, title: true, description: true, fileName: true, size: true },
  });

  const folders = await prisma.deliverableFolder.findMany({
    where: {
      OR: [
        { project: { primaryUserId: user.id } },
        ...(user.inquiryId ? [{ inquiryId: user.inquiryId }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, inquiryId: true, projectId: true, name: true, description: true },
  });

  // Only invoices linked to THIS account, and only once issued (drafts are internal). Read-only: the customer can look at
  // and download them; nothing here collects or records a payment.
  const today = new Date().toISOString().slice(0, 10);
  const invoiceRows = await prisma.invoice
    .findMany({
      where: customerInvoiceWhere(user.id),
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      include: { lineItems: true },
    })
    .catch((err) => {
      console.error('[dashboard] could not load invoices:', err);
      return [];
    });
  const invoices = invoiceRows.map((row) => {
    const view = toInvoiceView(row);
    return {
      id: view.id, invoiceNumber: view.invoiceNumber, projectName: view.projectName, issueDate: view.issueDate, dueDate: view.dueDate,
      status: view.status, total: totalsFor(view)?.total ?? null, pastDue: view.status === 'Not Paid' && view.dueDate < today,
    };
  });

  return (
    <CustomerDashboardClient
      session={session}
      deliverables={deliverables}
      folders={folders}
      invoices={invoices}
      user={{
        ...user,
        inquiryService: user.inquiry?.service ? canonicalServiceLabel(user.inquiry.service) : null,
        company: user.company ?? null,
        projects: user.projects.map((p) => ({
          ...p,
          service: canonicalServiceLabel(p.service),
          startDate: p.startDate?.toISOString() ?? null,
          targetEndDate: p.targetEndDate?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
      }}
    />
  );
}
