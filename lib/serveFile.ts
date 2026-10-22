import { NextResponse } from 'next/server';

// Stored content types come from the uploader, so inline previews derive the type from the extension instead.
const INLINE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/plain; charset=utf-8',
};

export const UPLOAD_EXT = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|svg|sketch|fig|xd|mp4|mov|webm|txt|md|csv|zip)$/i;

export function fileResponse(file: { fileName: string; size: number; data: Uint8Array }, wantInline: boolean) {
  const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
  const inlineType = INLINE_TYPES[ext];
  const inline = wantInline && !!inlineType;

  const headers: Record<string, string> = {
    'Content-Type': inline ? inlineType : 'application/octet-stream',
    'Content-Length': String(file.size),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    'X-Content-Type-Options': 'nosniff',
  };
  // Block scripts in anything shown inline (the PDF viewer breaks under sandbox, so PDFs are exempt).
  if (inline && ext !== 'pdf') headers['Content-Security-Policy'] = 'sandbox';

  return new NextResponse(new Uint8Array(file.data), { headers });
}
