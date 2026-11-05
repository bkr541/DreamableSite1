// Regenerates the small brand images from the master logo in design-source/:
//   app/icon.png        browser-tab icon (64px: it is fetched on every first visit) (Next.js serves it as /icon.png and adds the <link>)
//   app/apple-icon.png  home-screen icon
//   public/og.png       1200x630 link-preview image used for Open Graph / Twitter cards
//
//   node scripts/generate-brand-images.mjs
import sharp from 'sharp';

const SRC = 'design-source/logo_transparent.png';
const NAVY = '#1a2030';

const logo = (w) => sharp(SRC).resize({ width: w }).png().toBuffer();

// Square icons: the logo, centred, on a transparent (tab) or white (home screen) square.
async function square(size, background, file) {
  const inner = await sharp(SRC).resize({ width: Math.round(size * 0.86), height: Math.round(size * 0.86), fit: 'inside' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: inner, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log('wrote', file);
}
await square(64, { r: 0, g: 0, b: 0, alpha: 0 }, 'app/icon.png');
await square(180, { r: 255, g: 255, b: 255, alpha: 1 }, 'app/apple-icon.png');

// Link preview card: brand navy, brand gradient bar, logo and the studio name/tagline (all copy already on the site).
const W = 1200, H = 630;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#3DD9C8"/><stop offset="0.5" stop-color="#7BB5F5"/><stop offset="1" stop-color="#B87AF5"/></linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.2" r="0.7"><stop offset="0" stop-color="#4f6df5" stop-opacity="0.35"/><stop offset="1" stop-color="#4f6df5" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect y="${H - 14}" width="${W}" height="14" fill="url(#bar)"/>
  <text x="96" y="330" font-family="Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#ffffff">Dreamable.studio</text>
  <text x="96" y="404" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#c7cde0">A digital product and creative studio.</text>
  <text x="96" y="452" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#c7cde0">Brands, software, and systems that ship.</text>
</svg>`;
await sharp(Buffer.from(svg))
  .composite([{ input: await logo(250), left: W - 250 - 80, top: 190 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');
console.log('wrote public/og.png');
