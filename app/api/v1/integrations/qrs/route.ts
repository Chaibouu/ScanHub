import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { integrationService, IntegrationError } from '@/modules/integrations/integrationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { Prisma, QRStatus } from '@prisma/client';
import { z } from 'zod';

const createIntegratedQRSchema = z.object({
  externalId: z.string().max(200).optional(),
  type: z.enum(['TICKET', 'BADGE', 'PASS', 'COUPON']).default('TICKET'),
  eventId: z.string().optional(),
  reusable: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const source = await integrationService.authenticateApiKey(apiKey);

    if (!source) {
      return jsonError('Clé API partenaire invalide ou non autorisée', 401);
    }

    const body = await req.json().catch(() => null);
    const parsed = createIntegratedQRSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Données de création de QR code invalides', 400, parsed.error.format());
    }

    const created = await integrationService.registerQRCode(parsed.data, source);

    return jsonSuccess(created, 201);
  } catch (error) {
    if (error instanceof IntegrationError) {
      return jsonError(error.message, error.status);
    }
    return jsonServerError(error, "Erreur lors de l'enregistrement du QR code partenaire");
  }
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const source = await integrationService.authenticateApiKey(apiKey);

    if (!source) {
      return jsonError('Clé API partenaire invalide ou non autorisée', 401);
    }

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
