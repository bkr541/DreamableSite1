import { describe, expect, it } from 'vitest';
import { linkLabel, normalizeExternalLink } from '@/lib/externalLink';

describe('external link', () => {
  it('treats blank and missing as "no link"', () => {
    for (const v of ['', '   ', null, undefined]) expect(normalizeExternalLink(v)).toEqual({ ok: true, value: null });
  });
  it('accepts web links, adding https:// when it is left off', () => {
    expect(normalizeExternalLink('https://www.dropbox.com/scl/fo/abc?dl=0')).toEqual({ ok: true, value: 'https://www.dropbox.com/scl/fo/abc?dl=0' });
    expect(normalizeExternalLink('  drive.google.com/drive/folders/1AbC  ')).toEqual({ ok: true, value: 'https://drive.google.com/drive/folders/1AbC' });
    expect(normalizeExternalLink('http://files.example.org/x')).toEqual({ ok: true, value: 'http://files.example.org/x' });
  });
  it('refuses anything that is not a plain web link', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.co/a', 'file:///etc/passwd', 'https://user:pw@x.co', 'not a link', 'https://', 'localhost', 'https://exa mple.com', 'https://bad_host.com/a']) {
      expect(normalizeExternalLink(bad).ok, bad).toBe(false);
    }
    expect(normalizeExternalLink(42).ok).toBe(false);
    expect(normalizeExternalLink('https://a.co/' + 'x'.repeat(2000)).ok).toBe(false);
  });
  it('names the well-known file sites, and falls back to the host', () => {
    expect(linkLabel('https://www.dropbox.com/s/abc')).toBe('Dropbox');
    expect(linkLabel('https://drive.google.com/file/d/1/view')).toBe('Google Drive');
    expect(linkLabel('https://1drv.ms/f/s!abc')).toBe('OneDrive');
    expect(linkLabel('https://we.tl/t-123')).toBe('WeTransfer');
    expect(linkLabel('https://www.files.example.org/a')).toBe('files.example.org');
    expect(linkLabel('nonsense')).toBe('External link');
  });
});
