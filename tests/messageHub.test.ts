import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { EVENT_LABELS } from '@/lib/emailOutbox';

const read = (f: string) => readFileSync(path.resolve(__dirname, '..', f), 'utf8');

describe('Message Hub', () => {
  it('replaces Inbox in the top nav, and Inbox + Templates are its two tabs', () => {
    const admin = read('app/(dashboard)/admin/AdminDashboardClient.tsx');
    expect(admin).toMatch(/id: 'messages',\s+label: 'Message Hub'/);
    expect(admin).not.toMatch(/id: 'inbox',\s+label:/);
    const hub = read('components/MessageHub.tsx');
    expect(hub).toMatch(/id: 'inbox', label: 'Inbox'/);
    expect(hub).toMatch(/id: 'templates', label: 'Templates'/);
  });
  it('keeps old /admin?view=inbox bookmarks working', () => {
    expect(read('app/(dashboard)/admin/page.tsx')).toMatch(/rawView === 'inbox' \? 'messages'/);
  });
  it('the Zoho sign-in returns to the Inbox tab inside Message Hub', () => {
    for (const f of ['app/api/admin/zoho/connect/route.ts', 'app/api/auth/zoho/callback/route.ts']) expect(read(f), f).toContain('view=messages&hub=inbox&zoho=');
  });
  it('shows the email preview in a script-free frame', () => {
    const src = read('components/TemplatesPanel.tsx');
    expect(src).toMatch(/<iframe[^>]*sandbox=""/);
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });
});

describe('sending a composed email', () => {
  const route = read('app/api/admin/messages/send/route.ts');
  it('is admin-only, validated, audited and goes through the outbox (never straight to SMTP)', () => {
    expect(route).toMatch(/requireAdmin\(req\)/);
    expect(route).toContain('safeEmailAddress(body.to)');
    expect(route).toContain('headerText(body.subject');
    expect(route).toContain("eventType: 'admin.message'");
    expect(route).toContain('enqueueEmail(tx');
    expect(route).toContain("action: 'email.admin_send'");
    expect(route).not.toMatch(/nodemailer|sendMail|deliver\(/);
  });
  it('the outbox knows how to build and label it', () => {
    expect(EVENT_LABELS['admin.message']).toBe('Message sent by staff');
    const outbox = read('lib/emailOutbox.ts');
    expect(outbox).toMatch(/job\.eventType === 'admin\.message'/);
  });
});
