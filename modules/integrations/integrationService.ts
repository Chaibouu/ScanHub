import prisma from '@/lib/prisma';
import {
  generateSecret,
  generateToken,
  hashToken,
  hashTokenOffline,
  hashApiKey,
} from '@/lib/crypto';
import { Prisma, QRType, QRStatus } from '@prisma/client';

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
  externalId?: string;
  type: QRType;
  eventId?: string;
  reusable?: boolean;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export const integrationService = {
  /**
   * Authenticate platform caller via API key header.
   * Seule la clé secrète authentifie un partenaire : le slug est public,
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
   * Create and register a QR Code from external platform (EventHub, JNJL, etc.)
   */
  async registerQRCode(
    input: CreateIntegratedQRInput,
    source: { id: string; organizationId: string }
  ) {
    // Un partenaire ne peut rattacher ses QR qu'aux événements de sa propre organisation
    if (input.eventId) {
      const event = await prisma.event.findFirst({
        where: { id: input.eventId, organizationId: source.organizationId },
        select: { id: true },
      });
      if (!event) {
        throw new IntegrationError(
          'Événement introuvable ou non rattaché à votre organisation.',
          404
        );
      }
    }

    const rawToken = generateToken(input.type === 'TICKET' ? 'TKT' : 'SCN');

    const qr = await prisma.qRCode.create({
      data: {
        tokenHash: hashToken(rawToken),
        offlineHash: hashTokenOffline(rawToken),
        type: input.type,
        status: QRStatus.ACTIVE,
        reusable: input.reusable ?? (input.type !== 'TICKET'),
        eventId: input.eventId || null,
        sourceId: source.id,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: {
          ...(input.metadata || {}),
          ...(input.externalId ? { externalId: input.externalId } : {}),
          registeredVia: 'API_INTEGRATION',
        } as Prisma.InputJsonObject,
      },
      include: { source: true, event: true },
    });

    return {
      id: qr.id,
      token: rawToken,
      type: qr.type,
      status: qr.status,
      reusable: qr.reusable,
      source: qr.source.slug,
      externalId: input.externalId,
      eventId: qr.eventId,
      expiresAt: qr.expiresAt?.toISOString(),
      qrVerifyUrl: `https://verify.scanhub.ne/q/${rawToken}`,
      createdAt: qr.createdAt.toISOString(),
    };
  },

  /**
   * Revoke a QR code by ID or token — toujours limité aux QR de la source appelante
   */
  async revokeQRCode(idOrToken: string, sourceId: string) {
    const tokenHash = hashToken(idOrToken);

    const qr = await prisma.qRCode.findFirst({
      where: {
        OR: [{ id: idOrToken }, { tokenHash }],
        sourceId,
      },
    });

    if (!qr) {
      throw new IntegrationError('QR Code introuvable ou non rattaché à votre source.', 404);
    }

    const updated = await prisma.qRCode.update({
      where: { id: qr.id },
      data: { status: QRStatus.REVOKED },
    });

    return {
      id: updated.id,
      status: updated.status,
      revokedAt: new Date().toISOString(),
      message: 'QR Code révoqué avec succès.',
    };
  },
};
