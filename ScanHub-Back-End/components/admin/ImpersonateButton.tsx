"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startImpersonation } from "@/actions/impersonate";

interface ImpersonateButtonProps {
  targetUserId: string;
  targetName: string | null;
}

/**
 * Bouton "Auditer" — déclenche une session d'impersonation admin.
 *
 * Utilise startImpersonation() (Server Action) pour poser le cookie httpOnly,
 * puis router.refresh() pour re-rendre le RootLayout (Server Component) et
 * activer la bannière d'impersonation.
 */
export function ImpersonateButton({ targetUserId, targetName }: ImpersonateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleImpersonate = () => {
    startTransition(async () => {
      const result = await startImpersonation(targetUserId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Session audit démarrée — ${targetName ?? "utilisateur"}`);

      // Re-render les Server Components (RootLayout → getUser() → isImpersonation: true)
      // La bannière apparaît automatiquement après le refresh
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleImpersonate}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? (
        <>
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Ouverture...
        </>
      ) : (
        <>
          {/* Icône œil */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Auditer
        </>
      )}
    </button>
  );
}
