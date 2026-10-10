"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOrganizationAction, createSourceAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

const labelClass = "text-xs font-medium text-gray-600 dark:text-gray-300";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createOrganizationAction({ name });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setName("");
      toast.success("Organisation créée.");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 md:items-end">
      <div className="flex-1 space-y-1">
        <label htmlFor="org-name" className={labelClass}>
          Nouvelle organisation
        </label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Ministère de la Jeunesse"
          minLength={2}
          maxLength={120}
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Création…" : "Créer l'organisation"}
      </Button>
    </form>
  );
}

/** Crée un partenaire ; sa clé API n'est affichée qu'une fois, juste après la création. */
export function CreateSourceForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [apiKey, setApiKey] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createSourceAction({ name, organizationId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setApiKey(result.apiKey);
      setName("");
      toast.success("Partenaire créé.");
      router.refresh();
    });
  };

  if (organizations.length === 0) {
    return <p className="text-xs text-gray-500">Créez d'abord une organisation.</p>;
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1 space-y-1">
          <label htmlFor="source-name" className={labelClass}>
            Nouveau partenaire (billetterie)
          </label>
          <Input
            id="source-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : EventHub Niger"
            minLength={2}
            maxLength={120}
            required
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="source-org" className={labelClass}>
            Organisation
          </label>
          <select
            id="source-org"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            required
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Création…" : "Créer le partenaire"}
        </Button>
      </form>

      {apiKey && (
        <SecretReveal
          label="Clé API du partenaire (en-tête x-api-key)"
          value={apiKey}
          onDismiss={() => setApiKey(null)}
        />
      )}
    </div>
  );
}
