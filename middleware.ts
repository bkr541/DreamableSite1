import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'ds_session';

interface SessionPayload {
  userId: string;
  email: string;
  admin: boolean;
  exp: number;
}

function b64urlToBytes(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(data),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(data))) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET ?? 'change-me-in-production';
  const session = token ? await verifySession(token, secret) : null;

  if (pathname.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/portal', req.url));
    if (!session.admin) return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (pathname.startsWith('/dashboard')) {
    if (!session) return NextResponse.redirect(new URL('/portal', req.url));
    if (session.admin) return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
