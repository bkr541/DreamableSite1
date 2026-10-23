import { readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const IMAGE_EXT = ['png', 'jpg', 'jpeg'];
const BRAND_TEXT = 'Dreamable.studio';

const ext = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

/** Watermarking is supported for raster images and PDFs; other types are served untouched. */
export function canWatermark(fileName: string) {
  const e = ext(fileName);
  return IMAGE_EXT.includes(e) || e === 'pdf';
}

const publicPath = (name: string) => path.join(process.cwd(), 'public', 'images', name);

let logoCache: Buffer | null = null;
async function logoPng() {
  // The source logo is huge; embed a small copy so watermarked files stay light.
  logoCache ??= await sharp(await readFile(publicPath('logo_transparent.png'))).resize({ width: 256 }).png().toBuffer();
  return logoCache;
}

// Image watermark: the logo plus wordmark, tiled diagonally across the whole image so it can't be cropped out.
async function watermarkImage(data: Uint8Array, e: string) {
  const image = sharp(data, { failOn: 'none' }).rotate();
  const { width = 0, height = 0 } = await image.metadata();
  const base = Math.max(120, Math.round(Math.min(width, height) / 6));
  const tileW = Math.round(base * 4.4);
  const tileH = Math.round(base * 1.5);
  const logoSize = Math.round(base * 0.7);
  const logoB64 = (await logoPng()).toString('base64');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}">
    <defs>
      <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <image href="data:image/png;base64,${logoB64}" x="0" y="${(tileH - logoSize) / 2}" width="${logoSize}" height="${logoSize}" opacity="0.5"/>
        <text x="${logoSize + base * 0.12}" y="${tileH / 2 + base * 0.1}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(base * 0.32)}" font-weight="700" fill="#ffffff" fill-opacity="0.55" stroke="#000000" stroke-opacity="0.25" stroke-width="${Math.max(1, base * 0.012)}">${BRAND_TEXT}</text>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wm)"/>
  </svg>`;

  const out = image.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
  return new Uint8Array(await (e === 'png' ? out.png() : out.jpeg({ quality: 90 })).toBuffer());
}

// PDF watermark: the same logo + wordmark repeated on a grid on every page.
async function watermarkPdf(data: Uint8Array) {
  const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
  const logo = await pdf.embedPng(await logoPng());
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(14, Math.min(width, height) / 18);
    const logoSize = size * 1.3;
    const stepX = size * 11;
    const stepY = size * 7;
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawImage(logo, { x, y, width: logoSize, height: logoSize, opacity: 0.35, rotate: degrees(28) });
        page.drawText(BRAND_TEXT, {
          x: x + logoSize * 1.1,
          y: y + logoSize * 0.2,
          size,
          font,
          color: rgb(0.45, 0.45, 0.5),
          opacity: 0.35,
          rotate: degrees(28),
        });
      }
    }
  }
  return new Uint8Array(await pdf.save());
}

export async function applyWatermark(fileName: string, data: Uint8Array): Promise<Uint8Array> {
  const e = ext(fileName);
  if (e === 'pdf') return watermarkPdf(data);
  if (IMAGE_EXT.includes(e)) return watermarkImage(data, e);
  return data;
}
