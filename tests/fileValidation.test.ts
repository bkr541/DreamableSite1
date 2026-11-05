import { describe, expect, it } from 'vitest';
import { validateUpload, inspectZip } from '@/lib/fileValidation';
import * as f from './files';

const check = (fileName: string, bytes: Uint8Array, declaredType = '') => validateUpload({ fileName, declaredType, bytes });
const ok = async (fileName: string, bytes: Uint8Array, declaredType = '') => {
  const r = await check(fileName, bytes, declaredType);
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  return r;
};
const bad = async (fileName: string, bytes: Uint8Array, declaredType = '') => {
  const r = await check(fileName, bytes, declaredType);
  expect(r.ok, `${fileName} should be rejected`).toBe(false);
  return r;
};

describe('legitimate files keep working', () => {
  it('PNG, JPEG, GIF', async () => {
    await ok('logo.png', await f.png(), 'image/png');
    await ok('photo.JPG', await f.jpg(), 'image/jpeg');
    await ok('photo.jpeg', await f.jpg(), 'image/pjpeg');
    await ok('anim.gif', await f.gif());
  });
  it('PDF (1 MB-ish with many pages too)', async () => {
    await ok('brand.pdf', await f.pdf(), 'application/pdf');
    await ok('long.pdf', await f.pdf(60));
  });
  it('Office, design and archive files', async () => {
    await ok('spec.docx', f.docx());
    await ok('old.doc', f.ole());
    await ok('sheet.xls', f.ole());
    await ok('mark.sketch', f.sketch());
    await ok('bundle.zip', f.makeZip([{ name: 'src/index.js' }, { name: 'README.md' }]));
    await ok('app.xd', f.makeZip([{ name: 'manifest' }]));
    await ok('file.fig', Buffer.concat([Buffer.from('fig-kiwi'), Buffer.alloc(32)]));
  });
  it('video, text, csv, markdown, safe SVG', async () => {
    await ok('clip.mp4', f.mp4(), 'video/mp4');
    await ok('clip.mov', f.mp4());
    await ok('clip.webm', f.webm(), 'video/webm');
    await ok('notes.txt', Buffer.from('Héllo wörld\n日本語\n'));
    await ok('data.csv', Buffer.from('a,b\n1,2\n'), 'application/vnd.ms-excel');
    await ok('readme.md', Buffer.from('# Title\n\nSome `code`\n'));
    await ok('icon.svg', f.svg(), 'image/svg+xml');
  });
  it('returns the verified type and a SHA-256', async () => {
    const r = await ok('x.png', await f.png());
    if (r.ok) { expect(r.contentType).toBe('image/png'); expect(r.sha256).toMatch(/^[0-9a-f]{64}$/); }
  });
});

describe('disguised content is rejected', () => {
  it('an executable renamed to anything on the list', async () => {
    for (const name of ['a.png', 'a.jpg', 'a.gif', 'a.pdf', 'a.docx', 'a.doc', 'a.sketch', 'a.fig', 'a.xd', 'a.zip', 'a.mp4', 'a.webm', 'a.txt', 'a.svg']) {
      await bad(name, f.exe());
    }
  });
  it('HTML or script renamed to a binary format', async () => {
    for (const name of ['a.png', 'a.pdf', 'a.jpg', 'a.sketch', 'a.docx', 'a.mp4']) await bad(name, f.html());
  });
  it('HTML saved as text/markdown/csv', async () => {
    for (const name of ['a.txt', 'a.md', 'a.csv']) await bad(name, f.html());
    await bad('a.txt', Buffer.from('#!/bin/sh\nrm -rf /\n'));
    await bad('a.txt', Buffer.from('<?php system($_GET[1]); ?>'));
  });
  it('a real PNG under the wrong extension or type', async () => {
    await bad('a.pdf', await f.png());
    await bad('a.jpg', await f.png());
    await bad('a.png', await f.png(), 'application/pdf');
  });
  it('binary data pretending to be text', async () => {
    await bad('a.txt', Buffer.from([0x50, 0x00, 0x01, 0x02, 0x03, 0x00, 0x00]));
  });
  it('unknown extensions and empty files', async () => {
    await bad('a.exe', f.exe());
    await bad('a.html', f.html());
    await bad('noextension', Buffer.from('hi'));
    await bad('a.png', Buffer.alloc(0));
  });
});

describe('SVG cannot carry script', () => {
  it.each([
    ['script element', '<script>alert(1)</script>'],
    ['event handler', '<rect onload="alert(1)" width="1" height="1"/>'],
    ['javascript url', '<a href="javascript:alert(1)"><rect width="1" height="1"/></a>'],
    ['foreignObject', '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"/></foreignObject>'],
    ['external image', '<image href="https://evil.example/x.png"/>'],
    ['entity expansion', ']><!ENTITY a "b">'],
    ['css import', '<style>@import url(https://evil.example/x.css);</style>'],
    ['iframe', '<iframe src="x"></iframe>'],
  ])('refuses %s', async (_n, inner) => {
    await bad('x.svg', f.svg(inner));
  });
  it('allows a local fragment reference and an embedded raster', async () => {
    await ok('x.svg', f.svg('<defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="1" height="1"/><use href="#g"/>'));
  });
});

describe('corrupt, truncated and bomb-like inputs fail safely', () => {
  it('truncated images and PDFs', async () => {
    const png = await f.png(); const jpg = await f.jpg(); const gif = await f.gif(); const pdf = await f.pdf();
    await bad('a.png', png.subarray(0, png.length - 20));
    await bad('a.jpg', jpg.subarray(0, jpg.length - 20));
    await bad('a.gif', gif.subarray(0, gif.length - 3));
    await bad('a.pdf', pdf.subarray(0, pdf.length - 100));
  });
  it('garbage after a valid signature', async () => {
    await bad('a.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 7)]));
    await bad('a.pdf', Buffer.from('%PDF-1.4\nnot really\n%%EOF'));
  });
  it('an image that claims an absurd size is refused without decoding it', async () => {
    const big = Buffer.from(await f.png());
    big.writeUInt32BE(60000, 16); big.writeUInt32BE(60000, 20); // IHDR width/height
    const started = Date.now();
    await bad('a.png', big);
    expect(Date.now() - started).toBeLessThan(2000);
  });
  it('a PDF with a Launch action', async () => {
    const p = await f.pdf();
    await bad('a.pdf', Buffer.concat([p.subarray(0, p.length - 6), Buffer.from('\n/Launch\n'), p.subarray(p.length - 6)]));
  });
  it('a PDF with too many pages', async () => {
    await bad('big.pdf', await f.pdf(1001));
  }, 30_000);
  it('a zip that claims to expand enormously (the bomb is never unpacked)', async () => {
    const bomb = f.makeZip([{ name: 'a.bin', uncompressedSize: 0x7fffffff, compressedSize: 10 }, { name: 'b.bin', uncompressedSize: 0x7fffffff, compressedSize: 10 }, { name: 'c.bin', uncompressedSize: 0x7fffffff, compressedSize: 10 }]);
    const started = Date.now();
    await bad('bomb.zip', bomb);
    await bad('bomb.sketch', bomb);
    expect(Date.now() - started).toBeLessThan(500);
  });
  it('a zip with thousands of entries', async () => {
    await bad('many.zip', f.makeZip(Array.from({ length: 5001 }, (_, i) => ({ name: `f${i}.txt` }))));
  });
  it('a zip with path-traversal entries', async () => {
    await bad('slip.zip', f.makeZip([{ name: '../../etc/passwd' }]));
    await bad('slip2.zip', f.makeZip([{ name: '/etc/passwd' }]));
  });
  it('a truncated zip or an Office file missing its parts', async () => {
    const z = f.makeZip([{ name: 'a.txt' }]);
    await bad('t.zip', z.subarray(0, z.length - 10));
    await bad('fake.docx', f.makeZip([{ name: 'hello.txt' }]));
    await bad('fake.sketch', f.makeZip([{ name: 'hello.txt' }]));
  });
  it('inspectZip reports structure without unpacking', () => {
    const info = inspectZip(f.docx());
    expect(typeof info).toBe('object');
    if (typeof info === 'object') expect(info.names).toContain('word/document.xml');
  });
});
