import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser, ADMIN_ROLES } from '@/lib/rbac';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeUser(req);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        source: { select: { id: true, name: true, slug: true } },
        _count: { select: { qrCodes: true, scans: true } },
      },
    });

    if (!event) {
      return jsonError('Événement introuvable', 404);
    }

    const [byResult, offlineCount] = await Promise.all([
      prisma.scan.groupBy({
        by: ['result'],
        where: { eventId: id },
        _count: { _all: true },
      }),
      prisma.scan.count({ where: { eventId: id, offline: true } }),
    ]);

    const count = (result: string) =>
      byResult.find((g) => g.result === result)?._count._all ?? 0;
    const validCount = count('VALID');

    return jsonSuccess({
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        organization: event.organization,
        source: event.source,
        stats: {
          totalTickets: event._count.qrCodes,
          totalScans: event._count.scans,
          valid: validCount,
          alreadyUsed: count('ALREADY_USED'),
          revoked: count('REVOKED'),
          expired: count('EXPIRED'),
          invalid: count('INVALID'),
          offlineScans: offlineCount,
          attendanceRate:
            event._count.qrCodes > 0
              ? Math.round((validCount / event._count.qrCodes) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération de l’événement');
  }
}

const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeUser(req, ADMIN_ROLES);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Paramètres de mise à jour invalides', 400, parsed.error.format());
    }

    const existing = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return jsonError('Événement introuvable', 404);
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.startsAt ? { startsAt: new Date(parsed.data.startsAt) } : {}),
        ...(parsed.data.endsAt ? { endsAt: new Date(parsed.data.endsAt) } : {}),
      },
    });

    return jsonSuccess({
      event: updated,
      message: 'Événement mis à jour avec succès.',
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la mise à jour');
  }
}
