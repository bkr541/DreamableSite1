import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { table } from './fakes';
import { migrate } from '../scripts/migrate-files-to-storage.mjs';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function setup() {
  const bytesA = Buffer.from('file-a-bytes'); const bytesB = Buffer.from('file-b-bytes');
  const prisma: any = {
    deliverable: table([
      { id: 'a', fileName: 'a.png', size: bytesA.length, contentType: 'image/png', status: 'READY', storageKey: null, sha256: null, data: bytesA },
      { id: 'b', fileName: 'b.pdf', size: bytesB.length, contentType: 'application/pdf', status: 'READY', storageKey: null, sha256: null, data: bytesB },
      { id: 'done', fileName: 'c.png', size: 1, contentType: 'image/png', status: 'READY', storageKey: 'deliverables/done', sha256: 'x', data: Buffer.from('c') },
    ]),
    inquiryAttachment: table([]),
  };
  // the fake table has no NOT support; teach the two finders this script uses
  const orig = prisma.deliverable.findMany;
  prisma.deliverable.findMany = async ({ where }: any) => {
    const rows = await orig({ where: {} });
    if (where.NOT && !Array.isArray(where.NOT)) return rows.filter((r: any) => r.storageKey === null && r.status === 'READY' && r.data !== null);
    if (Array.isArray(where.NOT)) return rows.filter((r: any) => r.storageKey !== null && r.data !== null);
    return rows;
  };
  const objects = new Map<string, Buffer>();
  const storage = {
    put: async (k: string, b: Buffer) => { objects.set(k, Buffer.from(b)); },
    get: async (k: string) => { const o = objects.get(k); if (!o) throw new Error('missing'); return o; },
  };
  return { prisma, storage, objects, bytesA, bytesB };
}
const quiet = () => {};

describe('moving existing database files to storage', () => {
  it('a dry run changes nothing', async () => {
    const { prisma, storage, objects } = setup();
    const s = await migrate({ prisma, storage, apply: false, log: quiet });
    expect(s).toMatchObject({ found: 2, copied: 0 });
    expect(objects.size).toBe(0);
    expect(prisma.deliverable.rows.every((r: any) => r.data !== null)).toBe(true);
  });
  it('copies, verifies by checksum, records the key — and KEEPS the database bytes (dual read)', async () => {
    const { prisma, storage, objects, bytesA } = setup();
    const s = await migrate({ prisma, storage, apply: true, log: quiet });
    expect(s).toMatchObject({ found: 2, copied: 2, failed: 0 });
    const a = prisma.deliverable.rows.find((r: any) => r.id === 'a');
    expect(a.storageKey).toBe('deliverables/a');
    expect(a.sha256).toBe(sha(bytesA));
    expect(a.data).not.toBeNull();
    expect(objects.get('deliverables/a')!.equals(bytesA)).toBe(true);
  });
  it('a copy that does not match is never recorded; the original stays the only copy', async () => {
    const { prisma, storage, objects } = setup();
    storage.put = async (k: string, b: Buffer) => { objects.set(k, Buffer.concat([b, Buffer.from('!')])); }; // corrupts in transit
    const s = await migrate({ prisma, storage, apply: true, log: quiet });
    expect(s).toMatchObject({ copied: 0, failed: 2 });
    expect(prisma.deliverable.rows.every((r: any) => r.data !== null && (r.id === 'done' || r.storageKey === null))).toBe(true);
  });
  it('is safe to re-run', async () => {
    const { prisma, storage } = setup();
    await migrate({ prisma, storage, apply: true, log: quiet });
    const again = await migrate({ prisma, storage, apply: true, log: quiet });
    expect(again.found).toBe(0);
  });
  it('clearing database bytes re-verifies each stored copy first and keeps any that do not match', async () => {
    const { prisma, storage, objects } = setup();
    await migrate({ prisma, storage, apply: true, log: quiet });
    objects.set('deliverables/b', Buffer.from('tampered'));          // b's stored copy is now wrong
    objects.set('deliverables/done', Buffer.from('c'));
    prisma.deliverable.rows.find((r: any) => r.id === 'done').sha256 = sha(Buffer.from('c'));
    const s = await migrate({ prisma, storage, purge: true, log: quiet });
    expect(s.purged).toBe(2);   // a and done
    expect(s.skipped).toBe(1);  // b
    const byId = Object.fromEntries(prisma.deliverable.rows.map((r: any) => [r.id, r]));
    expect(byId.a.data).toBeNull();
    expect(byId.b.data).not.toBeNull();
  });
});
