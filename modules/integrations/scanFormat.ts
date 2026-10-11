import type { Prisma } from '@prisma/client';

/** Relations nécessaires pour décrire un scan à une plateforme cliente. */
export const SCAN_API_INCLUDE = {
  qr: { select: { id: true, externalId: true, type: true, metadata: true } },
  user: { select: { name: true, firstName: true } },
} satisfies Prisma.ScanInclude;

type ScanForApi = Prisma.ScanGetPayload<{ include: typeof SCAN_API_INCLUDE }>;

/**
 * Représentation publique d'un scan : identique dans GET /integrations/scans
 * et dans le webhook `scan.created`.
 */
export function formatScanForApi(scan: ScanForApi) {
  const meta = ((scan.metadata ?? scan.qr?.metadata) as Record<string, unknown> | null) ?? {};
  return {
    id: scan.id,
    result: scan.result,
    scannedAt: scan.scannedAt.toISOString(),
    receivedAt: scan.createdAt.toISOString(),
    offline: scan.offline,
    eventId: scan.eventId,
    qr: scan.qr
      ? { id: scan.qr.id, externalId: scan.qr.externalId ?? undefined, type: scan.qr.type }
      : null,
    holderName: (meta.holderName as string | undefined) ?? undefined,
    // Qui a contrôlé : un agent avec l'application ScanHub, ou une plateforme via l'API
    operator: scan.userId
      ? { type: 'agent' as const, name: scan.user?.name || scan.user?.firstName || 'Agent' }
      : { type: 'api' as const },
    deviceId: scan.deviceId,
  };
}
