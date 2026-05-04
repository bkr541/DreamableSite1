import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function sendCodeEmail(to: string, code: string) {
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
    subject: 'Your Dreamable.studio verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Password reset code</h2>
        <p style="color:#555;line-height:1.6;margin-bottom:28px;">
          Use the code below to reset your Dreamable.studio password. This code is single-use.
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f7;border-radius:12px;margin-bottom:28px;">
          ${code}
        </div>
        <p style="color:#aaa;font-size:12px;line-height:1.6;">
          If you didn&apos;t request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 });
    }

    const normalized = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (user) {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await prisma.user.update({
        where: { id: user.id },
        data: { templogincode: code, tempLoginCodeExpiresAt: expiresAt },
      });

      try {
        await sendCodeEmail(user.email, code);
      } catch (mailErr) {
        console.error('[request-code] email failed:', mailErr);
      }
    }

    // Always return ok — don't reveal whether the email exists.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[request-code] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
