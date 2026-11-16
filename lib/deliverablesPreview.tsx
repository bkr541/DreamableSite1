import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { deliverablesPreviewInfo } from '@/lib/deliverablesMetadata';

const clip = (text: string, length: number) => text.length > length ? `${text.slice(0, length - 1)}…` : text;
const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs>
<linearGradient id="bg" x2="1" y2="1"><stop stop-color="#eef0ff"/><stop offset=".5" stop-color="#e2f3fc"/><stop offset="1" stop-color="#f5eafe"/></linearGradient>
<pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#a9b6dc" stroke-opacity=".22"/></pattern>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/>
<path d="M0 148L405 38M817 598L1200 460" stroke="#c5d9ee" stroke-width="2"/><circle cx="405" cy="38" r="8" fill="#ded5fa"/><circle cx="817" cy="598" r="8" fill="#c5eef2"/>
</svg>`).toString('base64');

export async function deliverablesPreviewImage(info: ReturnType<typeof deliverablesPreviewInfo>) {
  const [logo, hero, regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), 'public/images/logo.png')),
    readFile(path.join(process.cwd(), 'public/images/deliverables-hero.svg')),
    readFile(path.join(process.cwd(), 'public/fonts/Quicksand-Regular.ttf')),
    readFile(path.join(process.cwd(), 'public/fonts/Quicksand-Bold.ttf')),
  ]);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '26px 52px 28px', backgroundColor: '#eef0ff', fontFamily: 'Quicksand', color: '#1a2030' }}>
      {/* ImageResponse renders native image elements rather than next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;base64,${backdrop}`} alt="" width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${logo.toString('base64')}`} width={32} height={32} alt="" />
          <span style={{ fontSize: 21, fontWeight: 700 }}>Dreamable.studio</span>
        </div>
        <span style={{ fontSize: 17, color: '#777b94' }}>Shared deliverables</span>
      </div>
      {/* The custom vector scene leads; project type and supporting details follow below. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/svg+xml;base64,${hero.toString('base64')}`} width={1080} height={340} alt="" style={{ alignSelf: 'center', marginTop: 8, flexShrink: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', marginTop: 4, fontSize: info.projectName.length > 48 ? 38 : 54, fontWeight: 700, lineHeight: 1.08 }}>{clip(info.projectName, 100)}</div>
      <div style={{ display: 'flex', justifyContent: 'center', textAlign: 'center', marginTop: 12, color: '#777777', fontSize: 22, lineHeight: 1.3 }}>{clip(info.folderNames || 'Your project files, all in one place', 100)}</div>
      <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 14, alignItems: 'center', justifyContent: 'center', gap: 16, color: '#777b94', fontSize: 18 }}>
        <span>{info.foldersLabel}</span>
        <span style={{ color: '#b7bdd0' }}>·</span>
        <span>{info.filesLabel}</span>
        <span style={{ color: '#b7bdd0' }}>·</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#6874c7' }}>
          <span>View project files</span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#6874c7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9H15M10 4L15 9L10 14" /></svg>
        </div>
      </div>
    </div>,
    {
      width: 1200, height: 630,
      fonts: [
        { name: 'Quicksand', data: new Uint8Array(regular).buffer, weight: 400, style: 'normal' },
        { name: 'Quicksand', data: new Uint8Array(bold).buffer, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' },
    },
  );
}
