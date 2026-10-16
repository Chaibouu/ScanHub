"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  description: string;
  /** Libellé du bouton de confirmation (par défaut « Confirmer ») */
  confirmLabel?: string;
  /** Action irréversible ou qui coupe un accès : bouton rouge */
  destructive?: boolean;
}

/**
 * Confirmation dans une modale shadcn, à la place de window.confirm.
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title, description }))) return;
 *   …
 *   return <>{…}{dialog}</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    // Une demande encore ouverte est considérée comme refusée
    resolveRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  };

  const dialog = (
    <AlertDialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={options?.destructive ? buttonVariants({ variant: "destructive" }) : undefined}
          >
            {options?.confirmLabel ?? "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
