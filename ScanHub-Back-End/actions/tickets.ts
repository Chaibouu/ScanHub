"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getViewer, scope, Viewer } from "@/lib/tenant";
import { PlanLimitError } from "@/modules/organizations/organizationService";
import {
  parseTicketCsv,
  ticketService,
  TicketError,
  TICKET_TYPES,
} from "@/modules/tickets/ticketService";

const FORBIDDEN = { error: "Action réservée aux administrateurs." } as const;

async function requireAdmin(): Promise<Viewer | null> {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}

/** L'événement doit appartenir à l'espace de l'administrateur. */
async function loadEvent(admin: Viewer, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, ...scope.events(admin) },
    select: { id: true, organizationId: true },
  });
}

function fail(err: unknown, message: string) {
  if (err instanceof PlanLimitError || err instanceof TicketError) return { error: err.message };
  logger.error({ err }, message);
  return { error: message };
}

const createTicketSchema = z.object({
  holderName: z.string().trim().min(2, "Nom trop court").max(150),
  holderEmail: z.union([z.literal(""), z.string().trim().email("Adresse email invalide")]).optional(),
  holderRole: z.string().trim().max(100).optional(),
  type: z.enum(TICKET_TYPES),
});

export async function createTicketAction(
  eventId: string,
  input: { holderName: string; holderEmail?: string; holderRole?: string; type: string }
) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const event = await loadEvent(admin, eventId);
    if (!event) return { error: "Événement introuvable." };

    const count = await ticketService.createTickets(event.organizationId, event.id, [
      {
        holderName: parsed.data.holderName,
        holderEmail: parsed.data.holderEmail || undefined,
        holderRole: parsed.data.holderRole || undefined,
        type: parsed.data.type,
      },
    ]);

    await audit({
      userId: admin.id,
      action: "TICKETS_CREATED",
      status: "SUCCESS",
      metadata: { eventId, count },
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true as const, count };
  } catch (err) {
    return fail(err, "Création du billet impossible.");
  }
}

const importSchema = z.object({
  csv: z.string().min(1, "Fichier vide").max(1_000_000, "Fichier trop volumineux"),
  defaultType: z.enum(TICKET_TYPES),
});

/** Importe une liste de participants (CSV) et génère un billet par ligne. */
export async function importTicketsAction(
  eventId: string,
  input: { csv: string; defaultType: string }
) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  try {
    const event = await loadEvent(admin, eventId);
    if (!event) return { error: "Événement introuvable." };

    const tickets = parseTicketCsv(parsed.data.csv, parsed.data.defaultType);
    if (tickets.length === 0) {
      return { error: "Aucune ligne exploitable : chaque ligne doit au moins contenir un nom." };
    }

    const count = await ticketService.createTickets(event.organizationId, event.id, tickets);

    await audit({
      userId: admin.id,
      action: "TICKETS_CREATED",
      status: "SUCCESS",
      metadata: { eventId, count, via: "import" },
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true as const, count };
  } catch (err) {
    return fail(err, "Import des billets impossible.");
  }
}

/** Révoque (ou rétablit) un billet. Un billet déjà utilisé ne peut pas être rétabli. */
export async function setTicketRevokedAction(ticketId: string, revoked: boolean) {
  const admin = await requireAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const ticket = await prisma.qRCode.findFirst({
      where: { id: ticketId, ...scope.qrCodes(admin) },
      select: { id: true, status: true, eventId: true, usedAt: true, reusable: true },
    });
    if (!ticket) return { error: "Billet introuvable." };

    if (revoked) {
      await prisma.qRCode.update({ where: { id: ticket.id }, data: { status: "REVOKED" } });
    } else {
      // updateMany conditionnel : on ne rétablit que ce qui est effectivement révoqué
      const { count } = await prisma.qRCode.updateMany({
        where: { id: ticket.id, status: "REVOKED" },
        // Un billet à usage unique déjà validé avant sa révocation redevient « utilisé », pas « valide »
        data: { status: ticket.usedAt && !ticket.reusable ? "USED" : "ACTIVE" },
      });
      if (count === 0) return { error: "Ce billet n'est pas révoqué." };
    }

    await audit({
      userId: admin.id,
      action: "TICKET_REVOKED",
      status: "SUCCESS",
      metadata: { ticketId, revoked },
    });

    if (ticket.eventId) revalidatePath(`/events/${ticket.eventId}`);
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour du billet impossible.");
  }
}
