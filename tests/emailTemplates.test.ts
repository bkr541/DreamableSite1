import { describe, expect, it } from 'vitest';
import { TEMPLATES, initialValues, templateById } from '@/lib/emailTemplates';
import { paragraphs, renderEmail, safeHref } from '@/lib/emailLayout';
import { htmlToText } from '@/lib/emailText';

const base = 'https://dreamable.example';

describe('every template', () => {
  it('has a unique id, a name, a description and fields that start with sensible values', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.name && t.description, t.id).toBeTruthy();
      expect(new Set(t.fields.map((f) => f.key)).size, t.id).toBe(t.fields.length);
      const values = initialValues(t, base);
      expect(Object.keys(values).sort(), t.id).toEqual(t.fields.map((f) => f.key).sort());
    }
  });
  it('renders a complete branded email from its starting values (logo, heading, footer, no leftovers)', () => {
    for (const t of TEMPLATES) {
      const html = t.render(initialValues(t, base), base);
      expect(html, t.id).toContain('<!doctype html>');
      expect(html, t.id).toContain(`${base}/images/logo.png`);
      expect(html, t.id).toContain('Reply to this email');
      expect(html, t.id).not.toMatch(/undefined|\[object|\{\{/);
    }
  });
  it('links its button to the portal on this site by default', () => {
    const html = templateById('order-delivery')!.render(initialValues(templateById('order-delivery')!, base), base);
    expect(html).toContain(`href="${base}/dashboard"`);
    expect(html).toContain('View your files');
  });
  it('omits the button when its text is empty', () => {
    const t = templateById('welcome')!;
    const html = t.render({ ...initialValues(t, base), buttonLabel: '' }, base);
    expect(html).not.toContain('<a href=');
  });
});

describe('typed text can never become markup', () => {
  it('escapes every field', () => {
    const t = templateById('project-update')!;
    const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
    const html = t.render({ firstName: evil, projectName: evil, message: evil, buttonLabel: evil, buttonUrl: `${base}/x` }, base);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });
  it('only lets a button point at a web address', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '/relative', 'ftp://x.co', 'https://a b.co', '']) expect(safeHref(bad), bad).toBeNull();
    expect(safeHref('https://acme.com/a?b=1')).toBe('https://acme.com/a?b=1');
    const html = renderEmail({ title: 't', bodyHtml: '', button: { label: 'Go', url: 'javascript:alert(1)' }, baseUrl: base });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('>Go<');
  });
  it('turns blank lines into paragraphs and single line breaks into <br>', () => {
    expect(paragraphs('One\nstill one\n\nTwo')).toMatch(/One<br>still one<\/p><p[^>]*>Two/);
    expect(paragraphs('   ')).toBe('');
  });
});

describe('plain-text version', () => {
  it('keeps the words, shows link addresses, and drops markup, head and styles', () => {
    const html = templateById('welcome')!.render(initialValues(templateById('welcome')!, base), base);
    const text = htmlToText(html);
    expect(text).toContain('Welcome aboard');
    expect(text).toContain('Hi there,');
    expect(text).toContain(`Open your portal (${base}/portal)`);
    expect(text).not.toMatch(/<|>|style=|doctype/i);
  });
  it('decodes entities and collapses blank space', () => {
    expect(htmlToText('<p>Tom &amp; Jerry</p>\n\n\n\n<p>Hi&nbsp;there</p>')).toBe('Tom & Jerry\n\nHi there');
  });
});
