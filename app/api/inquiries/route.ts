import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

/* ── In-memory rate limiter (best-effort, per-instance) ──────────────────────
   This is per-instance and not suitable for distributed production.
   To scale, replace isRateLimited() with a Redis/Upstash-backed implementation
   that shares state across instances, e.g. @upstash/ratelimit + KV store.     */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;       // max requests per window
const RATE_WINDOW = 60_000; // 60-second window

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
}

/* ── Email notification ───────────────────────────────────────────────────── */
interface InquiryPayload {
    inquiryId: string;
    name: string;
    email: string;
    company: string | null;
    website: string | null;
    service: string;
    description: string;
    budgetRange: string | null;
    timeline: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    referrer: string | null;
}

async function sendInquiryEmail(inquiry: InquiryPayload): Promise<void> {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, INQUIRY_TO_EMAIL, INQUIRY_FROM_EMAIL } =
        process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !INQUIRY_TO_EMAIL) {
        console.warn('[sendInquiryEmail] SMTP not fully configured — skipping email notification.');
        return;
    }

    const port = Number(SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const row = (label: string, value: string | null | undefined) =>
        value
            ? `<tr>
                 <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${label}</td>
                 <td style="padding:8px 12px;border-bottom:1px solid #eee;">${value}</td>
               </tr>`
            : '';

    const html = `
      <h2 style="font-family:sans-serif;margin-bottom:16px;">New Inquiry — Dreamable.studio</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;max-width:640px;width:100%;">
        ${row('Inquiry ID', inquiry.inquiryId)}
        ${row('Name', inquiry.name)}
        ${row('Email', `<a href="mailto:${inquiry.email}">${inquiry.email}</a>`)}
        ${row('Company', inquiry.company)}
        ${row('Website', inquiry.website)}
        ${row('Service', inquiry.service)}
        ${row('Budget', inquiry.budgetRange)}
        ${row('Timeline', inquiry.timeline)}
        ${row('UTM Source', inquiry.utmSource)}
        ${row('UTM Medium', inquiry.utmMedium)}
        ${row('UTM Campaign', inquiry.utmCampaign)}
        ${row('UTM Term', inquiry.utmTerm)}
        ${row('UTM Content', inquiry.utmContent)}
        ${row('Referrer', inquiry.referrer)}
      </table>
      <h3 style="font-family:sans-serif;margin-top:24px;margin-bottom:8px;">Description</h3>
      <p style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;background:#f9f9f9;padding:12px;border-radius:4px;max-width:640px;">${inquiry.description}</p>
      <p style="font-family:sans-serif;font-size:12px;color:#999;margin-top:24px;">Sent from Dreamable.studio contact form</p>
    `;

    const from = INQUIRY_FROM_EMAIL || SMTP_USER;

    await transporter.sendMail({
        from: `"Dreamable.studio" <${from}>`,
        to: INQUIRY_TO_EMAIL,
        replyTo: inquiry.email,
        subject: `New Inquiry: ${inquiry.name} — ${inquiry.service}`,
        html,
    });
}

/* ── Helpers ── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_DESC = 5_000;

function trim(val: unknown): string {
    return typeof val === 'string' ? val.trim() : '';
}

/* ── POST /api/inquiries ── */
export async function POST(req: NextRequest) {
    try {
        // Rate limit by IP
        const ip =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { ok: false, message: 'Too many requests. Please wait a moment.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // Honeypot: if filled, silently succeed without inserting
        if (body.website_hp) {
            return NextResponse.json({ ok: true, inquiryId: '00000000-0000-0000-0000-000000000000' });
        }

        // Extract and normalize fields
        const name = trim(body.name);
        const email = trim(body.email);
        const service = trim(body.service);
        const description = trim(body.description).slice(0, MAX_DESC);
        const company = trim(body.company) || null;
        const website = trim(body.website) || null;
        const budgetRange = trim(body.budget_range) || null;
        const timeline = trim(body.timeline) || null;
        const source = trim(body.source) || null;
        const utmSource = trim(body.utm_source) || null;
        const utmMedium = trim(body.utm_medium) || null;
        const utmCampaign = trim(body.utm_campaign) || null;
        const utmTerm = trim(body.utm_term) || null;
        const utmContent = trim(body.utm_content) || null;
        const referrer = trim(body.referrer) || null;
        const metadata = body.metadata ?? null;

        // Validate required fields
        if (!name) {
            return NextResponse.json({ ok: false, message: 'Name is required.' }, { status: 400 });
        }
        if (!email || !EMAIL_RE.test(email)) {
            return NextResponse.json(
                { ok: false, message: 'A valid email is required.' },
                { status: 400 }
            );
        }
        if (!service) {
            return NextResponse.json(
                { ok: false, message: 'Service type is required.' },
                { status: 400 }
            );
        }
        if (!description) {
            return NextResponse.json(
                { ok: false, message: 'Description is required.' },
                { status: 400 }
            );
        }

        // Persist to database
        let inquiryId = 'demo-' + Date.now();

        if (process.env.DATABASE_URL) {
            const inquiry = await prisma.inquiry.create({
                data: {
                    name,
                    email,
                    company,
                    website,
                    service,
                    description,
                    budgetRange,
                    timeline,
                    source,
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    utmTerm,
                    utmContent,
                    referrer,
                    metadata,
                },
                select: { id: true },
            });
            inquiryId = inquiry.id;
        } else {
            console.warn(
                '[POST /api/inquiries] DATABASE_URL not set — skipping DB insert.',
                { name, email, service }
            );
        }

        // Fire-and-forget email notification; never blocks the response
        sendInquiryEmail({
            inquiryId,
            name,
            email,
            company,
            website,
            service,
            description,
            budgetRange,
            timeline,
            utmSource,
            utmMedium,
            utmCampaign,
            utmTerm,
            utmContent,
            referrer,
        }).catch((err) => {
            console.error('[sendInquiryEmail] Failed to send notification:', err);
        });

        return NextResponse.json({ ok: true, inquiryId });
    } catch (error) {
        console.error('[POST /api/inquiries] Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Something went wrong. Please try again later.' },
            { status: 500 }
        );
    }
}
