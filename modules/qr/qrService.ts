import prisma from '@/lib/prisma';
import { hashToken } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { webhookService } from '@/modules/webhooks/webhookService';
import { Prisma, ScanResult, QRStatus, QRType } from '@prisma/client';

export interface VerifyInput {
  /** Espace de l'opérateur — null pour le propriétaire de la plateforme (aucun filtre) */
  organizationId: string | null;
  token: string;
  eventId?: string;
  source?: string;
  type?: QRType;
}

export interface ConsumeInput {
  organizationId: string | null;
  token: string;
  eventId?: string;
  /** Opérateur : un agent (userId) ou une plateforme cliente via sa clé API (sourceId) */
  userId?: string;
  sourceId?: string;
  deviceId?: string;
  clientId: string; // Idempotency UUID
}

export interface OfflineScanInput {
  organizationId: string | null;
  token: string;
  clientId: string;
  eventId?: string;
  userId: string;
  deviceId?: string;
  claimedResult: ScanResult;
  scannedAt: Date;
}

type QRWithRelations = Prisma.QRCodeGetPayload<{ include: { source: true; event: true } }>;

const QR_INCLUDE = { source: true, event: true } as const;

/**
 * Recherche d'un QR par son token, limitée à l'espace de l'opérateur.
 * Un QR appartenant à un autre client est indiscernable d'un QR inexistant.
 */
function qrWhere(tokenHash: string, organizationId: string | null): Prisma.QRCodeWhereInput {
  return {
    tokenHash,
    ...(organizationId === null ? {} : { source: { organizationId } }),
  };
}

interface Evaluation {
  code: ScanResult;
  status: QRStatus;
  message: string;
}

/**
 * Règle métier unique de validité d'un QR code, partagée par verify, consume
 * et la réconciliation des scans hors-ligne.
 */
export function evaluateQR(
  qr: QRWithRelations,
  opts: { eventId?: string; at: Date }
): Evaluation {
  if (qr.status === 'REVOKED' || qr.status === 'BLOCKED') {
    return {
      code: 'REVOKED',
      status: qr.status,
      message: 'Ce pass a été révoqué par la sécurité.',
    };
  }

  if (qr.status === 'PENDING') {
    return {
      code: 'INVALID',
      status: qr.status,
      message: "Ce pass n'est pas encore activé.",
    };
  }

  if (qr.status === 'USED' && !qr.reusable) {
    return {
      code: 'ALREADY_USED',
      status: qr.status,
      message: 'Ce billet à usage unique a déjà été validé à l’entrée.',
    };
  }

  if (qr.status === 'EXPIRED' || (qr.expiresAt && qr.expiresAt < opts.at)) {
    return {
      code: 'EXPIRED',
      status: 'EXPIRED',
      message: 'La période de validité de ce pass est expirée.',
    };
  }

  if (opts.eventId && qr.eventId && qr.eventId !== opts.eventId) {
    return {
      code: 'UNAUTHORIZED',
      status: qr.status,
      message: 'Ce pass n’est pas associé à l’événement actuellement sélectionné.',
    };
  }

  if (qr.event && qr.event.status !== 'ACTIVE') {
    return {
      code: 'EVENT_CLOSED',
      status: qr.status,
      message:
        qr.event.status === 'PAUSED'
          ? 'Les contrôles sont suspendus pour cet événement.'
          : 'Cet événement est clôturé.',
    };
  }

  return {
    code: 'VALID',
    status: qr.status,
    message: qr.reusable
      ? 'Badge réutilisable vérifié avec succès.'
      : 'Billet valide prêt pour validation d’entrée.',
  };
}

function describe(qr: QRWithRelations) {
  return {
    reusable: qr.reusable,
    qr: formatQRSummary(qr),
    holder: extractHolder(qr.metadata),
    event: qr.event ? { id: qr.event.id, name: qr.event.name } : undefined,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2002 : requête Prisma ; P2010 + 23505 : requête SQL brute
  return (
    error.code === 'P2002' ||
    (error.code === 'P2010' && (error.meta as { code?: string } | undefined)?.code === '23505')
  );
}

async function replayExistingScan(clientId: string, now: Date, organizationId: string | null) {
  const existingScan = await prisma.scan.findUnique({
    where: { clientId },
    include: { qr: { include: QR_INCLUDE } },
  });
  if (!existingScan) return null;

  // Une clé d'idempotence déjà utilisée dans un autre espace ne révèle rien de son scan
  if (organizationId !== null && existingScan.organizationId !== organizationId) {
    return {
      valid: false,
      code: 'INVALID' as ScanResult,
      status: 'BLOCKED' as QRStatus,
      reusable: false,
      consumed: false,
      message: 'Identifiant de requête (clientId) déjà utilisé.',
      verifiedAt: now.toISOString(),
    };
  }

  return {
    valid: existingScan.result === 'VALID',
    code: existingScan.result,
    status: existingScan.qr?.status || ('BLOCKED' as QRStatus),
    reusable: existingScan.qr?.reusable ?? false,
    message: 'Scan déjà enregistré (requête idempotente).',
    qr: existingScan.qr ? formatQRSummary(existingScan.qr) : undefined,
    holder: extractHolder(existingScan.metadata ?? existingScan.qr?.metadata),
    event: existingScan.qr?.event
      ? { id: existingScan.qr.event.id, name: existingScan.qr.event.name }
      : undefined,
    consumed: existingScan.result === 'VALID',
    consumedAt: existingScan.scannedAt.toISOString(),
    verifiedAt: now.toISOString(),
  };
}

export const qrService = {
  /**
   * Verify QR state without mutation (Read-Only)
   */
  async verify(input: VerifyInput) {
    const tokenHash = hashToken(input.token);
    const now = new Date();

    const qr = await prisma.qRCode.findFirst({
      where: qrWhere(tokenHash, input.organizationId),
      include: QR_INCLUDE,
    });

    if (!qr) {
      return {
        valid: false,
        code: 'INVALID' as ScanResult,
        status: 'BLOCKED' as QRStatus,
        reusable: false,
        message: 'QR code inconnu ou introuvable dans le système ScanHub.',
        verifiedAt: now.toISOString(),
      };
    }

    const evaluation = evaluateQR(qr, { eventId: input.eventId, at: now });

    return {
      valid: evaluation.code === 'VALID',
      code: evaluation.code,
      status: evaluation.status,
      message: evaluation.message,
      ...describe(qr),
      verifiedAt: now.toISOString(),
    };
  },

  /**
   * Consume a ticket atomically, with idempotency guarantee on clientId.
   *
   * Le passage ACTIVE → USED se fait par un UPDATE conditionnel : si deux terminaux
   * scannent le même billet au même instant, un seul obtient VALID.
   *
   * Chemin le plus court possible (l'agent attend, billet à la main) : une lecture du QR,
   * puis une seule requête qui consomme le billet et enregistre le scan. Un clientId déjà
   * traité (renvoi après une coupure réseau) est détecté par la contrainte d'unicité.
   */
  async consume(input: ConsumeInput) {
    const now = new Date();
    const tokenHash = hashToken(input.token);

    try {
      const qr = await prisma.qRCode.findFirst({
        where: qrWhere(tokenHash, input.organizationId),
        include: QR_INCLUDE,
      });

      const baseScan = {
        clientId: input.clientId,
        // Pour le propriétaire de la plateforme (aucun espace), le scan suit l'espace du QR
        organizationId: input.organizationId ?? qr?.source.organizationId ?? null,
        userId: input.userId,
        sourceId: input.sourceId,
        deviceId: input.deviceId,
        scannedAt: now,
      };

      if (!qr) {
        const scan = await prisma.scan.create({ data: { ...baseScan, result: 'INVALID' } });
        webhookService.emitScanCreated(scan.id);

        return {
          valid: false,
          code: 'INVALID' as ScanResult,
          status: 'BLOCKED' as QRStatus,
          reusable: false,
          consumed: false,
          message: 'Code inconnu lors de la tentative de consommation.',
          verifiedAt: now.toISOString(),
        };
      }

      let evaluation = evaluateQR(qr, { eventId: input.eventId, at: now });
      const eventId = input.eventId || qr.eventId;
      let scanId: string;

      if (evaluation.code === 'VALID' && !qr.reusable) {
        // Transition ACTIVE -> USED et enregistrement du scan en une seule instruction atomique
        scanId = newId();
        const metadata = qr.metadata ? JSON.stringify(qr.metadata) : null;
        // Les colonnes DateTime de Prisma sont en UTC sans fuseau : conversion explicite,
        // sinon PostgreSQL applique le fuseau de la session
        const at = Prisma.sql`(${now}::timestamptz AT TIME ZONE 'UTC')`;
        const [row] = await prisma.$queryRaw<{ result: ScanResult }[]>`
          WITH consumed AS (
            UPDATE "qr_codes"
               SET "status" = 'USED'::"QRStatus", "usedAt" = ${at}, "updatedAt" = ${at}
             WHERE "id" = ${qr.id} AND "status" = 'ACTIVE'::"QRStatus"
            RETURNING "id"
          )
          INSERT INTO "scans" ("id", "qrId", "eventId", "organizationId", "userId", "sourceId",
                               "deviceId", "result", "offline", "clientId", "scannedAt", "createdAt", "metadata")
          SELECT ${scanId}, ${qr.id}, ${eventId}, ${baseScan.organizationId}, ${input.userId ?? null},
                 ${input.sourceId ?? null}, ${input.deviceId ?? null},
                 (CASE WHEN EXISTS (SELECT 1 FROM consumed) THEN 'VALID' ELSE 'ALREADY_USED' END)::"ScanResult",
                 false, ${input.clientId}, ${at}, ${at}, ${metadata}::jsonb
          RETURNING "result"`;

        if (row?.result !== 'VALID') {
          // Un autre terminal vient de consommer ce billet
          evaluation = {
            code: 'ALREADY_USED',
            status: 'USED',
            message: 'Ce billet vient d’être validé sur un autre terminal.',
          };
        }
      } else {
        const scan = await prisma.scan.create({
          data: {
            ...baseScan,
            qrId: qr.id,
            eventId,
            result: evaluation.code,
            ...(qr.metadata ? { metadata: qr.metadata as Prisma.InputJsonValue } : {}),
          },
        });
        scanId = scan.id;
      }

      webhookService.emitScanCreated(scanId);

      const consumed = evaluation.code === 'VALID';
      return {
        valid: consumed,
        code: evaluation.code,
        status: consumed && !qr.reusable ? ('USED' as QRStatus) : evaluation.status,
        consumed,
        ...(consumed ? { consumedAt: now.toISOString() } : {}),
        message: consumed ? 'Entrée enregistrée et validée avec succès.' : evaluation.message,
        ...describe(qr),
        verifiedAt: now.toISOString(),
      };
    } catch (error) {
      // clientId déjà traité (renvoi, ou requêtes concurrentes) : on rejoue le premier résultat
      if (isUniqueViolation(error)) {
        const replay = await replayExistingScan(input.clientId, now, input.organizationId);
        if (replay) return replay;
      }
      throw error;
    }
  },

  /**
   * Réconcilie un scan réalisé hors-ligne par un terminal.
   * Le serveur ne fait pas confiance au résultat annoncé : pour un scan « VALID »,
   * il rejoue la règle métier à l'heure du scan et tente la consommation atomique.
   */
  async recordOfflineScan(
    input: OfflineScanInput
  ): Promise<{ status: 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT'; result?: ScanResult; message?: string }> {
    const existing = await prisma.scan.findUnique({ where: { clientId: input.clientId } });
    if (existing) {
      return {
        status: 'DUPLICATE',
        result: existing.result,
        message: 'Ce scan est déjà synchronisé sur le serveur.',
      };
    }

    const tokenHash = hashToken(input.token);
    let createdScanId: string | null = null;

    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const qr = await tx.qRCode.findFirst({
          where: qrWhere(tokenHash, input.organizationId),
          include: QR_INCLUDE,
        });

        let finalResult: ScanResult = input.claimedResult;
        let conflictMessage: string | undefined;

        if (input.claimedResult === 'VALID') {
          if (!qr) {
            finalResult = 'INVALID';
            conflictMessage = 'QR code inconnu du serveur.';
          } else {
            const evaluation = evaluateQR(qr, { eventId: input.eventId, at: input.scannedAt });
            finalResult = evaluation.code;

            if (evaluation.code !== 'VALID') {
              conflictMessage =
                evaluation.code === 'ALREADY_USED'
                  ? 'Billet déjà consommé par un autre terminal.'
                  : evaluation.message;
            } else if (!qr.reusable) {
              const { count } = await tx.qRCode.updateMany({
                where: { id: qr.id, status: 'ACTIVE' },
                data: { status: 'USED', usedAt: input.scannedAt },
              });
              if (count === 0) {
                finalResult = 'ALREADY_USED';
                conflictMessage = 'Billet déjà consommé par un autre terminal.';
              }
            }
          }
        }

        const hasConflict = finalResult !== input.claimedResult;

        const scan = await tx.scan.create({
          data: {
            clientId: input.clientId,
            organizationId: input.organizationId ?? qr?.source.organizationId ?? null,
            qrId: qr?.id,
            eventId: qr ? input.eventId || qr.eventId : undefined,
            userId: input.userId,
            deviceId: input.deviceId,
            result: finalResult,
            offline: true,
            scannedAt: input.scannedAt,
            metadata: {
              ...((qr?.metadata as Record<string, unknown> | null) ?? {}),
              ...(hasConflict ? { offlineConflict: true, offlineClaimedResult: input.claimedResult } : {}),
            } as Prisma.InputJsonValue,
          },
        });

        createdScanId = scan.id;

        return hasConflict
          ? { status: 'CONFLICT' as const, result: finalResult, message: conflictMessage }
          : { status: 'ACCEPTED' as const, result: finalResult };
      });

      if (createdScanId) webhookService.emitScanCreated(createdScanId);
      return outcome;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { status: 'DUPLICATE', message: 'Ce scan est déjà synchronisé sur le serveur.' };
      }
      throw error;
    }
  },
};

function formatQRSummary(qr: {
  id: string;
  externalId?: string | null;
  type: QRType;
  reusable: boolean;
  expiresAt: Date | null;
  usedAt: Date | null;
  source?: { name: string } | null;
}) {
  return {
    id: qr.id,
    externalId: qr.externalId ?? undefined,
    type: qr.type,
    source: qr.source?.name || 'ScanHub',
    reusable: qr.reusable,
    expiresAt: qr.expiresAt?.toISOString(),
    usedAt: qr.usedAt?.toISOString(),
  };
}

function extractHolder(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const meta = metadata as Record<string, any>;
  return {
    name: meta.holderName || meta.name || 'Participant',
    role: meta.holderRole || meta.role || meta.ticketType,
    company: meta.company || meta.organization,
  };
}
