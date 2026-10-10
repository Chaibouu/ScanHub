import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser, ADMIN_ROLES } from '@/lib/rbac';
import { deviceService } from '@/modules/devices/deviceService';
import { organizationService, PlanLimitError } from '@/modules/organizations/organizationService';
import { scope, toViewer } from '@/lib/tenant';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, ADMIN_ROLES);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const viewer = toViewer(auth.user);

    const [devices, scanCounts] = await Promise.all([
      prisma.device.findMany({
        where: scope.devices(viewer),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, firstName: true } },
        },
      }),
      prisma.scan.groupBy({
        by: ['deviceId'],
        where: { deviceId: { not: null }, ...scope.scans(viewer) },
        _count: { _all: true },
      }),
    ]);

    const countByDevice = new Map(scanCounts.map((c) => [c.deviceId, c._count._all]));

    return jsonSuccess({
      devices: devices.map((dev) => ({
        ...deviceService.formatDevice(dev),
        activated: Boolean(dev.activatedAt),
        user: dev.user,
        totalScans: countByDevice.get(dev.id) ?? 0,
      })),
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des appareils');
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  userId: z.string().min(1),
});

/** Crée un terminal en attente et retourne son code d'activation (affiché une seule fois). */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, ADMIN_ROLES);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Requête invalide', 400, parsed.error.format());
    }

    // L'agent doit être un membre de l'espace de l'administrateur
    const agent = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        isActive: true,
        isDeleted: false,
        ...scope.users(toViewer(auth.user)),
      },
      select: { id: true, organizationId: true },
    });
    if (!agent) {
      return jsonError('Agent introuvable ou inactif', 404);
    }

    if (agent.organizationId) {
      try {
        await organizationService.assertCanAddDevice(agent.organizationId);
      } catch (error) {
        if (error instanceof PlanLimitError) return jsonError(error.message, 403);
        throw error;
      }
    }

    const { device, activationCode, activationExpiresAt } =
      await deviceService.createPendingDevice(parsed.data.name, agent.id);

    return jsonSuccess(
      {
        ...deviceService.formatDevice(device),
        activationCode,
        activationExpiresAt: activationExpiresAt.toISOString(),
      },
      201
    );
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la création du terminal');
  }
}

const toggleSchema = z.object({
  deviceId: z.string(),
  active: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, ADMIN_ROLES);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Requête invalide', 400, parsed.error.format());
    }

    const existing = await prisma.device.findFirst({
      where: { id: parsed.data.deviceId, ...scope.devices(toViewer(auth.user)) },
    });
    if (!existing) {
      return jsonError('Appareil introuvable', 404);
    }

    const updated = await prisma.device.update({
      where: { id: existing.id },
      data: { active: parsed.data.active },
    });

    return jsonSuccess({
      id: updated.id,
      name: updated.name,
      active: updated.active,
      message: updated.active ? 'Appareil réactivé.' : 'Appareil bloqué avec succès.',
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la mise à jour de l’appareil');
  }
}
