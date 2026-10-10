"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

const ROLE_LABELS: Record<string, string> = {
  AGENT: "Agent (contrôle d'accès mobile)",
  USER: "Utilisateur (consultation)",
  ADMIN: "Administrateur",
};

/**
 * Création d'un compte par un administrateur.
 * Le mot de passe temporaire n'est affiché qu'une fois, juste après la création.
 */
export function CreateUserForm({ allowedRoles }: { allowedRoles: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(allowedRoles[0] ?? "AGENT");
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createUserAction({ name, email, role });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCreated({ email, tempPassword: result.tempPassword });
      setName("");
      setEmail("");
      toast.success("Compte créé.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-1">
          <label htmlFor="user-name" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Nom complet
          </label>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Aïcha Mahamadou"
            minLength={2}
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="user-email" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Email
          </label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@domaine.com"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="user-role" className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Rôle
          </label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Création…" : "Créer le compte"}
        </Button>
      </form>

      {created && (
        <SecretReveal
          label={`Mot de passe temporaire de ${created.email} — à transmettre à la personne, qui devra le changer`}
          value={created.tempPassword}
          onDismiss={() => setCreated(null)}
        />
      )}
    </div>
  );
}
