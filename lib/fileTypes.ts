// The single allowlist of file types the app accepts, previews and serves. Pure data + string helpers, so
// uploads, downloads, share links and the admin all apply the same rules.

export type FileKind = 'image' | 'svg' | 'pdf' | 'video' | 'text' | 'ole' | 'ooxml' | 'zip' | 'sketch' | 'xd' | 'fig';

export interface FileType {
  kind: FileKind;
  /** Content type used when the file is shown inline, and recorded once the bytes have been verified. */
  mime: string;
  /** May be displayed in the browser. Everything else is delivered as a download only. */
  inline: boolean;
}

const T = (kind: FileKind, mime: string, inline = false): FileType => ({ kind, mime, inline });

export const FILE_TYPES: Record<string, FileType> = {
  png: T('image', 'image/png', true),
  jpg: T('image', 'image/jpeg', true),
  jpeg: T('image', 'image/jpeg', true),
  gif: T('image', 'image/gif', true),
  svg: T('svg', 'image/svg+xml', true),
  pdf: T('pdf', 'application/pdf', true),
  mp4: T('video', 'video/mp4', true),
  mov: T('video', 'video/quicktime', true),
  webm: T('video', 'video/webm', true),
  txt: T('text', 'text/plain; charset=utf-8', true),
  md: T('text', 'text/plain; charset=utf-8', true),
  csv: T('text', 'text/plain; charset=utf-8', true),
  doc: T('ole', 'application/msword'),
  xls: T('ole', 'application/vnd.ms-excel'),
  ppt: T('ole', 'application/vnd.ms-powerpoint'),
  docx: T('ooxml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  xlsx: T('ooxml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  pptx: T('ooxml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  zip: T('zip', 'application/zip'),
  sketch: T('sketch', 'application/octet-stream'),
  xd: T('xd', 'application/octet-stream'),
  fig: T('fig', 'application/octet-stream'),
};

/** What admins may attach to a delivery. */
export const DELIVERABLE_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'sketch', 'fig', 'xd', 'mp4', 'mov', 'webm', 'txt', 'md', 'csv', 'zip'];
/** What the public inquiry form accepts (narrower: no spreadsheets, decks or archives from strangers). */
export const INQUIRY_EXTS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'sketch', 'fig', 'xd', 'mp4', 'mov', 'webm', 'txt', 'md', 'csv'];

export const UPLOAD_EXT = new RegExp(`\\.(${DELIVERABLE_EXTS.join('|')})$`, 'i');
export const INQUIRY_EXT = new RegExp(`\\.(${INQUIRY_EXTS.join('|')})$`, 'i');

export const extOf = (fileName: string) => (fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '');
export const fileTypeFor = (fileName: string): FileType | null => FILE_TYPES[extOf(fileName)] ?? null;

/** A name that is safe to show, store and put in a header: no path parts, quotes, control characters or markup. */
export function safeFileName(name: string, max = 150): string {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? '';
  let out = '';
  for (const ch of base) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0x2028 || cp === 0x2029 || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) continue;
    out += /["<>:|?*]/.test(ch) ? '_' : ch;
  }
  out = out.replace(/\s+/g, ' ').replace(/^[. ]+/, '').trim();
  if (out.length > max) {
    const e = extOf(out);
    out = e ? `${out.slice(0, max - e.length - 1)}.${e}` : out.slice(0, max);
  }
  return out || 'file';
}

/** `attachment; filename="…"; filename*=UTF-8''…` with an ASCII fallback, safe for any input. */
export function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const name = safeFileName(fileName);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/[\\"]/g, '_');
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

export const CSP_INLINE = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";
