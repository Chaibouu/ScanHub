import prisma from '@/lib/prisma';
import {
  generateSecret,
  generateToken,
  hashToken,
  hashTokenOffline,
  hashApiKey,
} from '@/lib/crypto';
import { decryptSecret, encryptSecret } from '@/lib/tokens';
import { organizationService } from '@/modules/organizations/organizationService';
import { Prisma, QRCode, QRType, QRStatus } from '@prisma/client';

export class IntegrationError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export interface CreateIntegratedQRInput {
  /** Référence du client (n° de badge, de commande…). Rejouer la même création rend le même code. */
  externalId?: string;
  type: QRType;
  eventId?: string;
  reusable?: boolean;
  expiresAt?: string;
  holderName?: string;
  holderEmail?: string;
  holderRole?: string;
  metadata?: Record<string, unknown>;
  /** Optionnel : code fourni par le client au lieu d'être généré par ScanHub */
  token?: string;
}

interface SourceRef {
  id: string;
  slug: string;
  organizationId: string;
}

export const MAX_BATCH_SIZE = 500;

/**
 * Un code fourni par le client doit être imprévisible : c'est lui qui fait la sécurité
 * du billet. On refuse donc les codes courts ou répétitifs (ex : numéros qui se suivent).
 */
export function assertStrongToken(token: string) {
  if (!/^[A-Za-z0-9_\-.:]{24,256}$/.test(token)) {
    throw new IntegrationError(
      'token : 24 à 256 caractères parmi lettres, chiffres, « _ - . : ».',
      422
    );
  }
  if (new Set(token).size < 12) {
    throw new IntegrationError(
      'token trop prévisible : utilisez une valeur aléatoire (ou laissez ScanHub la générer).',
      422
    );
  }
}

function defaultReusable(type: QRType): boolean {
  return type !== 'TICKET' && type !== 'INVITATION';
}

function buildMetadata(input: CreateIntegratedQRInput): Prisma.InputJsonObject {
  return {
    ...(input.metadata || {}),
    ...(input.holderName ? { holderName: input.holderName } : {}),
    ...(input.holderEmail ? { holderEmail: input.holderEmail } : {}),
    ...(input.holderRole ? { holderRole: input.holderRole } : {}),
    ...(input.externalId ? { externalId: input.externalId } : {}),
    registeredVia: 'API_INTEGRATION',
  } as Prisma.InputJsonObject;
}

function buildCreateData(input: CreateIntegratedQRInput, source: SourceRef, token: string) {
  return {
    tokenHash: hashToken(token),
    offlineHash: hashTokenOffline(token),
    // Copie chiffrée : permet de rendre le même code lors d'un rejeu et de générer l'image du QR
    tokenEnc: encryptSecret(token),
    externalId: input.externalId ?? null,
    type: input.type,
    status: QRStatus.ACTIVE,
    reusable: input.reusable ?? defaultReusable(input.type),
    eventId: input.eventId || null,
    sourceId: source.id,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    metadata: buildMetadata(input),
  };
}

/** Token en clair d'un code, ou null si ScanHub n'en détient pas de copie déchiffrable. */
function readToken(qr: Pick<QRCode, 'tokenEnc'>): string | null {
  if (!qr.tokenEnc) return null;
  try {
    return decryptSecret(qr.tokenEnc);
  } catch {
    return null;
  }
}

function formatQR(qr: QRCode, source: SourceRef, token: string | null, created: boolean) {
  const meta = (qr.metadata as Record<string, unknown> | null) ?? {};
  return {
    id: qr.id,
    externalId: qr.externalId ?? undefined,
    // Contenu à encoder dans le QR code. null pour un ancien code dont ScanHub n'a pas de copie.
    token,
    type: qr.type,
    status: qr.status,
    reusable: qr.reusable,
    source: source.slug,
    eventId: qr.eventId,
    holderName: (meta.holderName as string | undefined) ?? undefined,
    expiresAt: qr.expiresAt?.toISOString(),
    usedAt: qr.usedAt?.toISOString(),
    createdAt: qr.createdAt.toISOString(),
    // false quand la référence externalId existait déjà : le code d'origine est renvoyé tel quel
    created,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function assertEventOfSource(eventId: string, source: SourceRef) {
  // Une clé API ne peut rattacher ses codes qu'aux événements de son propre espace
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: source.organizationId },
    select: { id: true },
  });
  if (!event) {
    throw new IntegrationError('Événement introuvable dans votre espace.', 404);
  }
}

export const integrationService = {
  readToken,

  /**
   * Authenticate platform caller via API key header.
   * Seule la clé secrète authentifie un client : le slug est public,
   * il ne doit jamais servir d'identifiant d'accès.
   */
  async authenticateApiKey(apiKey: string | null) {
    if (!apiKey?.trim()) return null;

    return prisma.source.findFirst({
      where: { apiKeyHash: hashApiKey(apiKey) },
      include: { organization: true },
    });
  },

  /**
   * Génère (ou régénère) la clé API d'une source. La clé en clair n'est
   * retournée qu'ici, une seule fois — seul son hash est stocké.
   */
  async rotateApiKey(sourceId: string) {
    const apiKey = generateSecret('shk');
    const source = await prisma.source.update({
      where: { id: sourceId },
      data: { apiKeyHash: hashApiKey(apiKey) },
    });
    return { source, apiKey };
  },

  /**
   * Crée un code QR pour une plateforme cliente.
   *
   * Idempotent sur `externalId` : si cette référence existe déjà pour la clé, le code
   * d'origine est renvoyé (created: false) au lieu d'en créer un second. Le client peut
   * donc réessayer sans risque après une coupure réseau.
   */
  async registerQRCode(input: CreateIntegratedQRInput, source: SourceRef) {
    if (input.externalId) {
      const existing = await prisma.qRCode.findUnique({
        where: { sourceId_externalId: { sourceId: source.id, externalId: input.externalId } },
      });
      if (existing) return formatQR(existing, source, readToken(existing), false);
    }

    if (input.token) assertStrongToken(input.token);

    if (input.eventId) {
      await assertEventOfSource(input.eventId, source);
      await organizationService.assertCanAddTickets(source.organizationId, input.eventId, 1);
    }

    const token = input.token ?? generateToken(defaultReusable(input.type) ? 'SCN' : 'TKT');

    try {
      const qr = await prisma.qRCode.create({ data: buildCreateData(input, source, token) });
      return formatQR(qr, source, token, true);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Deux créations simultanées de la même référence : la seconde rend le code de la première
      if (input.externalId) {
        const existing = await prisma.qRCode.findUnique({
          where: { sourceId_externalId: { sourceId: source.id, externalId: input.externalId } },
        });
        if (existing) return formatQR(existing, source, readToken(existing), false);
      }
      // Sinon c'est le token fourni par le client qui existe déjà (ici ou ailleurs)
      throw new IntegrationError('Ce token est déjà enregistré.', 409);
    }
  },

  /**
   * Crée jusqu'à 500 codes en un appel (reprise d'un existant, import…).
   * Même garantie d'idempotence que la création unitaire, référence par référence.
   */
  async registerBatch(
    items: CreateIntegratedQRInput[],
    defaults: { eventId?: string; type: QRType },
    source: SourceRef
  ) {
    const inputs = items.map((item) => ({
      ...item,
      type: item.type ?? defaults.type,
      eventId: item.eventId ?? defaults.eventId,
    }));

    const externalIds = inputs.map((i) => i.externalId).filter((id): id is string => Boolean(id));
    if (new Set(externalIds).size !== externalIds.length) {
      throw new IntegrationError('externalId en double dans le lot.', 422);
    }
    for (const input of inputs) {
      if (input.token) assertStrongToken(input.token);
    }

    const eventIds = [...new Set(inputs.map((i) => i.eventId).filter((id): id is string => Boolean(id)))];
    for (const eventId of eventIds) {
      await assertEventOfSource(eventId, source);
    }

    // Références déjà connues : rendues telles quelles
    const existing = externalIds.length
      ? await prisma.qRCode.findMany({
          where: { sourceId: source.id, externalId: { in: externalIds } },
        })
      : [];
    const existingByRef = new Map(existing.map((qr) => [qr.externalId, qr]));

    const toCreate = inputs.filter((i) => !i.externalId || !existingByRef.has(i.externalId));

    for (const eventId of eventIds) {
      const adding = toCreate.filter((i) => i.eventId === eventId).length;
      if (adding > 0) {
        await organizationService.assertCanAddTickets(source.organizationId, eventId, adding);
      }
    }

    const tokens = new Map<CreateIntegratedQRInput, string>();
    const data = toCreate.map((input) => {
      const token = input.token ?? generateToken(defaultReusable(input.type) ? 'SCN' : 'TKT');
      tokens.set(input, token);
      return buildCreateData(input, source, token);
    });

    let createdRows: QRCode[] = [];
    if (data.length > 0) {
      try {
        createdRows = await prisma.qRCode.createManyAndReturn({ data });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Rien n'est créé (requête unique) : le client peut renvoyer le lot tel quel
          throw new IntegrationError(
            'Conflit : un token ou une référence du lot existe déjà. Renvoyez le lot.',
            409
          );
        }
        throw error;
      }
    }
    const createdByHash = new Map(createdRows.map((qr) => [qr.tokenHash, qr]));

    const results = inputs.map((input) => {
      const known = input.externalId ? existingByRef.get(input.externalId) : undefined;
      if (known) return formatQR(known, source, readToken(known), false);

      const token = tokens.get(input) as string;
      return formatQR(createdByHash.get(hashToken(token)) as QRCode, source, token, true);
    });

    return {
      total: results.length,
      created: createdRows.length,
      existing: results.length - createdRows.length,
      qrs: results,
    };
  },

  /** Retrouve un code de la source par son identifiant ScanHub ou par la référence du client. */
  async findQRCode(idOrExternalId: string, sourceId: string) {
    return prisma.qRCode.findFirst({
      where: {
        sourceId,
        OR: [{ id: idOrExternalId }, { externalId: idOrExternalId }],
      },
    });
  },

  async getQRCode(idOrExternalId: string, source: SourceRef) {
    const qr = await this.findQRCode(idOrExternalId, source.id);
    if (!qr) throw new IntegrationError('QR Code introuvable.', 404);
    return formatQR(qr, source, readToken(qr), false);
  },

  /**
   * Révoque (ou rétablit) un code, désigné par son identifiant, sa référence client ou son token.
   * Toujours limité aux codes de la source appelante.
   */
  async setRevoked(idOrRef: string, source: SourceRef, revoked: boolean) {
    const qr =
      (await this.findQRCode(idOrRef, source.id)) ??
      (await prisma.qRCode.findFirst({
        where: { sourceId: source.id, tokenHash: hashToken(idOrRef) },
      }));

    if (!qr) {
      throw new IntegrationError('QR Code introuvable ou non rattaché à votre clé.', 404);
    }

    const status: QRStatus = revoked
      ? QRStatus.REVOKED
      : qr.usedAt && !qr.reusable
        ? QRStatus.USED
        : QRStatus.ACTIVE;

    if (!revoked && qr.status !== QRStatus.REVOKED) {
      throw new IntegrationError("Ce QR Code n'est pas révoqué.", 409);
    }

    const updated = await prisma.qRCode.update({ where: { id: qr.id }, data: { status } });

    return {
      id: updated.id,
      externalId: updated.externalId ?? undefined,
      status: updated.status,
      message: revoked ? 'QR Code révoqué avec succès.' : 'QR Code rétabli.',
    };
  },
};
