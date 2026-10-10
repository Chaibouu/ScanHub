import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser } from '@/lib/rbac';
import { scope, toViewer } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const viewer = toViewer(auth.user);

    const [events, scanGroups] = await Promise.all([
      prisma.event.findMany({
        where: scope.events(viewer),
        orderBy: { startsAt: 'desc' },
        include: {
          organization: true,
          _count: { select: { qrCodes: true, scans: true } },
        },
      }),
      // Une seule requête agrégée au lieu de deux COUNT par événement
      prisma.scan.groupBy({
        by: ['eventId', 'result'],
        where: { eventId: { not: null }, event: scope.events(viewer) },
        _count: { _all: true },
      }),
    ]);

    const validByEvent = new Map<string, number>();
    for (const group of scanGroups) {
      if (group.eventId && group.result === 'VALID') {
        validByEvent.set(group.eventId, group._count._all);
      }
    }

    const formatted = events.map((evt) => {
      const validScans = validByEvent.get(evt.id) ?? 0;
      return {
        id: evt.id,
        name: evt.name,
        status: evt.status,
        startsAt: evt.startsAt.toISOString(),
        endsAt: evt.endsAt.toISOString(),
        organizationId: evt.organizationId,
        organization: {
          id: evt.organization.id,
          name: evt.organization.name,
        },
        stats: {
          totalTickets: evt._count.qrCodes,
          totalScanned: evt._count.scans,
          validScans,
          rejectedScans: evt._count.scans - validScans,
        },
      };
    });

    return jsonSuccess({ events: formatted });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des événements');
  }
}
