import { ADMIN_ID, CLIENT_ID, INQUIRY_ID } from './helpers';
import { mailTables, table, withTransactions } from './fakes';

export const DB_USER_ID = '77777777-7777-4777-8777-777777777777';

/** A relation-aware stand-in for the tables the onboarding flow touches, with real rollback on a failed transaction. */
export function makeOnboardingDb() {
  const inquiry = table([{
    id: INQUIRY_ID, name: 'Ada Lovelace', email: 'Ada@Example.com', company: 'Analytical Co', website: null, service: 'Branding', description: 'Please help',
    budgetRange: null, timeline: null, status: 'INQUIRY', approvedAt: null, archivedAt: null, rejectedAt: null, rejectedById: null, rejectionReason: null,
    metadata: { projectName: 'Rebrand' }, attachments: [],
  }]);
  const user = table([
    { id: ADMIN_ID, name: 'Admin', email: 'admin@x.co', admin: true, role: 'ADMIN', status: 'ACTIVE', sessionVersion: 0, inquiryId: null, passwordHash: 'h', companyId: null },
    { id: CLIENT_ID, name: 'Other Client', email: 'other@x.co', admin: false, role: 'CLIENT', status: 'ACTIVE', sessionVersion: 0, inquiryId: null, passwordHash: 'h', companyId: null },
  ], { defaults: () => ({ sessionVersion: 0, admin: false, inquiryId: null, passwordHash: null, companyId: null, templogincode: null, tempLoginCodeExpiresAt: null, lastLoginAt: null }) });
  const company = table([], { defaults: () => ({ inquiryId: null, website: null, status: 'ACTIVE' }) });
  const project = table([], { defaults: () => ({ inquiryId: null }) });

  const db: Record<string, any> = {
    inquiry, user, company, project,
    ...mailTables(),
    auditLog: table(),
    passwordResetToken: table([], { defaults: () => ({ consumedAt: null, purpose: 'RESET' }) }),
    inquiryAttachment: table([{ id: 'att1', inquiryId: INQUIRY_ID, status: 'READY', fileName: 'brief.pdf' }]),
    $queryRaw: async () => [],
  };
  // Approve/reject read an inquiry together with whatever was created from it.
  const base = inquiry.findUnique;
  inquiry.findUnique = async (args: any) => {
    const r = await base(args);
    if (!r) return null;
    return {
      ...r,
      companyRecord: company.rows.find((c: any) => c.inquiryId === r.id) ?? null,
      user: user.rows.find((u: any) => u.inquiryId === r.id) ?? null,
      project: project.rows.find((p: any) => p.inquiryId === r.id) ?? null,
    };
  };
  // Reset/invitation tokens are looked up together with their account.
  const tokens = db.passwordResetToken;
  const findToken = tokens.findUnique;
  tokens.findUnique = async (args: any) => {
    const r = await findToken(args);
    if (!r) return null;
    const u = user.rows.find((x: any) => x.id === r.userId);
    return { ...r, user: u ? { id: u.id, status: u.status } : null };
  };
  return withTransactions(db);
}
