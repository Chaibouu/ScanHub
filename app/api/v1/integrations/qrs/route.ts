import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { qrItemSchema } from '@/modules/integrations/schemas';
import { PlanLimitError } from '@/modules/organizations/organizationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { Prisma, QRStatus } from '@prisma/client';

/**
 * POST /api/v1/integrations/qrs — crée un code QR.
 * 201 = créé ; 200 = `externalId` déjà connu, le code d'origine est renvoyé (rejeu sans risque).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = qrItemSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Données de création de QR code invalides', 400, parsed.error.format());
    }

    const qr = await integrationService.registerQRCode(
      { ...parsed.data, type: parsed.data.type ?? 'TICKET' },
      auth.source
    );

    return jsonSuccess(qr, qr.created ? 201 : 200);
  } catch (error) {
    if (error instanceof IntegrationError) return jsonError(error.message, error.status);
    if (error instanceof PlanLimitError) return jsonError(error.message, 403);
    return jsonServerError(error, "Erreur lors de l'enregistrement du QR code");
  }
}

/** GET /api/v1/integrations/qrs — liste paginée des codes créés avec cette clé. */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;
    const { source } = auth;

    const searchParams = req.nextUrl.searchParams;
    const eventId = searchParams.get('eventId') || undefined;
    const statusParam = searchParams.get('status') || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const skip = (page - 1) * limit;

    if (statusParam && !(statusParam in QRStatus)) {
      return jsonError('Paramètre status invalide', 400);
    }

    const whereClause: Prisma.QRCodeWhereInput = {
      sourceId: source.id,
      ...(eventId ? { eventId } : {}),
      ...(statusParam ? { status: statusParam as QRStatus } : {}),
    };

    const [qrs, total] = await Promise.all([
      prisma.qRCode.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          externalId: true,
          type: true,
          status: true,
          reusable: true,
          eventId: true,
          expiresAt: true,
          usedAt: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.qRCode.count({ where: whereClause }),
    ]);

    return jsonSuccess({
      source: {
        id: source.id,
        name: source.name,
        slug: source.slug,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      qrs,
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des QR codes');
  }
}
