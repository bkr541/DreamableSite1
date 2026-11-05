import { describe, expect, it } from 'vitest';
import { escapeHtml, headerText, multilineHtml, safeEmailAddress, stripControlChars } from '@/lib/html';
import { buildAdminInquiryEmail, buildConfirmationEmail, type InquiryEmailData } from '@/lib/inquiryEmails';

const base: InquiryEmailData = {
  inquiryId: 'abc', name: 'Ada Lovelace', email: 'ada@example.com', company: null, website: null, service: 'Branding',
  description: 'Hello', budgetRange: null, timeline: null, phone: null, projectName: null,
  utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, referrer: null,
};
const build = (over: Partial<InquiryEmailData>) => buildAdminInquiryEmail({ ...base, ...over });

describe('HTML escaping', () => {
  it('turns markup into text', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`"quoted" & 'single' \`tick\``)).toBe('&quot;quoted&quot; &amp; &#39;single&#39; &#96;tick&#96;');
  });
  it('shows exactly what the visitor typed, even if it already looks like an entity (escaped once, never decoded)', () => {
    const html = build({ description: 'Tom &amp; Jerry' }).html;
    expect(html).toContain('Tom &amp;amp; Jerry'); // shown to the reader as the literal text they typed
  });
  it('keeps line breaks through trusted <br> only', () => {
    expect(multilineHtml('a\r\nb\n<c>')).toBe('a<br>b<br>&lt;c&gt;');
  });
  it('leaves Unicode readable', () => {
    expect(escapeHtml('Zoë Müller — 東京 🚀')).toBe('Zoë Müller — 東京 🚀');
  });
});

describe('admin notification email', () => {
  const attacks = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', '</td></tr></table><h1>PWNED</h1>', "' onmouseover='alert(1)", '<a href="javascript:alert(1)">x</a>', '<!-- hidden', '<<<>>>&&&'];
  it.each(attacks)('renders %j as text in every field', (evil) => {
    const html = build({ name: evil, company: evil, website: evil, service: evil, description: evil, phone: evil, projectName: evil, budgetRange: evil, timeline: evil, referrer: evil, utmSource: evil }).html;
    // The only tags are the template's own: no tag name or attribute from the visitor survives.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<h1>PWNED/i);
    expect(html).not.toMatch(/<[^>]*\son(error|mouseover)=/i);
    expect(html).not.toMatch(/<a href="javascript/i);
    expect(html).toContain(escapeHtml(evil));
  });
  it('renders valid special-character names legibly', () => {
    const html = build({ name: "Zoë O'Brien & Sons <Ltd>", description: 'Line 1\nLine 2 — café' }).html;
    expect(html).toContain('Zoë O&#39;Brien &amp; Sons &lt;Ltd&gt;');
    expect(html).toContain('Line 1<br>Line 2 — café');
  });
  it('handles very long descriptions without truncating or breaking structure', () => {
    const html = build({ description: 'x'.repeat(5000) + '<b>' }).html;
    expect(html).toContain('x'.repeat(5000) + '&lt;b&gt;');
  });
  it('only links an address that is a clean mailbox', () => {
    expect(build({}).html).toContain('<a href="mailto:ada@example.com">');
    expect(build({ email: '"><script>@x.co' }).html).not.toMatch(/<script/i);
    expect(build({ email: 'a@b.co,evil@x.co' }).replyTo).toBeUndefined();
  });
});

describe('header injection', () => {
  const inj = 'Eve\r\nBcc: attacker@evil.com\r\nSubject: hacked';
  it('removes CR/LF and control characters from the subject', () => {
    const { subject } = build({ name: inj, service: 'A\u0000B\u001b[31mC\nD' });
    expect(subject).not.toMatch(/[\r\n\u0000\u001b]/);
    expect(subject.startsWith('New Inquiry: ')).toBe(true);
  });
  it('removes CR/LF from the Reply-To display name and refuses an address with injected content', () => {
    const m = build({ name: inj });
    expect(m.replyTo?.name).not.toMatch(/[\r\n]/);
    expect(m.replyTo?.address).toBe('ada@example.com');
    expect(build({ email: 'a@b.co\r\nBcc: x@y.co' }).replyTo).toBeUndefined();
  });
  it('strips Unicode line separators and bidi overrides too', () => {
    expect(headerText('a b‮c')).toBe('a b c');
    expect(stripControlChars('x\u0085y')).toBe('x y');
  });
  it('bounds header length', () => {
    expect(headerText('y'.repeat(500), 80)).toHaveLength(80);
  });
  it.each([
    ['ada@example.com', true], ['a.b+tag@sub.example.co.uk', true],
    ['a@b', false], ['a b@c.co', false], ['a@b.co>', false], ['<a@b.co>', false], ['a@b.co,c@d.co', false],
    ['a@b.co\n', true /* trimmed */], ['"a"@b.co', false], ['a@@b.co', false], ['a..b@c.co', false],
  ])('safeEmailAddress(%j) → %s', (v, ok) => {
    expect(safeEmailAddress(v) !== null).toBe(ok);
  });
});

describe('customer acknowledgement email', () => {
  it('still thanks the person and is escaped once', () => {
    const m = buildConfirmationEmail("Zoë <b>O'Brien</b> Smith", 'My & <i>project</i>');
    expect(m.html).toContain('Thanks, Zoë!');
    expect(m.html).toContain('My &amp; &lt;i&gt;project&lt;/i&gt;');
    expect(m.html).not.toContain('<i>project');
    expect(m.subject).toBe('We received your inquiry — Dreamable.studio');
  });
  it('first name cannot inject markup or headers', () => {
    const m = buildConfirmationEmail('<script>alert(1)</script>\r\nBcc: x', null);
    expect(m.html).not.toMatch(/<script/i);
    expect(m.text).not.toMatch(/[\r\n].*Bcc/);
  });
});
