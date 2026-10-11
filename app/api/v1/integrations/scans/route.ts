import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { Prisma, ScanResult } from '@prisma/client';
import { formatScanForApi, SCAN_API_INCLUDE } from '@/modules/integrations/scanFormat';

const MAX_PAGE_SIZE = 500;

/**
 * GET /api/v1/integrations/scans — scans de votre espace (présences), du plus ancien au plus récent.
 *
 * Lecture incrémentale : conservez `nextCursor` et repassez-le dans `?after=` à l'appel suivant
 * pour ne recevoir que les nouveaux scans. L'ordre suit l'heure de réception par ScanHub, donc
 * un scan réalisé hors-ligne et synchronisé plus tard n'est jamais manqué.
 *
 *   ?eventId=…   ?result=VALID|ALREADY_USED|…   ?limit=1…500 (défaut 100)   ?after=<curseur>
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const search = req.nextUrl.searchParams;
    const eventId = search.get('eventId') || undefined;
    const result = search.get('result') || undefined;
    const after = search.get('after') || undefined;
    const limit = Math.min(Math.max(parseInt(search.get('limit') || '100', 10) || 100, 1), MAX_PAGE_SIZE);

    if (result && !(result in ScanResult)) {
      return jsonError('Paramètre result invalide', 400);
    }

    const where: Prisma.ScanWhereInput = {
      organizationId: auth.source.organizationId,
      ...(eventId ? { eventId } : {}),
      ...(result ? { result: result as ScanResult } : {}),
    };

    if (after) {
      // Le curseur doit désigner un scan de ce même espace
      const cursor = await prisma.scan.findFirst({
        where: { id: after, organizationId: auth.source.organizationId },
        select: { id: true },
      });
      if (!cursor) return jsonError('Paramètre after invalide', 400);
    }

    const rows = await prisma.scan.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      include: SCAN_API_INCLUDE,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const scans = page.map(formatScanForApi);

    return jsonSuccess({
      scans,
      hasMore,
      // À repasser dans ?after= ; inchangé quand il n'y a rien de nouveau
      nextCursor: page.length > 0 ? page[page.length - 1].id : (after ?? null),
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des scans');
  }
}
