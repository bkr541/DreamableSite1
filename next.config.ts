import type { NextConfig } from 'next';

// Keep in step with PRIVATE_PATH_PREFIXES in lib/site.ts (a test fails if they drift apart).
const PRIVATE_PATH_PREFIXES = ['/admin', '/dashboard', '/portal', '/share', '/api'];

const nextConfig: NextConfig = {
  // nodemailer 8.x includes optional OpenTelemetry instrumentation that references
  // @opentelemetry/api. Marking both as external prevents Next.js from bundling
  // them — they run natively in the Node.js API route process instead.
  serverExternalPackages: ['nodemailer', '@opentelemetry/api'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Private areas are kept out of search results at the HTTP level too (robots.txt alone is only a request, and a
  // crawler that never fetches the HTML would not see the page's own robots tag). Reset and share links also stop sending
  // their address as a Referer, since it contains a token.
  async headers() {
    const noIndex = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
    ];
    return PRIVATE_PATH_PREFIXES.flatMap((p) => [
      { source: p, headers: noIndex },
      { source: `${p}/:path*`, headers: noIndex },
    ]);
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, { dev }) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
