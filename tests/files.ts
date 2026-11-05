import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

/** Minimal ZIP writer (stored, no compression) — enough to build realistic archives and malicious ones. */
export function makeZip(entries: { name: string; data?: string; uncompressedSize?: number; compressedSize?: number }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const data = Buffer.from(e.data ?? 'x');
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(e.compressedSize ?? data.length, 20);
    central.writeUInt32LE(e.uncompressedSize ?? data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    locals.push(local, data); centrals.push(central);
    offset += local.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

export const png = (w = 12, h = 12) => sharp({ create: { width: w, height: h, channels: 3, background: '#4f6df5' } }).png().toBuffer();
export const jpg = () => sharp({ create: { width: 12, height: 12, channels: 3, background: '#B87AF5' } }).jpeg().toBuffer();
export const gif = () => sharp({ create: { width: 8, height: 8, channels: 3, background: '#3DD9C8' } }).gif().toBuffer();

export async function pdf(pages = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

export const docx = () => makeZip([{ name: '[Content_Types].xml' }, { name: 'word/document.xml' }, { name: '_rels/.rels' }]);
export const sketch = () => makeZip([{ name: 'document.json' }, { name: 'meta.json' }]);
export const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(40)]);
export const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40)]);
export const ole = () => Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]);
export const exe = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90), Buffer.from('This program cannot be run in DOS mode.')]);
export const html = (body = '<script>alert(document.cookie)</script>') => Buffer.from(`<!doctype html><html><body>${body}</body></html>`);
export const svg = (inner = '<rect width="10" height="10" fill="#4f6df5"/>') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${inner}</svg>`);
