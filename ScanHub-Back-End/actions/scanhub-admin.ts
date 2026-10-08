"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/actions/getUser";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { deviceService } from "@/modules/devices/deviceService";
import { integrationService } from "@/modules/integrations/integrationService";

// ─── Garde d'accès ────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ id: string } | null> {
  const result = await getUser();
  const currentUser = result?.user?.user;

  // Une session d'audit (impersonation) ne donne jamais de droits d'administration
  if (!currentUser || result?.isImpersonation) return null;
  if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") return null;

  return { id: currentUser.id };
}

const FORBIDDEN = { error: "Action réservée aux administrateurs." } as const;

// ─── Terminaux ────────────────────────────────────────────────────────────────

const createDeviceSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  userId: z.string().min(1, "Agent requis"),
});

export async function createDeviceAction(input: { name: string; userId: string }) {
  if (!(await requireAdmin())) return FORBIDDEN;

  const parsed = createDeviceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.userId, isActive: true, isDeleted: false },
      select: { id: true },
    });
    if (!agent) return { error: "Agent introuvable ou inactif." };

    const { activationCode, activationExpiresAt } = await deviceService.createPendingDevice(
      parsed.data.name,
      agent.id
    );

    revalidatePath("/devices");
    return {
      success: true as const,
      activationCode,
      activationExpiresAt: activationExpiresAt.toISOString(),
    };
  } catch (err) {
    logger.error({ err }, "Création de terminal impossible");
    return { error: "Création du terminal impossible." };
  }
}

export async function setDeviceActiveAction(deviceId: string, active: boolean) {
  if (!(await requireAdmin())) return FORBIDDEN;

  try {
    const { count } = await prisma.device.updateMany({
      where: { id: deviceId },
      data: { active },
    });
    if (count === 0) return { error: "Terminal introuvable." };

    revalidatePath("/devices");
    return { success: true as const };
  } catch (err) {
    logger.error({ err }, "Mise à jour de terminal impossible");
    return { error: "Mise à jour du terminal impossible." };
  }
}

export async function resetDeviceActivationAction(deviceId: string) {
  if (!(await requireAdmin())) return FORBIDDEN;

  try {
    const existing = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!existing) return { error: "Terminal introuvable." };

    const { activationCode, activationExpiresAt } = await deviceService.resetActivation(deviceId);

    revalidatePath("/devices");
    return {
      success: true as const,
      activationCode,
      activationExpiresAt: activationExpiresAt.toISOString(),
    };
  } catch (err) {
    logger.error({ err }, "Régénération du code d'activation impossible");
    return { error: "Régénération du code impossible." };
  }
}

// ─── Partenaires API ──────────────────────────────────────────────────────────

export async function rotateSourceApiKeyAction(sourceId: string) {
  if (!(await requireAdmin())) return FORBIDDEN;

  try {
    const existing = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });
    if (!existing) return { error: "Partenaire introuvable." };

    const { apiKey } = await integrationService.rotateApiKey(sourceId);

    revalidatePath("/integrations");
    return { success: true as const, apiKey };
  } catch (err) {
    logger.error({ err }, "Régénération de clé API impossible");
    return { error: "Régénération de la clé impossible." };
  }
}
