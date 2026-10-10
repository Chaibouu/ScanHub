"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createOrganizationAction,
  setOrganizationActiveAction,
  setOrganizationPlanAction,
} from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

const labelClass = "text-xs font-medium text-gray-600 dark:text-gray-300";

/** Ouvre un espace client et son premier administrateur (console propriétaire). */
export function CreateOrganizationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createOrganizationAction({ name, adminName, adminEmail });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCreated({ email: adminEmail, tempPassword: result.tempPassword });
      setName("");
      setAdminName("");
      setAdminEmail("");
      toast.success("Espace créé.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-1">
          <label htmlFor="org-name" className={labelClass}>
            Nom de l'organisation
          </label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Festival du Sahel"
            minLength={2}
            maxLength={120}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="org-admin-name" className={labelClass}>
            Nom du responsable
          </label>
          <Input
            id="org-admin-name"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Prénom Nom"
            minLength={2}
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="org-admin-email" className={labelClass}>
            Email du responsable
          </label>
          <Input
            id="org-admin-email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="responsable@domaine.com"
            autoComplete="off"
            required
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Création…" : "Ouvrir l'espace"}
        </Button>
      </form>

      {created && (
        <SecretReveal
          label={`Mot de passe temporaire de ${created.email}`}
          value={created.tempPassword}
          onDismiss={() => setCreated(null)}
        />
      )}
    </div>
  );
}

interface OrganizationRowActionsProps {
  organizationId: string;
  isActive: boolean;
  plan: string;
  plans: { value: string; label: string }[];
}

export function OrganizationRowActions({
  organizationId,
  isActive,
  plan,
  plans,
}: OrganizationRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error: string } | { success: true }>, message: string) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      router.refresh();
    });
  };

  const toggleActive = () => {
    if (
      isActive &&
      !window.confirm("Suspendre cet espace ? Tous ses membres seront déconnectés immédiatement.")
    ) {
      return;
    }
    run(
      () => setOrganizationActiveAction(organizationId, !isActive),
      isActive ? "Espace suspendu." : "Espace réactivé."
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Formule"
        value={plan}
        disabled={isPending}
        onChange={(e) =>
          run(() => setOrganizationPlanAction(organizationId, e.target.value), "Formule mise à jour.")
        }
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        {plans.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant={isActive ? "destructive" : "outline"}
        disabled={isPending}
        onClick={toggleActive}
      >
        {isActive ? "Suspendre" : "Réactiver"}
      </Button>
    </div>
  );
}
