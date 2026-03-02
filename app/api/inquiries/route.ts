import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ── In-memory rate limiter (best-effort, per-instance) ── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;          // max requests
const RATE_WINDOW = 60_000;    // per 60 seconds

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
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        if (isRateLimited(ip)) {
            return NextResponse.json(
                { ok: false, message: 'Too many requests. Please wait a moment.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // Honeypot: if website_hp is filled, silently succeed without inserting
        if (body.website_hp) {
            return NextResponse.json({ ok: true, inquiryId: '00000000-0000-0000-0000-000000000000' });
        }

        // Extract and trim fields
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
            return NextResponse.json({ ok: false, message: 'A valid email is required.' }, { status: 400 });
        }
        if (!service) {
            return NextResponse.json({ ok: false, message: 'Service type is required.' }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ ok: false, message: 'Description is required.' }, { status: 400 });
        }

        // Insert
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

        return NextResponse.json({ ok: true, inquiryId: inquiry.id });
    } catch (error) {
        console.error('[POST /api/inquiries] Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Something went wrong. Please try again later.' },
            { status: 500 }
        );
    }
}
