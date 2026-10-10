"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEventAction } from "@/actions/scanhub-admin";

interface Option {
  id: string;
  name: string;
}

interface SourceOption extends Option {
  organizationId: string;
}

interface CreateEventFormProps {
  organizations: Option[];
  sources: SourceOption[];
}

export function CreateEventForm({ organizations, sources }: CreateEventFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [sourceId, setSourceId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Seules les billetteries de l'organisation choisie peuvent être rattachées
  const availableSources = sources.filter((s) => s.organizationId === organizationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createEventAction({
        name,
        organizationId,
        sourceId: sourceId || undefined,
        // datetime-local est en heure locale du navigateur : conversion explicite en instant UTC
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setName("");
      setStartsAt("");
      setEndsAt("");
      toast.success("Événement créé.");
      router.refresh();
    });
  };

  if (organizations.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Aucun espace client disponible.
      </p>
    );
  }

  const fieldClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
  const labelClass = "text-xs font-medium text-gray-600 dark:text-gray-300";

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-3 md:items-end">
      <div className="space-y-1 md:col-span-3">
        <label htmlFor="event-name" className={labelClass}>
          Nom de l'événement
        </label>
        <Input
          id="event-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Tech Conference Niger 2027"
          minLength={2}
          maxLength={200}
          required
        />
      </div>
      <div className={organizations.length > 1 ? "space-y-1" : "hidden"}>
        <label htmlFor="event-org" className={labelClass}>
          Espace client
        </label>
        <select
          id="event-org"
          value={organizationId}
          onChange={(e) => {
            setOrganizationId(e.target.value);
            setSourceId("");
          }}
          className={fieldClass}
          required
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="event-source" className={labelClass}>
          Billetterie connectée (optionnel)
        </label>
        <select
          id="event-source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className={fieldClass}
        >
          <option value="">Aucune</option>
          {availableSources.map((src) => (
            <option key={src.id} value={src.id}>
              {src.name}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden md:block" />
      <div className="space-y-1">
        <label htmlFor="event-start" className={labelClass}>
          Début
        </label>
        <Input
          id="event-start"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="event-end" className={labelClass}>
          Fin
        </label>
        <Input
          id="event-end"
          type="datetime-local"
          value={endsAt}
          min={startsAt || undefined}
          onChange={(e) => setEndsAt(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Création…" : "Créer l'événement"}
      </Button>
    </form>
  );
}
