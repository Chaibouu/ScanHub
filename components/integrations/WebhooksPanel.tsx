"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  createWebhookAction,
  deleteWebhookAction,
  setWebhookActiveAction,
  testWebhookAction,
} from "@/actions/webhooks";
import { SecretReveal } from "@/components/devices/SecretReveal";

export interface WebhookView {
  id: string;
  url: string;
  active: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusOf(webhook: WebhookView) {
  if (!webhook.active) return { label: "Désactivé", className: "bg-gray-200 text-gray-700" };
  if (webhook.consecutiveFailures > 0) {
    return {
      label: `${webhook.consecutiveFailures} échec(s) d'affilée`,
      className: "bg-amber-100 text-amber-800",
    };
  }
  if (webhook.lastSuccessAt) return { label: "Fonctionne", className: "bg-green-100 text-green-700" };
  return { label: "Jamais appelé", className: "bg-blue-100 text-blue-700" };
}

/** Adresses de notification : ScanHub y envoie chaque scan dès qu'il est enregistré. */
export function WebhooksPanel({ webhooks }: { webhooks: WebhookView[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const run = (
    action: () => Promise<{ error: string } | { success: true; secret?: string }>,
    message: string
  ) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
      } else {
        if (result.secret) setSecret(result.secret);
        toast.success(message);
      }
      router.refresh();
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const result = await createWebhookAction(url);
      if (!("error" in result)) setUrl("");
      return result;
    }, "Adresse ajoutée.");
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: "Supprimer cette adresse ?",
      description: "Elle ne recevra plus aucun scan.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!confirmed) return;
    run(() => deleteWebhookAction(id), "Adresse supprimée.");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-1">
          <label htmlFor="webhook-url" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Adresse de votre serveur qui recevra les scans
          </label>
          <Input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://votre-site.com/api/scanhub"
            maxLength={2000}
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Ajout…" : "Ajouter l'adresse"}
        </Button>
      </form>

      {secret && (
        <SecretReveal
          label="Secret de signature — sert à vérifier que les envois viennent bien de ScanHub"
          value={secret}
          onDismiss={() => setSecret(null)}
        />
      )}

      {webhooks.length === 0 ? (
        <p className="text-xs text-gray-500">Aucune adresse configurée.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {webhooks.map((webhook) => {
            const status = statusOf(webhook);
            const lastSuccess = formatWhen(webhook.lastSuccessAt);
            const lastFailure = formatWhen(webhook.lastFailureAt);
            return (
              <li key={webhook.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-gray-900 dark:text-white">{webhook.url}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    {lastSuccess && <span>Dernier succès : {lastSuccess}</span>}
                    {lastFailure && <span>Dernier échec : {lastFailure}</span>}
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => run(() => testWebhookAction(webhook.id), "Test reçu par votre serveur.")}
                  >
                    Tester
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () => setWebhookActiveAction(webhook.id, !webhook.active),
                        webhook.active ? "Adresse désactivée." : "Adresse réactivée."
                      )
                    }
                  >
                    {webhook.active ? "Désactiver" : "Réactiver"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleDelete(webhook.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </div>
  );
}
