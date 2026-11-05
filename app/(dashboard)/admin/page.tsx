import { requireAdminPage } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import AdminDashboardClient from './AdminDashboardClient';
import { ToastProvider } from '@/components/Toast';
import { dispatchOutbox } from '@/lib/dispatch';

type SearchParams = Record<string, string | string[] | undefined>;

const VIEWS = ['dashboard', 'inquiries', 'clients', 'projects', 'billing', 'notifications', 'profile'] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdminPage();
  const session = { userId: admin.id, name: admin.name, email: admin.email, admin: admin.admin };

  // The open screen lives in the URL, so refreshing the data after an add/edit keeps the admin where they were.
  const sp = await searchParams;
  // The old Workspace screen only held a shortcut to invoices, so its bookmarks now land on Billing.
  const rawView = one(sp.view);
  const view = rawView === 'workspace' ? 'billing' : rawView;
  const initialView = (VIEWS as readonly string[]).includes(view ?? '') ? (view as (typeof VIEWS)[number]) : 'dashboard';

  const [totalUsers, totalProjects, activeProjects, openInquiries, allInquiries, deliverables, folders, comments, recentInquiries, recentUsers, clients, companies, services, projects, invoices, adminUser] =
    await Promise.all([
      prisma.user.count({ where: { admin: false } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      prisma.inquiry.count({ where: { status: 'INQUIRY', archivedAt: null } }),
      prisma.inquiry.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, company: true, service: true, description: true,
          budgetRange: true, timeline: true, status: true, createdAt: true, metadata: true, archivedAt: true,
          attachments: { where: { status: 'READY' }, select: { id: true, fileName: true, size: true }, orderBy: { createdAt: 'asc' } },
        },
      }),
      prisma.deliverable.findMany({
        where: { status: 'READY' }, // files still uploading or being verified aren't listed
        orderBy: { createdAt: 'asc' },
        select: { id: true, inquiryId: true, projectId: true, folderId: true, title: true, description: true, fileName: true, size: true, watermark: true, createdAt: true },
      }),
      prisma.deliverableFolder.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, inquiryId: true, projectId: true, name: true, description: true, isPublic: true, shareToken: true, commentsEnabled: true, commentsModerated: true, shareRotatedAt: true, createdAt: true },
      }),
      // Comments are newer than the rest of the schema; an unmigrated database shows none instead of breaking the page.
      prisma.deliverableComment
        .findMany({
          orderBy: { createdAt: 'asc' },
          select: { id: true, deliverableId: true, authorName: true, body: true, status: true, createdAt: true },
        })
        .catch((err) => {
          console.error('[admin] could not load deliverable comments:', err);
          return [];
        }),
      prisma.inquiry.findMany({
        where: { archivedAt: null },
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

  const unreadNotifications = await prisma.adminNotification
    .count({ where: { reads: { none: { userId: admin.id } } } })
    .catch(() => 0); // a not-yet-migrated database shows no badge instead of breaking the page

  // Whenever staff open the admin, anything queued and due (e.g. after a mail outage) gets another try.
  dispatchOutbox();

  return (
    <ToastProvider>
    <AdminDashboardClient
      session={session}
      initialView={initialView}
      initialInquiryId={one(sp.inquiry) ?? null}
      initialProjectId={one(sp.project) ?? null}
      initialTab={one(sp.tab) === 'deliverables' ? 'deliverables' : 'info'}
      initialBilling={one(sp.billing) === 'invoices' ? 'invoices' : null}
      stats={{ totalUsers, totalProjects, activeProjects, openInquiries }}
      inquiries={allInquiries.map(({ metadata, createdAt, ...i }) => {
        const meta = (metadata ?? {}) as { phone?: string; projectName?: string };
        return { ...i, archivedAt: i.archivedAt?.toISOString() ?? null, phone: meta.phone ?? null, projectName: meta.projectName ?? null, createdAt: createdAt.toISOString() };
      })}
      recentInquiries={recentInquiries.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }))}
      recentUsers={recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      clients={clients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      companies={companies}
      services={services}
      comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
      initialFolderId={one(sp.folder) ?? null}
      folders={folders.map((f) => ({ ...f, shareRotatedAt: f.shareRotatedAt?.toISOString() ?? null, createdAt: f.createdAt.toISOString() }))}
      deliverables={deliverables.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
      projects={projects.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
      invoices={invoices.map((inv) => ({ ...inv, createdAt: inv.createdAt.toISOString() }))}
      adminCompany={adminUser?.company ?? null}
      unreadNotifications={unreadNotifications}
    />
    </ToastProvider>
  );
}
