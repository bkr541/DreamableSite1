import { redirect } from 'next/navigation';
import { requireClientPage } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import CustomerDashboardClient from './CustomerDashboardClient';

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

  return (
    <CustomerDashboardClient
      session={session}
      deliverables={deliverables}
      folders={folders}
      user={{
        ...user,
        inquiryService: user.inquiry?.service ?? null,
        company: user.company ?? null,
        projects: user.projects.map((p) => ({
          ...p,
          startDate: p.startDate?.toISOString() ?? null,
          targetEndDate: p.targetEndDate?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
      }}
    />
  );
}
