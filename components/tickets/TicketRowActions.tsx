"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { setTicketRevokedAction } from "@/actions/tickets";

interface TicketRowActionsProps {
  eventId: string;
  ticketId: string;
  status: string;
  /** false pour un billet venu d'une billetterie externe : ScanHub ne détient pas son QR */
  hasQr: boolean;
  canManage: boolean;
}

export function TicketRowActions({ eventId, ticketId, status, hasQr, canManage }: TicketRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isRevoked = status === "REVOKED";
  const { confirm, dialog } = useConfirm();

  const toggleRevoked = async () => {
    if (
      !isRevoked &&
      !(await confirm({
        title: "Révoquer ce billet ?",
        description: "Il sera refusé à l'entrée. Vous pourrez le rétablir plus tard.",
        confirmLabel: "Révoquer",
        destructive: true,
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await setTicketRevokedAction(ticketId, !isRevoked);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isRevoked ? "Billet rétabli." : "Billet révoqué.");
      router.refresh();
    });
  };

  return (
    <div className="flex justify-end gap-2">
      {hasQr && (
        <Link href={`/events/${eventId}/print?ticket=${ticketId}`} target="_blank">
          <Button size="sm" variant="outline">
            QR code
          </Button>
        </Link>
      )}
      {canManage && (
        <Button
          size="sm"
          variant={isRevoked ? "outline" : "destructive"}
          disabled={isPending}
          onClick={toggleRevoked}
        >
          {isRevoked ? "Rétablir" : "Révoquer"}
        </Button>
      )}
      {dialog}
    </div>
  );
}
