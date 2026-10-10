import prisma from "@/lib/prisma";
import { getPlan, formatLimit, DEFAULT_PLAN } from "@/settings/plans";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "espace";
  let slug = root;
  for (let i = 2; await exists(slug); i++) {
    slug = `${root}-${i}`;
  }
  return slug;
}

async function planOf(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return getPlan(organization?.plan);
}

export const organizationService = {
  slugify,

  /** Crée un espace client avec un slug unique dérivé du nom. */
  async create(name: string) {
    const slug = await uniqueSlug(name, async (candidate) =>
      Boolean(await prisma.organization.findUnique({ where: { slug: candidate } }))
    );
    return prisma.organization.create({ data: { name: name.trim(), slug, plan: DEFAULT_PLAN } });
  },

  async uniqueSourceSlug(name: string) {
    return uniqueSlug(name, async (candidate) =>
      Boolean(await prisma.source.findUnique({ where: { slug: candidate } }))
    );
  },

  /**
   * Source interne d'un espace : porte les billets créés directement dans ScanHub
   * (saisie ou import), par opposition aux billets poussés par une billetterie via l'API.
   */
  async getInternalSource(organizationId: string) {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { slug: true },
    });
    const slug = `${organization.slug}--scanhub`;

    return prisma.source.upsert({
      where: { slug },
      update: {},
      create: { name: "ScanHub (création manuelle)", slug, organizationId },
    });
  },

  // ─── Limites de formule ─────────────────────────────────────────────────────

  async assertCanAddMember(organizationId: string) {
    const plan = await planOf(organizationId);
    const count = await prisma.user.count({ where: { organizationId, isDeleted: false } });
    if (count >= plan.maxMembers) {
      throw new PlanLimitError(
        `Limite de la formule ${plan.label} atteinte : ${formatLimit(plan.maxMembers)} comptes par espace.`
      );
    }
  },

  async assertCanAddDevice(organizationId: string) {
    const plan = await planOf(organizationId);
    const count = await prisma.device.count({ where: { user: { organizationId } } });
    if (count >= plan.maxDevices) {
      throw new PlanLimitError(
        `Limite de la formule ${plan.label} atteinte : ${formatLimit(plan.maxDevices)} terminaux par espace.`
      );
    }
  },

  async assertCanAddEvent(organizationId: string) {
    const plan = await planOf(organizationId);
    const count = await prisma.event.count({
      where: { organizationId, status: { not: "CLOSED" } },
    });
    if (count >= plan.maxActiveEvents) {
      throw new PlanLimitError(
        `Limite de la formule ${plan.label} atteinte : ${formatLimit(plan.maxActiveEvents)} événements ouverts en même temps. Clôturez un événement terminé pour en créer un nouveau.`
      );
    }
  },

  /** Vérifie qu'on peut ajouter `adding` billets à l'événement. */
  async assertCanAddTickets(organizationId: string, eventId: string, adding: number) {
    const plan = await planOf(organizationId);
    const count = await prisma.qRCode.count({ where: { eventId } });
    if (count + adding > plan.maxTicketsPerEvent) {
      const remaining = Math.max(0, plan.maxTicketsPerEvent - count);
      throw new PlanLimitError(
        `Limite de la formule ${plan.label} : ${formatLimit(plan.maxTicketsPerEvent)} billets par événement (${remaining} encore disponibles).`
      );
    }
  },
};
