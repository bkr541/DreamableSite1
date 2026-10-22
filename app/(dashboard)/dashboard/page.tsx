import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import CustomerDashboardClient from './CustomerDashboardClient';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/portal');
  if (session.admin) redirect('/admin');

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
    select: { id: true, inquiryId: true, projectId: true, category: true, fileName: true, size: true },
  });

  return (
    <CustomerDashboardClient
      session={session}
      deliverables={deliverables}
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
