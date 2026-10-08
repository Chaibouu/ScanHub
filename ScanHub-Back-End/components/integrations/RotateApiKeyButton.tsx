"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rotateSourceApiKeyAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

export function RotateApiKeyButton({ sourceId, hasKey }: { sourceId: string; hasKey: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const rotate = () => {
    if (
      hasKey &&
      !window.confirm("Régénérer la clé ? L'ancienne cessera de fonctionner immédiatement.")
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
    </div>
  );
}
