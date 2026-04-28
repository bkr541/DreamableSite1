import { NextRequest, NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

function buildToken(email: string): string {
  const secret = process.env.RESET_SECRET ?? 'change-me-in-production';
  const exp = Date.now() + 60 * 60 * 1000; // 1 hour
  const payload = Buffer.from(JSON.stringify({ email, exp, nonce: randomBytes(8).toString('hex') })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function sendResetEmail(to: string, resetUrl: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, INQUIRY_FROM_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('SMTP not configured.');

  const port = Number(SMTP_PORT ?? 587);
  const fromAddress = INQUIRY_FROM_EMAIL ?? SMTP_USER;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Dreamable.studio" <${fromAddress}>`,
    to,
    subject: 'Reset your Dreamable.studio password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Reset your password</h2>
        <p style="color:#555;line-height:1.6;margin-bottom:28px;">
          We received a request to reset the password for your Dreamable.studio account.
          Click the button below to choose a new password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 32px;background:#1a2030;color:#fff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:500;">
          Reset Password
        </a>
        <p style="color:#aaa;font-size:12px;margin-top:32px;line-height:1.6;">
          If you didn&apos;t request this, you can safely ignore this email.
          Your password will not change until you click the link above.
        </p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }

    // Look up the user — but always return 200 to avoid exposing which emails exist.
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (user) {
      const token = buildToken(user.email);
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const resetUrl = `${appUrl}/portal/reset-password?token=${token}`;

      await sendResetEmail(user.email, resetUrl);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
