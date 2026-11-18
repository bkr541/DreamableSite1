import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { getResetSecret } from '@/lib/secrets';
import { exchangeCode, fetchAccount, forgetCached, zohoConfig } from '@/lib/zohoClient';
import { encryptToken, statesMatch, ZOHO_STATE_COOKIE, ZOHO_STATE_COOKIE_PATH } from '@/lib/zohoMail';

// Where Zoho sends the admin back after they approve (or refuse) access. Registered with Zoho as
// https://dreamable.studio/api/auth/zoho/callback. It only works for a signed-in ADMIN whose browser holds the matching
// one-time state; everyone else is bounced. The refresh token is encrypted before it touches the database.
export async function GET(req: NextRequest) {
  const done = (status: string) => {
    const res = NextResponse.redirect(new URL(`/admin?view=messages&hub=inbox&zoho=${status}`, req.url));
    res.cookies.set(ZOHO_STATE_COOKIE, '', { path: ZOHO_STATE_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.redirect(new URL('/portal', req.url));

  const url = new URL(req.url);
  if (url.searchParams.get('error')) return done('denied');
  const code = url.searchParams.get('code');
  if (!code || !statesMatch(url.searchParams.get('state'), req.cookies.get(ZOHO_STATE_COOKIE)?.value)) return done('error');

  const cfg = zohoConfig();
  if (!cfg.ok) return done('not_configured');

  try {
    const tokens = await exchangeCode(cfg.config, code);
    const account = await fetchAccount(tokens.accessToken, cfg.config.region);
    const enc = encryptToken(tokens.refreshToken, getResetSecret());
    await prisma.$transaction(async (tx) => {
      await tx.zohoConnection.deleteMany({}); // one mailbox at a time: connecting again replaces it
      await tx.zohoConnection.create({ data: { region: cfg.config.region, accountId: account.accountId, mailboxAddress: account.mailbox, refreshTokenEnc: enc, connectedById: auth.user.id } });
      await recordAudit(tx, { actorId: auth.user.id, action: 'zoho.connect', targetType: 'zoho_connection', metadata: { mailbox: account.mailbox, region: cfg.config.region } });
    });
    forgetCached();
    return done('connected');
  } catch (err) {
    // Log what kind of failure it was; never the code, a token or the response body.
    console.error('[zoho callback]', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error');
    return done('error');
  }
}
