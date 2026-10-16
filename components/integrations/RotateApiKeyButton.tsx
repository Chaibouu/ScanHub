"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { rotateSourceApiKeyAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

export function RotateApiKeyButton({ sourceId, hasKey }: { sourceId: string; hasKey: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const rotate = async () => {
    if (
      hasKey &&
      !(await confirm({
        title: "Régénérer la clé API ?",
        description:
          "L'ancienne clé cessera de fonctionner immédiatement : la plateforme qui l'utilise devra être mise à jour.",
        confirmLabel: "Régénérer",
        destructive: true,
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await rotateSourceApiKeyAction(sourceId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setApiKey(result.apiKey);
    });
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={rotate}>
        {isPending ? "Génération…" : hasKey ? "Régénérer la clé API" : "Générer une clé API"}
      </Button>
      {apiKey && (
        <SecretReveal
          label="Nouvelle clé API (en-tête x-api-key)"
          value={apiKey}
          onDismiss={() => setApiKey(null)}
        />
      )}
      {dialog}
    </div>
  );
}
