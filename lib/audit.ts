import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Append-only record of privileged actions. Pass the transaction client to make it atomic with the change. */
export async function recordAudit(
  db: Db,
  entry: { actorId: string | null; action: string; targetType: string; targetId?: string | null; metadata?: Prisma.InputJsonValue },
) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata,
    },
  });
}
