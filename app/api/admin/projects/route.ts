import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.admin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const {
    name, companyId, primaryUserId, service, subCategory, description,
    budgetRange, timeline, status, startDate, targetEndDate,
  } = await req.json();

  if (!name?.trim()) return NextResponse.json({ ok: false, error: 'Project name is required.' }, { status: 400 });
  if (!companyId) return NextResponse.json({ ok: false, error: 'Company is required.' }, { status: 400 });
  if (!service?.trim()) return NextResponse.json({ ok: false, error: 'Service is required.' }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ ok: false, error: 'Description is required.' }, { status: 400 });

  try {
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        companyId,
        primaryUserId: primaryUserId || null,
        service: service.trim(),
        subCategory: subCategory?.trim() || null,
        description: description.trim(),
        budgetRange: budgetRange?.trim() || null,
        timeline: timeline?.trim() || null,
        status: status || 'ONBOARDING',
        startDate: startDate ? new Date(startDate) : null,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
      },
    });

    return NextResponse.json({ ok: true, id: project.id });
  } catch (err) {
    console.error('[admin/projects POST]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: process.env.NODE_ENV === 'development' ? msg : 'Internal server error.' }, { status: 500 });
  }
}
