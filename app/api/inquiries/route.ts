import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getClientIp } from '@/lib/clientIp';
import { RULES, consume, firstDenied, tooManyRequests } from '@/lib/rateLimit';
import { logRef, logSecurity } from '@/lib/securityLog';
import { safeEmailAddress } from '@/lib/html';
import { INQUIRY_EXT, safeFileName } from '@/lib/fileTypes';
import { validateUpload } from '@/lib/fileValidation';
import { storageConfigured } from '@/lib/storage';
import { INQUIRY_UPLOAD_MAX_FILES, verifyInquiryUploads } from '@/lib/uploadFlow';
import { enqueueEmail } from '@/lib/emailOutbox';
import { dispatchOutbox } from '@/lib/dispatch';
import { links, notify } from '@/lib/notifications';

/* ── Helpers ── */
const MAX_DESC = 5_000;
// Generous caps: real input is far smaller, and anything longer is trimmed rather than rejected.
const MAX_SHORT = 200;
const MAX_URLISH = 500;
const MAX_JSON_BODY = 64 * 1024;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_FILES * MAX_FILE_BYTES + 512 * 1024;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function trim(val: unknown, max = MAX_URLISH): string {
    return typeof val === 'string' ? val.trim().slice(0, max) : '';
}

/** Cheap spam hints. They never block a visitor; they are stored with the inquiry and logged as counts. */
function spamSignals(description: string): string[] {
    const signals: string[] = [];
    if ((description.match(/https?:\/\//gi) ?? []).length >= 6) signals.push('many-links');
    if (/(.)\1{30,}/.test(description)) signals.push('repeated-characters');
    return signals;
}

/* ── POST /api/inquiries ── */
export async function POST(req: NextRequest) {
    try {
        // Cheapest checks first, before the body is read. The IP comes from the trusted proxy configuration
        // (lib/clientIp.ts), so a spoofed forwarding header does not buy a fresh bucket.
        const ip = getClientIp(req.headers);
        const ipDecision = await consume(RULES.inquiryIp, ip);
        if (!ipDecision.allowed) return tooManyRequests(ipDecision, 'requests');

        const declaredBytes = Number(req.headers.get('content-length') ?? 0);
        const isMultipart = !!req.headers.get('content-type')?.includes('multipart/form-data');
        if (declaredBytes > (isMultipart ? MAX_MULTIPART_BYTES : MAX_JSON_BODY)) {
            return NextResponse.json({ ok: false, message: 'That submission is too large.' }, { status: 413 });
        }

        let body: Record<string, unknown>;
        let files: File[] = [];
        try {
            if (isMultipart) {
                const form = await req.formData();
                body = JSON.parse(String(form.get('payload') ?? '{}'));
                files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
            } else {
                body = await req.json();
            }
            if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad body');
        } catch {
            return NextResponse.json({ ok: false, message: 'We could not read that submission. Please try again.' }, { status: 400 });
        }

        // Honeypot: if filled, silently succeed without inserting
        if (body.website_hp) {
            return NextResponse.json({ ok: true, inquiryId: '00000000-0000-0000-0000-000000000000' });
        }

        // Extract and normalize fields
        const name = trim(body.name, 120);
        const email = trim(body.email, 254);
        const service = trim(body.service, MAX_SHORT);
        const description = trim(body.description, MAX_DESC);
        const company = trim(body.company, MAX_SHORT) || null;
        const website = trim(body.website) || null;
        const budgetRange = trim(body.budget_range, MAX_SHORT) || null;
        const timeline = trim(body.timeline, MAX_SHORT) || null;
        const source = trim(body.source, MAX_SHORT) || null;
        const utmSource = trim(body.utm_source) || null;
        const utmMedium = trim(body.utm_medium) || null;
        const utmCampaign = trim(body.utm_campaign) || null;
        const utmTerm = trim(body.utm_term) || null;
        const utmContent = trim(body.utm_content) || null;
        const referrer = trim(body.referrer) || null;
        const phone = trim(body.phone, MAX_SHORT) || null;
        const projectName = trim(body.project_name, MAX_SHORT) || null;
        const extra = { ...(phone && { phone }), ...(projectName && { projectName }) };
        const signals = spamSignals(description);
        // Client-supplied metadata is kept only when it is a small plain object.
        const clientMeta =
            body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) && JSON.stringify(body.metadata).length <= 2000
                ? (body.metadata as Record<string, unknown>)
                : {};
        const metadata =
            Object.keys(clientMeta).length || Object.keys(extra).length || signals.length
                ? { ...clientMeta, ...extra, ...(signals.length && { spamSignals: signals }) }
                : null;

        // Validate required fields
        if (!name) {
            return NextResponse.json({ ok: false, message: 'Name is required.' }, { status: 400 });
        }
        if (!email || !safeEmailAddress(email)) {
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

        if (files.length > MAX_FILES) {
            return NextResponse.json(
                { ok: false, message: `You can attach up to ${MAX_FILES} files.` },
                { status: 400 }
            );
        }
        for (const f of files) {
            if (f.size > MAX_FILE_BYTES) {
                return NextResponse.json(
                    { ok: false, message: `${f.name} is larger than 10 MB.` },
                    { status: 400 }
                );
            }
            if (!INQUIRY_EXT.test(f.name)) {
                return NextResponse.json(
                    { ok: false, message: `${f.name} is not a supported file type.` },
                    { status: 400 }
                );
            }
        }
        // Files sent with the form itself (used when object storage isn't configured). Their real bytes are checked.
        const attachments: { filename: string; content: Buffer; contentType: string; sha256: string }[] = [];
        for (const f of files) {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const checked = await validateUpload({ fileName: safeFileName(f.name), declaredType: f.type, bytes });
            if (!checked.ok) return NextResponse.json({ ok: false, message: checked.error }, { status: 400 });
            attachments.push({ filename: safeFileName(f.name), content: Buffer.from(bytes), contentType: checked.contentType, sha256: checked.sha256 });
        }

        // Files uploaded straight to storage beforehand are referenced by id (see /api/inquiries/uploads).
        const uploadIds: string[] = Array.isArray(body.uploadIds)
            ? [...new Set(body.uploadIds.filter((v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)))]
            : [];
        if (uploadIds.length && !storageConfigured()) {
            return NextResponse.json({ ok: false, message: 'Attachments are unavailable right now. Please try again.' }, { status: 400 });
        }
        if (files.length + uploadIds.length > INQUIRY_UPLOAD_MAX_FILES) {
            return NextResponse.json({ ok: false, message: `You can attach up to ${INQUIRY_UPLOAD_MAX_FILES} files.` }, { status: 400 });
        }

        // The same address can't be used to bury the inbox, and an accidental double-submit or a retry after a
        // dropped connection is answered with the original inquiry instead of creating (and emailing) a copy.
        if (process.env.DATABASE_URL) {
            const existing = await prisma.inquiry.findFirst({
                where: { email, description, createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
                select: { id: true },
            });
            if (existing) return NextResponse.json({ ok: true, inquiryId: existing.id });
        }
        const emailDecision = await consume(RULES.inquiryEmail, email);
        if (!emailDecision.allowed) return tooManyRequests(emailDecision, 'requests for this email address');

        if (signals.length) logSecurity('inquiry.spam_signal', { signals: signals.join(','), ref: logRef(ip) });

        // Verify pre-uploaded files before anything is saved: if one is not what it claims to be, nothing is attached.
        let claimed: Awaited<ReturnType<typeof verifyInquiryUploads>> = { ok: true, files: [] };
        if (uploadIds.length) {
            claimed = await verifyInquiryUploads(uploadIds);
            if (!claimed.ok) return NextResponse.json({ ok: false, message: claimed.error }, { status: 400 });
        }
        const storedFiles = claimed.ok ? claimed.files : [];

        // Persist to database
        let inquiryId = 'demo-' + Date.now();

        if (process.env.DATABASE_URL) {
            const inquiry = await prisma.$transaction(async (tx) => {
                const created = await tx.inquiry.create({
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
                        metadata: metadata as Prisma.InputJsonValue | undefined,
                        attachments: {
                            create: attachments.map((a) => ({
                                fileName: a.filename,
                                contentType: a.contentType,
                                size: a.content.length,
                                sha256: a.sha256,
                                data: new Uint8Array(a.content),
                            })),
                        },
                    },
                    select: { id: true },
                });
                // The emails and the admin notification are written in the SAME transaction as the inquiry: if the
                // inquiry is saved, so are they — and a mail outage afterwards can delay them but not lose them.
                await enqueueEmail(tx, [
                    {
                        eventType: 'inquiry.notification', recipient: process.env.INQUIRY_TO_EMAIL || '(staff inbox)',
                        dedupeKey: `inquiry.notification:${created.id}`, payload: { inquiryId: created.id }, entityType: 'inquiry', entityId: created.id,
                    },
                    {
                        eventType: 'inquiry.confirmation', recipient: email,
                        dedupeKey: `inquiry.confirmation:${created.id}`, payload: { inquiryId: created.id }, entityType: 'inquiry', entityId: created.id,
                    },
                ]);
                await notify(tx, {
                    type: 'inquiry.new', title: `New inquiry from ${name}`, body: `${service}${projectName ? ` — ${projectName}` : ''}`,
                    entityType: 'inquiry', entityId: created.id, url: links.inquiry(created.id), dedupeKey: `inquiry.new:${created.id}`,
                });
                // Claim the pre-uploaded files in the same transaction: they become visible only if the inquiry is saved.
                for (const f of storedFiles) {
                    const { count } = await tx.inquiryAttachment.updateMany({
                        where: { id: f.id, status: 'PENDING', inquiryId: null },
                        data: { inquiryId: created.id, status: 'READY', size: f.size, sha256: f.sha256, contentType: f.contentType },
                    });
                    if (count !== 1) throw new Error('attachment was no longer available');
                }
                return created;
            });
            inquiryId = inquiry.id;
        } else if (process.env.NODE_ENV === 'production') {
            // Never report success for an inquiry that wasn't saved.
            console.error('[POST /api/inquiries] DATABASE_URL not set — inquiry was NOT saved.', { name, email, service });
            return NextResponse.json(
                { ok: false, message: 'Something went wrong. Please try again later.' },
                { status: 500 }
            );
        } else {
            console.warn(
                '[POST /api/inquiries] DATABASE_URL not set — skipping DB insert.',
                { name, email, service }
            );
        }

        // Try to send right away (after the response). If that doesn't happen for any reason, the queued emails
        // are picked up by the retry job — the visitor's inquiry is already saved either way.
        if (process.env.DATABASE_URL) dispatchOutbox();

        return NextResponse.json({ ok: true, inquiryId });
    } catch (error) {
        console.error('[POST /api/inquiries] Error:', error);
        return NextResponse.json(
            { ok: false, message: 'Something went wrong. Please try again later.' },
            { status: 500 }
        );
    }
}
