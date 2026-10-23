import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session || !session.admin) redirect('/portal');

  const [totalUsers, totalProjects, activeProjects, openInquiries, allInquiries, deliverables, recentInquiries, recentUsers, clients, companies, services, projects, invoices, adminUser] =
    await Promise.all([
      prisma.user.count({ where: { admin: false } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.inquiry.count({ where: { status: 'INQUIRY' } }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, company: true, service: true, description: true,
          budgetRange: true, timeline: true, status: true, createdAt: true, metadata: true,
          attachments: { select: { id: true, fileName: true, size: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      prisma.deliverable.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, inquiryId: true, projectId: true, category: true, description: true, fileName: true, size: true, createdAt: true },
      }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, email: true, service: true, status: true, createdAt: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, email: true, role: true, status: true, admin: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { admin: false },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true, status: true, admin: true, createdAt: true,
          company: { select: { id: true, name: true, website: true, status: true } },
        },
      }),
      prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, status: true },
      }),
      prisma.service.findMany({
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          subCategories: { orderBy: { order: 'asc' }, select: { id: true, name: true } },
        },
      }),
      prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, service: true, status: true, createdAt: true,
          company: { select: { id: true, name: true } },
          primaryUser: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, invoiceNumber: true, clientName: true, clientEmail: true,
          clientCompany: true, projectName: true, issueDate: true, dueDate: true,
          taxRate: true, status: true, createdAt: true,
          lineItems: { select: { description: true, qty: true, rate: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { company: { select: { id: true, name: true, website: true } } },
      }),
    ]);

  return (
    <AdminDashboardClient
      session={session}
      stats={{ totalUsers, totalProjects, activeProjects, openInquiries }}
      inquiries={allInquiries.map(({ metadata, createdAt, ...i }) => {
        const meta = (metadata ?? {}) as { phone?: string; projectName?: string };
        return { ...i, phone: meta.phone ?? null, projectName: meta.projectName ?? null, createdAt: createdAt.toISOString() };
      })}
      recentInquiries={recentInquiries.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }))}
      recentUsers={recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      clients={clients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      companies={companies}
      services={services}
      deliverables={deliverables.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
      projects={projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      invoices={invoices.map((inv) => ({ ...inv, createdAt: inv.createdAt.toISOString() }))}
      adminCompany={adminUser?.company ?? null}
    />
  );
}
