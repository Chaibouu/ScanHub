import { Prisma, QRType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { generateToken, hashToken, hashTokenOffline } from "@/lib/crypto";
import { decryptSecret, encryptSecret } from "@/lib/tokens";
import { organizationService } from "@/modules/organizations/organizationService";

/**
 * Billets créés directement dans ScanHub (saisie ou import), par opposition aux billets
 * poussés par une billetterie externe via l'API.
 *
 * Le token d'un billet n'est jamais stocké en clair : on garde son hash (vérification)
 * et une copie chiffrée AES-256-GCM (`tokenEnc`) qui permet de ré-afficher, ré-imprimer
 * ou ré-exporter le QR code plus tard.
 */

export const TICKET_TYPES = ["TICKET", "INVITATION", "BADGE", "PASS"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const MAX_IMPORT_ROWS = 2000;

export interface TicketInput {
  holderName: string;
  holderEmail?: string;
  holderRole?: string;
  type: TicketType;
}

export class TicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketError";
  }
}

/** Un billet ou une invitation ne sert qu'une fois ; un badge ou un pass est réutilisable. */
function isReusable(type: TicketType): boolean {
  return type === "BADGE" || type === "PASS";
}

function tokenPrefix(type: TicketType): string {
  return type === "TICKET" || type === "INVITATION" ? "TKT" : "SCN";
}

// ─── Import CSV ───────────────────────────────────────────────────────────────

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

const HEADER_ALIASES: Record<string, keyof TicketInput> = {
  nom: "holderName",
  name: "holderName",
  titulaire: "holderName",
  participant: "holderName",
  "nom complet": "holderName",
  email: "holderEmail",
  "e-mail": "holderEmail",
  mail: "holderEmail",
  role: "holderRole",
  rôle: "holderRole",
  categorie: "holderRole",
  catégorie: "holderRole",
  fonction: "holderRole",
  type: "type",
};

const TYPE_ALIASES: Record<string, TicketType> = {
  ticket: "TICKET",
  billet: "TICKET",
  invitation: "INVITATION",
  badge: "BADGE",
  pass: "PASS",
};

/**
 * Lit une liste de participants au format CSV (séparateur « ; » ou « , »).
 * Colonnes reconnues par leur en-tête : nom, email, rôle/catégorie, type.
 * Sans ligne d'en-tête, l'ordre attendu est : nom ; email ; rôle.
 */
export function parseTicketCsv(text: string, defaultType: TicketType): TicketInput[] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const separator = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const firstCells = splitCsvLine(lines[0], separator).map((cell) => cell.toLowerCase());
  const hasHeader = firstCells.some((cell) => cell in HEADER_ALIASES);

  const columns: (keyof TicketInput | null)[] = hasHeader
    ? firstCells.map((cell) => HEADER_ALIASES[cell] ?? null)
    : ["holderName", "holderEmail", "holderRole"];

  const tickets: TicketInput[] = [];
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsvLine(line, separator);
    const row: Partial<Record<keyof TicketInput, string>> = {};
    columns.forEach((column, index) => {
      if (column && cells[index]) row[column] = cells[index];
    });

    const holderName = row.holderName?.slice(0, 150);
    if (!holderName) continue; // ligne sans nom : ignorée

    tickets.push({
      holderName,
      holderEmail: row.holderEmail?.slice(0, 200) || undefined,
      holderRole: row.holderRole?.slice(0, 100) || undefined,
      type: TYPE_ALIASES[row.type?.toLowerCase() ?? ""] ?? defaultType,
    });
  }
  return tickets;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ticketService = {
  /**
   * Crée des billets pour un événement. `organizationId` est celui de l'événement,
   * déjà vérifié par l'appelant (voir actions/tickets.ts).
   */
  async createTickets(organizationId: string, eventId: string, tickets: TicketInput[]) {
    if (tickets.length === 0) throw new TicketError("Aucun billet à créer.");
    if (tickets.length > MAX_IMPORT_ROWS) {
      throw new TicketError(`Import limité à ${MAX_IMPORT_ROWS} billets à la fois.`);
    }

    await organizationService.assertCanAddTickets(organizationId, eventId, tickets.length);
    const source = await organizationService.getInternalSource(organizationId);

    const data: Prisma.QRCodeCreateManyInput[] = tickets.map((ticket) => {
      const token = generateToken(tokenPrefix(ticket.type));
      return {
        tokenHash: hashToken(token),
        offlineHash: hashTokenOffline(token),
        tokenEnc: encryptSecret(token),
        type: ticket.type as QRType,
        reusable: isReusable(ticket.type),
        sourceId: source.id,
        eventId,
        metadata: {
          holderName: ticket.holderName,
          ...(ticket.holderEmail ? { holderEmail: ticket.holderEmail } : {}),
          ...(ticket.holderRole ? { holderRole: ticket.holderRole } : {}),
          registeredVia: "DASHBOARD",
        },
      };
    });

    const { count } = await prisma.qRCode.createMany({ data });
    return count;
  },

  /** Billets d'un événement avec leur token déchiffré (impression / export). */
  async listWithTokens(eventId: string, options: { ticketId?: string; skip?: number; take?: number } = {}) {
    const rows = await prisma.qRCode.findMany({
      where: { eventId, ...(options.ticketId ? { id: options.ticketId } : {}) },
      orderBy: { createdAt: "asc" },
      skip: options.skip,
      take: options.take,
    });

    return rows.map((row) => {
      const meta = (row.metadata as Record<string, string> | null) ?? {};
      let token: string | null = null;
      try {
        token = row.tokenEnc ? decryptSecret(row.tokenEnc) : null;
      } catch {
        token = null; // clé de chiffrement changée : le QR ne peut plus être ré-affiché
      }
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        reusable: row.reusable,
        holderName: meta.holderName || meta.name || "Participant",
        holderEmail: meta.holderEmail || "",
        holderRole: meta.holderRole || meta.role || meta.ticketType || "",
        // null pour les billets poussés par une billetterie externe (elle seule détient le token)
        token,
      };
    });
  },
};
