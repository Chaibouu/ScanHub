"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { setEventStatusAction } from "@/actions/scanhub-admin";

const TRANSITIONS: Record<string, { status: string; label: string; confirm?: boolean }[]> = {
  ACTIVE: [
    { status: "PAUSED", label: "Suspendre les contrôles" },
    {
      status: "CLOSED",
      label: "Clôturer",
      confirm: true,
    },
  ],
  PAUSED: [
    { status: "ACTIVE", label: "Reprendre les contrôles" },
    {
      status: "CLOSED",
      label: "Clôturer",
      confirm: true,
    },
  ],
  CLOSED: [{ status: "ACTIVE", label: "Rouvrir" }],
};

export function EventStatusActions({ eventId, status }: { eventId: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const apply = async (next: { status: string; confirm?: boolean }) => {
    if (
      next.confirm &&
      !(await confirm({
        title: "Clôturer l'événement ?",
        description: "Tous les scans seront refusés. Vous pourrez le rouvrir plus tard.",
        confirmLabel: "Clôturer",
        destructive: true,
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setEventStatusAction(eventId, next.status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Statut de l'événement mis à jour.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(TRANSITIONS[status] ?? TRANSITIONS.CLOSED).map((next) => (
        <Button
          key={next.status}
          size="sm"
          variant={next.status === "CLOSED" ? "destructive" : "outline"}
          className="text-xs"
          disabled={isPending}
          onClick={() => apply(next)}
        >
          {next.label}
        </Button>
      ))}
      {dialog}
    </div>
  );
}
