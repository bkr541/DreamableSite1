import { describe, expect, it } from 'vitest';
import { cleanAuthorName, cleanCommentBody } from '@/lib/commentText';

describe('guest names', () => {
  it('accepts ordinary names and normalises whitespace', () => {
    expect(cleanAuthorName('  Zoë   O\'Brien ')).toEqual({ ok: true, value: "Zoë O'Brien" });
  });
  it.each(['Admin', 'ADMINISTRATOR', 'Dreamable', 'Dreamable.studio', 'dreamable team', 'D r e a m a b l e', 'Support', 'Staff', 'a.d.m.i.n'])(
    'refuses %j (would pass for the studio)', (n) => {
      expect(cleanAuthorName(n).ok).toBe(false);
    },
  );
  it('allows names that merely contain a reserved word as part of another word', () => {
    expect(cleanAuthorName('Adminton Hughes').ok).toBe(true);
  });
  it('strips control characters and rejects empty or oversize names', () => {
    expect(cleanAuthorName('Eve\r\nBcc: x\u0000')).toEqual({ ok: true, value: 'Eve Bcc: x' });
    expect(cleanAuthorName('   ').ok).toBe(false);
    expect(cleanAuthorName('x'.repeat(81)).ok).toBe(false);
    expect(cleanAuthorName(42).ok).toBe(false);
  });
});

describe('comment text', () => {
  it('keeps paragraphs, trims, and collapses blank-line padding', () => {
    expect(cleanCommentBody('  Hi\r\n\r\n\r\n\r\nthere  ')).toEqual({ ok: true, value: 'Hi\n\nthere' });
  });
  it('removes control characters but not Unicode text', () => {
    expect(cleanCommentBody('Nice\u0000 work 👍 — merci').ok).toBe(true);
    const r = cleanCommentBody('a\u0007b');
    expect(r.ok && r.value).toBe('a b');
  });
  it('limits length and number of links', () => {
    expect(cleanCommentBody('x'.repeat(2001)).ok).toBe(false);
    expect(cleanCommentBody('x'.repeat(2000)).ok).toBe(true);
    expect(cleanCommentBody('http://a.co http://b.co http://c.co').ok).toBe(true);
    expect(cleanCommentBody('http://a.co http://b.co http://c.co https://d.co').ok).toBe(false);
  });
  it('rejects empty and non-string bodies', () => {
    expect(cleanCommentBody('  \n ').ok).toBe(false);
    expect(cleanCommentBody(null).ok).toBe(false);
  });
});
