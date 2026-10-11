"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { getViewer } from "@/lib/tenant";
import { webhookService, WebhookError } from "@/modules/webhooks/webhookService";

/** Les webhooks appartiennent à un espace : seul un administrateur de cet espace les gère. */
async function requireSpaceAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin || viewer.organizationId === null) return null;
  return { id: viewer.id, organizationId: viewer.organizationId };
}

const FORBIDDEN = { error: "Action réservée aux administrateurs d'un espace." } as const;

function fail(err: unknown, message: string) {
  if (err instanceof WebhookError) return { error: err.message };
  logger.error({ err }, message);
  return { error: message };
}

export async function createWebhookAction(url: string) {
  const admin = await requireSpaceAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const { endpoint, secret } = await webhookService.create(admin.organizationId, url);
    await audit({
      userId: admin.id,
      action: "WEBHOOK_CREATED",
      status: "SUCCESS",
      metadata: { webhookId: endpoint.id },
    });
    revalidatePath("/integrations");
    return { success: true as const, secret };
  } catch (err) {
    return fail(err, "Création du webhook impossible.");
  }
}

export async function deleteWebhookAction(webhookId: string) {
  const admin = await requireSpaceAdmin();
  if (!admin) return FORBIDDEN;

  try {
    await webhookService.remove(admin.organizationId, webhookId);
    await audit({
      userId: admin.id,
      action: "WEBHOOK_DELETED",
      status: "SUCCESS",
      metadata: { webhookId },
    });
    revalidatePath("/integrations");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Suppression du webhook impossible.");
  }
}

export async function setWebhookActiveAction(webhookId: string, active: boolean) {
  const admin = await requireSpaceAdmin();
  if (!admin) return FORBIDDEN;

  try {
    await webhookService.setActive(admin.organizationId, webhookId, active);
    revalidatePath("/integrations");
    return { success: true as const };
  } catch (err) {
    return fail(err, "Mise à jour du webhook impossible.");
  }
}

export async function testWebhookAction(webhookId: string) {
  const admin = await requireSpaceAdmin();
  if (!admin) return FORBIDDEN;

  try {
    const result = await webhookService.sendTest(admin.organizationId, webhookId);
    revalidatePath("/integrations");
    if (result.ok) return { success: true as const };
    return {
      error: `Votre serveur n'a pas accepté le test : ${
        "error" in result && result.error ? result.error : "pas de réponse"
      }`,
    };
  } catch (err) {
    return fail(err, "Envoi du test impossible.");
  }
}
