"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resetDeviceActivationAction, setDeviceActiveAction } from "@/actions/scanhub-admin";
import { SecretReveal } from "@/components/devices/SecretReveal";

interface DeviceRowActionsProps {
  deviceId: string;
  active: boolean;
}

export function DeviceRowActions({ deviceId, active }: DeviceRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activationCode, setActivationCode] = useState<string | null>(null);

  const toggle = () => {
    startTransition(async () => {
      const result = await setDeviceActiveAction(deviceId, !active);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "Terminal bloqué." : "Terminal réactivé.");
      router.refresh();
    });
  };

  const resetCode = () => {
    if (!window.confirm("Générer un nouveau code ? La clé actuelle du terminal sera invalidée.")) {
      return;
    }
    startTransition(async () => {
      const result = await resetDeviceActivationAction(deviceId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setActivationCode(result.activationCode);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={active ? "destructive" : "outline"}
          disabled={isPending}
          onClick={toggle}
        >
          {active ? "Bloquer" : "Réactiver"}
        </Button>
        <Button size="sm" variant="outline" disabled={isPending} onClick={resetCode}>
          Nouveau code
        </Button>
      </div>
      {activationCode && (
        <SecretReveal
          label="Nouveau code d'activation (48 h)"
          value={activationCode}
          onDismiss={() => setActivationCode(null)}
        />
      )}
    </div>
  );
}
