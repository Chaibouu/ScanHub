"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { User, UserRole } from "@prisma/client";
import { z } from "zod";
import { getUser } from "@/actions/getUser";
import prisma from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { resetFailedAttempts } from "@/lib/backoff";
import { deviceService } from "@/modules/devices/deviceService";
import { integrationService } from "@/modules/integrations/integrationService";

// ─── Garde d'accès ────────────────────────────────────────────────────────────

interface Admin {
  id: string;
  role: UserRole;
}

async function requireAdmin(): Promise<Admin | null> {
  const result = await getUser();
  const currentUser = result?.user?.user;

  // Une session d'audit (impersonation) ne donne jamais de droits d'administration
  if (!currentUser || result?.isImpersonation) return null;
  if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN") return null;

  return { id: currentUser.id, role: currentUser.role };
}

/**
 * Hiérarchie : un SUPER_ADMIN gère tout sauf les autres SUPER_ADMIN ;
 * un ADMIN ne gère que les comptes AGENT et USER.
 */
function canManageRole(actor: UserRole, target: UserRole): boolean {
  if (target === "SUPER_ADMIN") return false;
  if (target === "ADMIN") return actor === "SUPER_ADMIN";
  return true;
}

const FORBIDDEN = { error: "Action réservée aux administrateurs." } as const;
const NOT_ALLOWED = { error: "Vous n'avez pas les droits pour gérer ce compte." } as const;

function fail(err: unknown, message: string) {
  logger.error({ err }, message);
  return { error: message };
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

const MANAGEABLE_ROLES = ["ADMIN", "AGENT", "USER"] as const;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(100),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  role: z.enum(MANAGEABLE_ROLES),
});

/**
 * Crée un compte avec un mot de passe temporaire, retourné une seule fois.
 * Le compte est créé par un administrateur : l'email est considéré comme vérifié.
 */
export async function createUserAction(input: { name: string; email: string; role: string }) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  if (!canManageRole(admin.role, parsed.data.role)) return NOT_ALLOWED;

  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { error: "Un compte existe déjà avec cet email." };

    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        password: await bcrypt.hash(tempPassword, 10),
        emailVerified: new Date(),
      },
    });

    await audit({
      userId: admin.id,
      action: "USER_CREATED",
      status: "SUCCESS",
      metadata: { targetUserId: user.id, role: user.role },
    });

    revalidatePath("/admin/users");
    return { success: true as const, tempPassword };
  } catch (err) {
    return fail(err, "Création du compte impossible.");
  }
}

async function loadManageableUser(
  admin: Admin,
  userId: string
): Promise<{ error: string } | { target: User }> {
  if (userId === admin.id) {
    return { error: "Vous ne pouvez pas modifier votre propre compte ici." };
  }
  const target = await prisma.user.findFirst({ where: { id: userId, isDeleted: false } });
  if (!target) return { error: "Utilisateur introuvable." };
  if (!canManageRole(admin.role, target.role)) return NOT_ALLOWED;
  return { target };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsedRole = z.enum(MANAGEABLE_ROLES).safeParse(role);
  if (!parsedRole.success) return { error: "Rôle invalide." };
  if (!canManageRole(admin.role, parsedRole.data)) return NOT_ALLOWED;

  try {
    const loaded = await loadManageableUser(admin, userId);
    if ("error" in loaded) return loaded;

    await prisma.user.update({ where: { id: userId }, data: { role: parsedRole.data } });
    await audit({
      userId: admin.id,
      action: "USER_ROLE_CHANGED",
      status: "SUCCESS",
      metadata: { targetUserId: userId, from: loaded.target.role, to: parsedRole.data },
    });

    revalidatePath("/admin/users");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Changement de rôle impossible.");
  }
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const loaded = await loadManageableUser(admin, userId);
    if ("error" in loaded) return loaded;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: active, deactivatedAt: active ? null : new Date() },
      }),
      // Désactivation : toutes les sessions (web et mobile) sont coupées immédiatement
      ...(active ? [] : [prisma.session.deleteMany({ where: { userId } })]),
    ]);

    await audit({
      userId: admin.id,
      action: active ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED",
      status: "SUCCESS",
      metadata: { targetUserId: userId },
    });

    revalidatePath("/admin/users");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour du compte impossible.");
  }
}

export async function resetUserPasswordAction(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const loaded = await loadManageableUser(admin, userId);
    if ("error" in loaded) return loaded;

    const tempPassword = generateTempPassword();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(tempPassword, 10) },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    await resetFailedAttempts(userId);

    await audit({
      userId: admin.id,
      action: "PASSWORD_RESET_BY_ADMIN",
      status: "SUCCESS",
      metadata: { targetUserId: userId },
    });

    return { success: true as const, tempPassword };
  } catch (err) {
    return fail(err, "Réinitialisation du mot de passe impossible.");
  }
}

// ─── Événements ───────────────────────────────────────────────────────────────

const createEventSchema = z
  .object({
    name: z.string().trim().min(2, "Nom trop court").max(200),
    organizationId: z.string().min(1, "Organisation requise"),
    sourceId: z.string().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "La date de fin doit être postérieure à la date de début.",
    path: ["endsAt"],
  });

export async function createEventAction(input: {
  name: string;
  organizationId: string;
  sourceId?: string;
  startsAt: string;
  endsAt: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = createEventSchema.safeParse({ ...input, sourceId: input.sourceId || undefined });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: { id: true },
    });
    if (!organization) return { error: "Organisation introuvable." };

    if (parsed.data.sourceId) {
      // La billetterie rattachée doit appartenir à la même organisation
      const source = await prisma.source.findFirst({
        where: { id: parsed.data.sourceId, organizationId: organization.id },
        select: { id: true },
      });
      if (!source) return { error: "Ce partenaire n'appartient pas à l'organisation choisie." };
    }

    const event = await prisma.event.create({
      data: {
        name: parsed.data.name,
        organizationId: organization.id,
        sourceId: parsed.data.sourceId ?? null,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
      },
    });

    await audit({
      userId: admin.id,
      action: "EVENT_CREATED",
      status: "SUCCESS",
      metadata: { eventId: event.id },
    });

    revalidatePath("/events");
    return { success: true as const, eventId: event.id };
  } catch (err) {
    return fail(err, "Création de l'événement impossible.");
  }
}

export async function setEventStatusAction(eventId: string, status: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = z.enum(["ACTIVE", "PAUSED", "CLOSED"]).safeParse(status);
  if (!parsed.success) return { error: "Statut invalide." };

  try {
    const { count } = await prisma.event.updateMany({
      where: { id: eventId },
      data: { status: parsed.data },
    });
    if (count === 0) return { error: "Événement introuvable." };

    await audit({
      userId: admin.id,
      action: "EVENT_STATUS_CHANGED",
      status: "SUCCESS",
      metadata: { eventId, status: parsed.data },
    });

    revalidatePath("/events");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour de l'événement impossible.");
  }
}

// ─── Organisations & partenaires API ──────────────────────────────────────────

const nameSchema = z.string().trim().min(2, "Nom trop court").max(120);

export async function createOrganizationAction(input: { name: string }) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide" };

  const slug = slugify(parsed.data);
  if (!slug) return { error: "Nom invalide." };

  try {
    if (await prisma.organization.findUnique({ where: { slug } })) {
      return { error: "Une organisation porte déjà ce nom." };
    }

    const organization = await prisma.organization.create({
      data: { name: parsed.data, slug },
    });

    await audit({
      userId: admin.id,
      action: "ORGANIZATION_CREATED",
      status: "SUCCESS",
      metadata: { organizationId: organization.id },
    });

    revalidatePath("/integrations");
    revalidatePath("/events");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Création de l'organisation impossible.");
  }
}

/** Crée un partenaire et sa première clé API (affichée une seule fois). */
export async function createSourceAction(input: { name: string; organizationId: string }) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide" };

  const slug = slugify(parsed.data);
  if (!slug) return { error: "Nom invalide." };

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) return { error: "Organisation introuvable." };

    if (await prisma.source.findUnique({ where: { slug } })) {
      return { error: "Un partenaire porte déjà ce nom." };
    }

    const source = await prisma.source.create({
      data: { name: parsed.data, slug, organizationId: organization.id },
    });
    const { apiKey } = await integrationService.rotateApiKey(source.id);

    await audit({
      userId: admin.id,
      action: "SOURCE_CREATED",
      status: "SUCCESS",
      metadata: { sourceId: source.id },
    });

    revalidatePath("/integrations");
    return { success: true as const, apiKey };
  } catch (err) {
    return fail(err, "Création du partenaire impossible.");
  }
}

export async function rotateSourceApiKeyAction(sourceId: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const existing = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });
    if (!existing) return { error: "Partenaire introuvable." };

    const { apiKey } = await integrationService.rotateApiKey(sourceId);

    await audit({
      userId: admin.id,
      action: "API_KEY_ROTATED",
      status: "SUCCESS",
      metadata: { sourceId },
    });

    revalidatePath("/integrations");
    return { success: true as const, apiKey };
  } catch (err) {
    return fail(err, "Régénération de la clé impossible.");
  }
}

// ─── Terminaux ────────────────────────────────────────────────────────────────

const createDeviceSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  userId: z.string().min(1, "Agent requis"),
});

export async function createDeviceAction(input: { name: string; userId: string }) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

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

    const { device, activationCode, activationExpiresAt } =
      await deviceService.createPendingDevice(parsed.data.name, agent.id);

    await audit({
      userId: admin.id,
      action: "DEVICE_CREATED",
      status: "SUCCESS",
      metadata: { deviceId: device.id, agentId: agent.id },
    });

    revalidatePath("/devices");
    return {
      success: true as const,
      activationCode,
      activationExpiresAt: activationExpiresAt.toISOString(),
    };
  } catch (err) {
    return fail(err, "Création du terminal impossible.");
  }
}

export async function setDeviceActiveAction(deviceId: string, active: boolean) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const { count } = await prisma.device.updateMany({
      where: { id: deviceId },
      data: { active },
    });
    if (count === 0) return { error: "Terminal introuvable." };

    await audit({
      userId: admin.id,
      action: "DEVICE_STATUS_CHANGED",
      status: "SUCCESS",
      metadata: { deviceId, active },
    });

    revalidatePath("/devices");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour du terminal impossible.");
  }
}

export async function resetDeviceActivationAction(deviceId: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

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
    return fail(err, "Régénération du code impossible.");
  }
}
