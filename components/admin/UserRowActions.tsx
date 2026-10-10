"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserRoleAction,
} from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

interface UserRowActionsProps {
  userId: string;
  role: string;
  isActive: boolean;
  /** Rôles que l'administrateur courant a le droit d'attribuer */
  assignableRoles: string[];
}

export function UserRowActions({ userId, role, isActive, assignableRoles }: UserRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const run = (
    action: () => Promise<{ error: string } | { success: true; tempPassword?: string }>,
    successMessage: string
  ) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.tempPassword) setTempPassword(result.tempPassword);
      toast.success(successMessage);
      router.refresh();
    });
  };

  const changeRole = (nextRole: string) => {
    if (nextRole === role) return;
    run(() => updateUserRoleAction(userId, nextRole), "Rôle mis à jour.");
  };

  const toggleActive = () => {
    if (
      isActive &&
      !window.confirm("Désactiver ce compte ? Toutes ses sessions seront fermées immédiatement.")
    ) {
      return;
    }
    run(
      () => setUserActiveAction(userId, !isActive),
      isActive ? "Compte désactivé." : "Compte réactivé."
    );
  };

  const resetPassword = () => {
    if (!window.confirm("Générer un nouveau mot de passe ? L'ancien cessera de fonctionner.")) {
      return;
    }
    run(() => resetUserPasswordAction(userId), "Mot de passe réinitialisé.");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          aria-label="Rôle"
          value={role}
          disabled={isPending}
          onChange={(e) => changeRole(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          {assignableRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={isPending} onClick={resetPassword}>
          Nouveau mot de passe
        </Button>
        <Button
          size="sm"
          variant={isActive ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggleActive}
        >
          {isActive ? "Désactiver" : "Réactiver"}
        </Button>
      </div>
      {tempPassword && (
        <SecretReveal
          label="Mot de passe temporaire"
          value={tempPassword}
          onDismiss={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}
