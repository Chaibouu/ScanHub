import { NextRequest } from 'next/server';
import { qrService } from '@/modules/qr/qrService';
import { authorizeScanRequest } from '@/lib/scanAuth';
import { toViewer } from '@/lib/tenant';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MAX_BATCH_SIZE = 500;
// Tolérance d'horloge des terminaux pour un scan daté « dans le futur »
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const pushSchema = z.object({
  scans: z
    .array(
      z.object({
        clientId: z.string().trim().min(8).max(100),
        token: z.string().trim().min(1).max(512),
        eventId: z.string().optional(),
        result: z.enum([
          'VALID',
          'INVALID',
          'EXPIRED',
          'REVOKED',
          'ALREADY_USED',
          'EVENT_CLOSED',
          'UNAUTHORIZED',
          'DEVICE_BLOCKED',
        ]),
        scannedAt: z.string().datetime({ offset: true }),
      })
    )
    .max(MAX_BATCH_SIZE),
});

type PushStatus = 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';

export async function POST(req: NextRequest) {
  try {
    // Session de l'agent et terminal vérifiés en parallèle
    const scanAuth = await authorizeScanRequest(req);
    if (!scanAuth.ok) return scanAuth.response;
    const { user, deviceId } = scanAuth;

    const body = await req.json().catch(() => null);
    const parsed = pushSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Format de synchronisation invalide', 400, parsed.error.format());
    }

    const { scans } = parsed.data;
    const { organizationId } = toViewer(user);
    const results: Array<{ clientId: string; status: PushStatus; result?: string; message?: string }> = [];
    const counters: Record<PushStatus, number> = { ACCEPTED: 0, DUPLICATE: 0, CONFLICT: 0, REJECTED: 0 };
    const latestAllowed = Date.now() + CLOCK_SKEW_MS;

    for (const scanItem of scans) {
      try {
        const claimedAt = new Date(scanItem.scannedAt);
        const scannedAt = claimedAt.getTime() > latestAllowed ? new Date() : claimedAt;

        // L'opérateur et le terminal viennent de l'authentification ; le résultat annoncé
        // par le terminal est revalidé côté serveur (voir qrService.recordOfflineScan).
        const outcome = await qrService.recordOfflineScan({
          organizationId,
          token: scanItem.token,
          clientId: scanItem.clientId,
          eventId: scanItem.eventId,
          userId: user.id,
          deviceId,
          claimedResult: scanItem.result,
          scannedAt,
        });

        counters[outcome.status]++;
        results.push({ clientId: scanItem.clientId, ...outcome });
      } catch (error) {
        // Un scan en échec ne doit pas bloquer le reste du lot
        logger.error({ err: error, clientId: scanItem.clientId }, 'Échec de synchronisation d’un scan');
        counters.REJECTED++;
        results.push({
          clientId: scanItem.clientId,
          status: 'REJECTED',
          message: 'Scan non enregistré, à renvoyer.',
        });
      }
    }

    return jsonSuccess({
      total: scans.length,
      accepted: counters.ACCEPTED,
      conflicts: counters.CONFLICT,
      duplicates: counters.DUPLICATE,
      failed: counters.REJECTED,
      results,
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors du traitement du push sync');
  }
}
