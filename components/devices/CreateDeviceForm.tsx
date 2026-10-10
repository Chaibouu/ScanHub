"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDeviceAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

interface AgentOption {
  id: string;
  label: string;
}

/**
 * Création d'un terminal en attente d'activation.
 * Le code d'activation n'est affiché qu'une fois, juste après la création.
 */
export function CreateDeviceForm({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(agents[0]?.id ?? "");
  const [activationCode, setActivationCode] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createDeviceAction({ name, userId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setActivationCode(result.activationCode);
      setName("");
      toast.success("Terminal créé — transmettez le code à l'agent.");
      router.refresh();
    });
  };

  if (agents.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Aucun agent actif : créez d'abord un compte agent pour lui associer un terminal.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1 space-y-1">
          <label htmlFor="device-name" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Nom du terminal
          </label>
          <Input
            id="device-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Scanner Porte Nord"
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="device-agent" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Agent associé
          </label>
          <select
            id="device-agent"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            required
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Création…" : "Générer un code d'activation"}
        </Button>
      </form>

      {activationCode && (
        <SecretReveal
          label="Code d'activation (valable 48 h, usage unique)"
          value={activationCode}
          onDismiss={() => setActivationCode(null)}
        />
      )}
    </div>
  );
}
