import type { NextRequest, NextResponse } from "next/server";
import type { Organization, Source } from "@prisma/client";
import { jsonError } from "@/lib/response";
import { rateLimitRedis } from "@/lib/rateLimitRedis";
import { integrationService } from "@/modules/integrations/integrationService";

/**
 * Authentification des appels de l'API développeur (`/api/v1/integrations/*`).
 *
 * Une plateforme cliente s'identifie avec sa clé secrète dans l'en-tête `x-api-key`.
 * La clé désigne une « billetterie connectée » (Source) et, à travers elle, un espace :
 * tout ce que fait la clé reste dans cet espace.
 */

export type IntegrationSource = Source & { organization: Organization };

// Par clé API. Assez large pour un import de badges, assez bas pour contenir un emballement.
const API_RATE_LIMIT = { windowMs: 60 * 1000, max: 600 };

type AuthResult =
  | { ok: true; source: IntegrationSource }
  | { ok: false; response: NextResponse };

export async function authenticateIntegration(req: NextRequest): Promise<AuthResult> {
  const source = await integrationService.authenticateApiKey(req.headers.get("x-api-key"));

  if (!source) {
    return { ok: false, response: jsonError("Clé API invalide ou non autorisée", 401) };
  }

  if (!source.organization.isActive) {
    return { ok: false, response: jsonError("Cet espace ScanHub est suspendu.", 403) };
  }

  const limited = await rateLimitRedis(`api:${source.id}`, API_RATE_LIMIT);
  if (limited) return { ok: false, response: limited };

  return { ok: true, source };
}
