import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateIntegration } from '@/lib/integrationAuth';
import {
  organizationService,
  PlanLimitError,
} from '@/modules/organizations/organizationService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

function formatEvent(event: {
  id: string;
  name: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}) {
  return {
    id: event.id,
    name: event.name,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
  };
}

/** GET /api/v1/integrations/events — événements de votre espace (pour obtenir un `eventId`). */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const events = await prisma.event.findMany({
      where: { organizationId: auth.source.organizationId },
      orderBy: { startsAt: 'desc' },
    });

    return jsonSuccess({ events: events.map(formatEvent) });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des événements');
  }
}

const createEventSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'endsAt doit être postérieur à startsAt',
    path: ['endsAt'],
  });

/** POST /api/v1/integrations/events — crée un événement dans votre espace. */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Données de création d'événement invalides", 400, parsed.error.format());
    }

    await organizationService.assertCanAddEvent(auth.source.organizationId);

    const event = await prisma.event.create({
      data: {
        name: parsed.data.name,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: new Date(parsed.data.endsAt),
        organizationId: auth.source.organizationId,
        sourceId: auth.source.id,
      },
    });

    return jsonSuccess(formatEvent(event), 201);
  } catch (error) {
    if (error instanceof PlanLimitError) return jsonError(error.message, 403);
    return jsonServerError(error, "Erreur lors de la création de l'événement");
  }
}
