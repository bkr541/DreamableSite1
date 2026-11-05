import { createHash } from 'crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { FileType, fileTypeFor, extOf } from './fileTypes';

// Server-side check of what an upload *really* is. The name and the browser-declared type are only claims;
// the bytes must match the allowlisted type, and the file must be structurally sound within hard limits.
// This is format validation, not malware scanning: nothing here executes, renders or unpacks the content.

export const LIMITS = {
  imagePixels: 100_000_000,
  imageSide: 20_000,
  gifFrames: 1_000,
  pdfPages: 1_000,
  zipEntries: 5_000,
  zipUncompressedBytes: 4 * 1024 ** 3,
  zipRatio: 1_000,
  svgBytes: 5 * 1024 * 1024,
  svgBytesText: 2_000_000,
  timeoutMs: 20_000,
};

export type Validated =
  | { ok: true; ext: string; type: FileType; contentType: string; sha256: string }
  | { ok: false; error: string };

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => Buffer.from(b.subarray(from, to)).toString('latin1');
const tail = (b: Uint8Array, n: number) => b.subarray(Math.max(0, b.length - n));

const SIG = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
  ole: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  webm: [0x1a, 0x45, 0xdf, 0xa3],
  zip: [0x50, 0x4b, 0x03, 0x04],
};

const isZip = (b: Uint8Array) => startsWith(b, SIG.zip) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]);
const MOV_ATOMS = ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot'];

/* ── ZIP: read only the central directory — nothing is decompressed, so bombs cost nothing. ── */
export interface ZipInfo { names: string[]; totalUncompressed: number }

export function inspectZip(b: Uint8Array): ZipInfo | string {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  const minEocd = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minEocd; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) return 'is not a complete archive';
  const entries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    // ZIP64 archives are legitimate but rare for deliverables; refuse rather than half-parse them.
    return 'uses an unsupported archive format';
  }
  if (entries > LIMITS.zipEntries) return 'contains too many files';
  if (cdOffset + cdSize > eocd) return 'is not a complete archive';

  const names: string[] = [];
  let total = 0;
  let p = cdOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return 'is damaged';
    const compressed = buf.readUInt32LE(p + 20);
    const uncompressed = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (p + 46 + nameLen > buf.length || localOffset >= buf.length) return 'is damaged';
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name.startsWith('/') || /(^|[\\/])\.\.([\\/]|$)/.test(name) || name.includes('\0')) return 'contains unsafe file paths';
    if (compressed > 0 && uncompressed / compressed > LIMITS.zipRatio && uncompressed > 1024 * 1024) return 'expands to an unreasonable size';
    total += uncompressed;
    if (total > LIMITS.zipUncompressedBytes) return 'expands to an unreasonable size';
    names.push(name);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { names, totalUncompressed: total };
}

/* ── Per-format checks. Each returns an error fragment ("isn't a real PNG") or null when fine. ── */
async function checkImage(ext: string, b: Uint8Array): Promise<string | null> {
  const expected = ext === 'png' ? SIG.png : ext === 'gif' ? null : SIG.jpeg;
  if (ext === 'gif' ? !['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6)) : !startsWith(b, expected!)) return `isn't a real ${ext.toUpperCase()} image`;
  // Cheap truncation checks, then a bounded header read that also enforces the pixel budget.
  if (ext === 'png' && !ascii(tail(b, 64), 0, 64).includes('IEND')) return 'is incomplete or damaged';
  if (ext !== 'png' && ext !== 'gif') {
    const t = tail(b, 64);
    if (!Array.from(t).some((v, i) => v === 0xff && t[i + 1] === 0xd9)) return 'is incomplete or damaged';
  }
  if (ext === 'gif' && !Array.from(tail(b, 8)).includes(0x3b)) return 'is incomplete or damaged';
  try {
    const m = await sharp(Buffer.from(b), { limitInputPixels: LIMITS.imagePixels, failOn: 'error' }).metadata();
    if (!m.width || !m.height) return 'is damaged';
    if (m.width > LIMITS.imageSide || m.height > LIMITS.imageSide) return 'has unreasonable dimensions';
    if ((m.pages ?? 1) > LIMITS.gifFrames) return 'has too many frames';
  } catch {
    return 'is damaged or too large to process';
  }
  return null;
}

async function checkPdf(b: Uint8Array): Promise<string | null> {
  if (!ascii(b, 0, 1024).includes('%PDF-')) return "isn't a real PDF";
  if (!ascii(tail(b, 2048), 0, 2048).includes('%%EOF')) return 'is incomplete or damaged';
  if (/\/Launch\b/.test(Buffer.from(b).toString('latin1'))) return 'contains content that is not allowed';
  try {
    const doc = await PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    if (doc.getPageCount() > LIMITS.pdfPages) return 'has too many pages';
  } catch {
    return 'is damaged';
  }
  return null;
}

function checkSvg(b: Uint8Array): string | null {
  if (b.length > LIMITS.svgBytes) return 'is too large for an SVG';
  const s = Buffer.from(b).toString('utf8');
  if (s.includes('\0') || !/<svg[\s>]/i.test(s)) return "isn't a real SVG";
  // An SVG opened as a document can run script. Anything that could is refused outright.
  const bad = [
    /<script/i, /\son[a-z]+\s*=/i, /javascript:/i, /<foreignObject/i, /<(iframe|embed|object|audio|video)\b/i,
    /<!ENTITY/i, /<!DOCTYPE[^>]*\[/i, /@import/i, /url\(\s*["']?\s*(https?:|\/\/|data:text)/i,
    /\b(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i,
  ];
  return bad.some((re) => re.test(s)) ? 'contains active or external content, which is not allowed in SVG files' : null;
}

const EXEC_SIGS: number[][] = [
  [0x4d, 0x5a],                    // Windows PE ("MZ")
  [0x7f, 0x45, 0x4c, 0x46],        // ELF
  [0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe], // Mach-O
  [0xca, 0xfe, 0xba, 0xbe],        // Mach-O universal / Java class
];

function checkText(b: Uint8Array): string | null {
  if (EXEC_SIGS.some((sig) => startsWith(b, sig))) return "isn't a plain-text file";
  const sample = Buffer.from(b.subarray(0, 65_536));
  if (sample.includes(0)) return "isn't a plain-text file";
  let ctrl = 0;
  for (const v of sample) if (v < 9 || (v > 13 && v < 32 && v !== 27)) ctrl++;
  if (sample.length && ctrl / sample.length > 0.01) return "isn't a plain-text file";
  const head = sample.toString('utf8').replace(/^﻿/, '').trimStart().slice(0, 64).toLowerCase();
  if (/^(<!doctype|<html|<head|<body|<script|<\?php|#!)/.test(head)) return "isn't a plain-text file";
  return null;
}

function checkVideo(ext: string, b: Uint8Array): string | null {
  if (ext === 'webm') return startsWith(b, SIG.webm) ? null : "isn't a real WebM video";
  if (ascii(b, 4, 8) === 'ftyp' || (ext === 'mov' && MOV_ATOMS.includes(ascii(b, 4, 8)))) return null;
  return `isn't a real ${ext.toUpperCase()} video`;
}

function checkZipFamily(kind: FileType['kind'], ext: string, b: Uint8Array): string | null {
  if (kind === 'fig' && (ascii(b, 0, 8) === 'fig-kiwi' || ascii(b, 0, 7) === 'fig-jam')) return null;
  if (!isZip(b)) return `isn't a real ${ext.toUpperCase()} file`;
  const z = inspectZip(b);
  if (typeof z === 'string') return z;
  const has = (re: RegExp) => z.names.some((n) => re.test(n));
  if (kind === 'ooxml') {
    const root = { docx: /^word\//, xlsx: /^xl\//, pptx: /^ppt\// }[ext as 'docx'];
    if (!has(/^\[Content_Types\]\.xml$/) || !has(root)) return `isn't a real ${ext.toUpperCase()} document`;
  }
  if (kind === 'sketch' && !has(/^(document|meta)\.json$/)) return "isn't a real Sketch file";
  return null;
}

const GENERIC = ['', 'application/octet-stream', 'binary/octet-stream'];

/** Browsers declare a type; for formats where that is reliable it has to agree with the extension. */
function declaredTypeAgrees(type: FileType, declared: string): boolean {
  const d = declared.toLowerCase().split(';')[0].trim().replace('image/pjpeg', 'image/jpeg');
  if (GENERIC.includes(d)) return true;
  if (type.kind === 'image' || type.kind === 'svg' || type.kind === 'pdf') return d === type.mime;
  if (type.kind === 'video') return d.startsWith('video/');
  return true; // office, text, archive and design files are reported inconsistently by browsers
}

async function run(fileName: string, declaredType: string, bytes: Uint8Array): Promise<Validated> {
  const ext = extOf(fileName);
  const type = fileTypeFor(fileName);
  if (!type) return { ok: false, error: `${fileName} is not a supported file type.` };
  if (bytes.length === 0) return { ok: false, error: `${fileName} is empty.` };
  if (!declaredTypeAgrees(type, declaredType)) return { ok: false, error: `${fileName} doesn't match its file type.` };

  let problem: string | null;
  switch (type.kind) {
    case 'image': problem = await checkImage(ext, bytes); break;
    case 'pdf': problem = await checkPdf(bytes); break;
    case 'svg': problem = checkSvg(bytes); break;
    case 'text': problem = checkText(bytes); break;
    case 'video': problem = checkVideo(ext, bytes); break;
    case 'ole': problem = startsWith(bytes, SIG.ole) ? null : `isn't a real ${ext.toUpperCase()} document`; break;
    default: problem = checkZipFamily(type.kind, ext, bytes);
  }
  if (problem) return { ok: false, error: `${fileName} ${problem}.` };

  return { ok: true, ext, type, contentType: type.mime.split(';')[0], sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Validates the real bytes of an upload. Always resolves; never throws; bounded in time. */
export async function validateUpload(input: { fileName: string; declaredType?: string; bytes: Uint8Array }): Promise<Validated> {
  const timeout = new Promise<Validated>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: `${input.fileName} took too long to check.` }), LIMITS.timeoutMs).unref?.(),
  );
  try {
    return await Promise.race([run(input.fileName, input.declaredType ?? '', input.bytes), timeout]);
  } catch {
    return { ok: false, error: `${input.fileName} could not be checked.` };
  }
}
