"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SecretRevealProps {
  label: string;
  value: string;
  onDismiss: () => void;
}

/** Affiche une seule fois un secret fraîchement généré (code d'activation, clé API). */
export function SecretReveal({ label, value, onDismiss }: SecretRevealProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copié dans le presse-papiers");
    } catch {
      toast.error("Copie impossible — sélectionnez le texte manuellement.");
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 space-y-2">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{label}</p>
      <code className="block break-all rounded bg-gray-900 px-3 py-2 font-mono text-sm text-emerald-400">
        {value}
      </code>
      <p className="text-[11px] text-amber-800 dark:text-amber-300">
        Notez-le maintenant : il ne sera plus jamais affiché.
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          Copier
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          J'ai noté, masquer
        </Button>
      </div>
    </div>
  );
}
