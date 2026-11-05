import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type NotificationType = 'inquiry.new' | 'inquiry.approved' | 'client.activated' | 'deliverable.uploaded' | 'comment.new' | 'email.failed';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  /** Where clicking the item goes (an /admin?... link that the admin screen understands). */
  url: string;
  actorId?: string | null;
  /** The event's identity. Recording the same event twice (a retry, a double click) leaves one item. */
  dedupeKey: string;
}

/** Records an admin-visible event exactly once. Pass a transaction client to tie it to the change that caused it. */
export async function notify(db: Db, n: NotificationInput): Promise<void> {
  await db.adminNotification.createMany({
    data: [{
      type: n.type, title: n.title.slice(0, 160), body: n.body?.slice(0, 300) ?? null, entityType: n.entityType ?? null,
      entityId: n.entityId ?? null, url: n.url, actorId: n.actorId ?? null, dedupeKey: n.dedupeKey,
    }],
    skipDuplicates: true,
  });
}

/** Deep links the admin screen understands (see AdminDashboardClient → openLink). */
export const links = {
  inquiry: (id: string) => `/admin?view=inquiries&inquiry=${id}`,
  project: (id: string) => `/admin?view=projects&project=${id}`,
  clients: () => '/admin?view=clients',
  folder: (f: { id: string; inquiryId: string | null; projectId: string | null }) =>
    f.projectId ? `/admin?view=projects&project=${f.projectId}&tab=deliverables&folder=${f.id}`
    : f.inquiryId ? `/admin?view=inquiries&inquiry=${f.inquiryId}&tab=deliverables&folder=${f.id}`
    : '/admin',
};
