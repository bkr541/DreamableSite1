import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { zohoConfig } from '@/lib/zohoClient';
import { authorizeUrl, newState, ZOHO_STATE_COOKIE, ZOHO_STATE_COOKIE_PATH } from '@/lib/zohoMail';

// Starts connecting the site to the Zoho mailbox: sends the signed-in admin to Zoho's consent screen. A random `state` is
// kept in a short-lived cookie and checked when Zoho sends them back, so nobody can trick an admin into connecting
// someone else's mailbox.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const cfg = zohoConfig();
  if (!cfg.ok) return NextResponse.redirect(new URL('/admin?view=inbox&zoho=not_configured', req.url));

  const state = newState();
  const res = NextResponse.redirect(authorizeUrl(cfg.config, state));
  res.cookies.set(ZOHO_STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: ZOHO_STATE_COOKIE_PATH, maxAge: 600 });
  return res;
}
