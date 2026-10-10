"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { User, UserRole } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { resetFailedAttempts } from "@/lib/backoff";
import { getViewer, scope, Viewer } from "@/lib/tenant";
import { deviceService } from "@/modules/devices/deviceService";
import { integrationService } from "@/modules/integrations/integrationService";
import {
  organizationService,
  PlanLimitError,
} from "@/modules/organizations/organizationService";
import { PLANS } from "@/settings/plans";

/**
 * Actions d'administration du tableau de bord.
 *
 * Toutes passent par `requireAdmin()` puis par les filtres `scope.*` : un administrateur
 * n'agit que sur les données de son propre espace. Seul le SUPER_ADMIN (propriétaire de
 * la plateforme) agit sur tous les espaces et gère les espaces eux-mêmes.
 */

// ─── Garde d'accès ────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

/**
 * Hiérarchie : un SUPER_ADMIN gère tout sauf les autres SUPER_ADMIN ;
 * un ADMIN ne gère que les comptes AGENT et USER de son espace.
 */
function canManageRole(actor: UserRole, target: UserRole): boolean {
  if (target === "SUPER_ADMIN") return false;
  if (target === "ADMIN") return actor === "SUPER_ADMIN";
  return true;
}

const FORBIDDEN = { error: "Action réservée aux administrateurs." } as const;
const NOT_ALLOWED = { error: "Vous n'avez pas les droits pour gérer ce compte." } as const;
const OWNER_ONLY = { error: "Action réservée au propriétaire de la plateforme." } as const;

function fail(err: unknown, message: string) {
  if (err instanceof PlanLimitError) return { error: err.message };
  logger.error({ err }, message);
  return { error: message };
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Espace visé par une création. Un administrateur crée toujours dans son espace ;
 * le propriétaire de la plateforme doit en désigner un.
 */
async function resolveOrganizationId(
  viewer: Viewer,
  requested?: string
): Promise<string | null> {
  if (viewer.organizationId !== null) return viewer.organizationId;
  if (!requested) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: requested },
    select: { id: true },
  });
  return organization?.id ?? null;
}

const NO_SPACE = { error: "Choisissez l'espace client concerné." } as const;

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

const MANAGEABLE_ROLES = ["ADMIN", "AGENT", "USER"] as const;

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(100),
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  role: z.enum(MANAGEABLE_ROLES),
  organizationId: z.string().optional(),
});

/**
 * Ajoute un membre à l'espace, avec un mot de passe temporaire retourné une seule fois.
 * Le compte est créé par un administrateur : l'email est considéré comme vérifié.
 */
export async function createUserAction(input: {
  name: string;
  email: string;
  role: string;
  organizationId?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  if (!canManageRole(admin.role, parsed.data.role)) return NOT_ALLOWED;

  try {
    const organizationId = await resolveOrganizationId(admin, parsed.data.organizationId);
    if (!organizationId) return NO_SPACE;

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return { error: "Un compte existe déjà avec cet email." };

    await organizationService.assertCanAddMember(organizationId);

    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId,
        password: await bcrypt.hash(tempPassword, 10),
        emailVerified: new Date(),
      },
    });

    await audit({
      userId: admin.id,
      action: "USER_CREATED",
      status: "SUCCESS",
      metadata: { targetUserId: user.id, role: user.role, organizationId },
    });

    revalidatePath("/admin/users");
    return { success: true as const, tempPassword };
  } catch (err) {
    return fail(err, "Création du compte impossible.");
  }
}

async function loadManageableUser(
  admin: Viewer,
  userId: string
): Promise<{ error: string } | { target: User }> {
  if (userId === admin.id) {
    return { error: "Vous ne pouvez pas modifier votre propre compte ici." };
  }
  // Le filtre d'espace rend invisible tout compte d'un autre client
  const target = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, ...scope.users(admin) },
  });
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
    organizationId: z.string().optional(),
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
  organizationId?: string;
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
    const organizationId = await resolveOrganizationId(admin, parsed.data.organizationId);
    if (!organizationId) return NO_SPACE;

    if (parsed.data.sourceId) {
      // La billetterie rattachée doit appartenir au même espace
      const source = await prisma.source.findFirst({
        where: { id: parsed.data.sourceId, organizationId },
        select: { id: true },
      });
      if (!source) return { error: "Cette billetterie n'appartient pas à cet espace." };
    }

    await organizationService.assertCanAddEvent(organizationId);

    const event = await prisma.event.create({
      data: {
        name: parsed.data.name,
        organizationId,
        sourceId: parsed.data.sourceId ?? null,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
      },
    });

    await audit({
      userId: admin.id,
      action: "EVENT_CREATED",
      status: "SUCCESS",
      metadata: { eventId: event.id, organizationId },
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
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...scope.events(admin) },
      select: { id: true, status: true, organizationId: true },
    });
    if (!event) return { error: "Événement introuvable." };

    // Rouvrir un événement clôturé compte dans la limite d'événements ouverts
    if (event.status === "CLOSED" && parsed.data !== "CLOSED") {
      await organizationService.assertCanAddEvent(event.organizationId);
    }

    await prisma.event.update({ where: { id: event.id }, data: { status: parsed.data } });

    await audit({
      userId: admin.id,
      action: "EVENT_STATUS_CHANGED",
      status: "SUCCESS",
      metadata: { eventId, status: parsed.data },
    });

    revalidatePath("/events");
    revalidatePath(`/events/${eventId}`);
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour de l'événement impossible.");
  }
}

// ─── Billetteries connectées par API ──────────────────────────────────────────

const nameSchema = z.string().trim().min(2, "Nom trop court").max(120);

/** Déclare une billetterie externe et génère sa clé API (affichée une seule fois). */
export async function createSourceAction(input: { name: string; organizationId?: string }) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nom invalide" };

  try {
    const organizationId = await resolveOrganizationId(admin, input.organizationId);
    if (!organizationId) return NO_SPACE;

    const source = await prisma.source.create({
      data: {
        name: parsed.data,
        slug: await organizationService.uniqueSourceSlug(parsed.data),
        organizationId,
      },
    });
    const { apiKey } = await integrationService.rotateApiKey(source.id);

    await audit({
      userId: admin.id,
      action: "SOURCE_CREATED",
      status: "SUCCESS",
      metadata: { sourceId: source.id, organizationId },
    });

    revalidatePath("/integrations");
    return { success: true as const, apiKey };
  } catch (err) {
    return fail(err, "Création de la billetterie impossible.");
  }
}

export async function rotateSourceApiKeyAction(sourceId: string) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const existing = await prisma.source.findFirst({
      where: { id: sourceId, ...scope.sources(admin) },
      select: { id: true },
    });
    if (!existing) return { error: "Billetterie introuvable." };

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
      where: { id: parsed.data.userId, isActive: true, isDeleted: false, ...scope.users(admin) },
      select: { id: true, organizationId: true },
    });
    if (!agent) return { error: "Agent introuvable ou inactif." };

    if (agent.organizationId) {
      await organizationService.assertCanAddDevice(agent.organizationId);
    }

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
      where: { id: deviceId, ...scope.devices(admin) },
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
    const existing = await prisma.device.findFirst({
      where: { id: deviceId, ...scope.devices(admin) },
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

// ─── Console propriétaire : gestion des espaces clients ───────────────────────

async function requireOwner(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isSuperAdmin ? viewer : null;
}

const createOrganizationSchema = z.object({
  name: nameSchema,
  adminName: z.string().trim().min(2, "Nom du responsable trop court").max(100),
  adminEmail: z.string().trim().toLowerCase().email("Adresse email invalide"),
});

/** Ouvre un espace client et son premier compte administrateur. */
export async function createOrganizationAction(input: {
  name: string;
  adminName: string;
  adminEmail: string;
}) {
  const owner = await requireOwner();
  if (!owner) return OWNER_ONLY;

  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    if (await prisma.user.findUnique({ where: { email: parsed.data.adminEmail } })) {
      return { error: "Un compte existe déjà avec cet email." };
    }

    const organization = await organizationService.create(parsed.data.name);
    const tempPassword = generateTempPassword();
    await prisma.user.create({
      data: {
        name: parsed.data.adminName,
        email: parsed.data.adminEmail,
        role: "ADMIN",
        organizationId: organization.id,
        password: await bcrypt.hash(tempPassword, 10),
        emailVerified: new Date(),
      },
    });

    await audit({
      userId: owner.id,
      action: "ORGANIZATION_CREATED",
      status: "SUCCESS",
      metadata: { organizationId: organization.id },
    });

    revalidatePath("/admin/organizations");
    return { success: true as const, tempPassword };
  } catch (err) {
    return fail(err, "Création de l'espace impossible.");
  }
}

/** Suspend ou réactive un espace. La suspension coupe toutes les sessions de ses membres. */
export async function setOrganizationActiveAction(organizationId: string, active: boolean) {
  const owner = await requireOwner();
  if (!owner) return OWNER_ONLY;

  try {
    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!existing) return { error: "Espace introuvable." };

    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: { isActive: active } }),
      ...(active ? [] : [prisma.session.deleteMany({ where: { user: { organizationId } } })]),
    ]);

    await audit({
      userId: owner.id,
      action: active ? "ORGANIZATION_ENABLED" : "ORGANIZATION_SUSPENDED",
      status: "SUCCESS",
      metadata: { organizationId },
    });

    revalidatePath("/admin/organizations");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour de l'espace impossible.");
  }
}

export async function setOrganizationPlanAction(organizationId: string, plan: string) {
  const owner = await requireOwner();
  if (!owner) return OWNER_ONLY;

  if (!(plan in PLANS)) return { error: "Formule inconnue." };

  try {
    const { count } = await prisma.organization.updateMany({
      where: { id: organizationId },
      data: { plan },
    });
    if (count === 0) return { error: "Espace introuvable." };

    await audit({
      userId: owner.id,
      action: "ORGANIZATION_PLAN_CHANGED",
      status: "SUCCESS",
      metadata: { organizationId, plan },
    });

    revalidatePath("/admin/organizations");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Changement de formule impossible.");
  }
}
