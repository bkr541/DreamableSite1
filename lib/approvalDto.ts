// Explicit allowlist for the approve endpoint. Both the first approval and the repeat branch go through here,
// so a new column on any model (hashes, login codes, tokens) can never leak by being spread into the response.

interface InquiryLike { id: string; name: string; email: string; company: string | null; service: string; status: string; approvedAt: Date | null }
interface CompanyLike { id: string; name: string; website: string | null; status: string }
interface UserLike { id: string; name: string; email: string; role: string; status: string; companyId: string | null }
interface ProjectLike { id: string; name: string; service: string; status: string; companyId: string; primaryUserId: string | null }

export function toApprovalResponse(src: InquiryLike & { companyRecord: CompanyLike | null; user: UserLike | null; project: ProjectLike | null }) {
  const { companyRecord: c, user: u, project: p } = src;
  return {
    ok: true as const,
    inquiry: { id: src.id, name: src.name, email: src.email, company: src.company, service: src.service, status: src.status, approvedAt: src.approvedAt },
    company: c && { id: c.id, name: c.name, website: c.website, status: c.status },
    user: u && { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, companyId: u.companyId },
    project: p && { id: p.id, name: p.name, service: p.service, status: p.status, companyId: p.companyId, primaryUserId: p.primaryUserId },
  };
}
