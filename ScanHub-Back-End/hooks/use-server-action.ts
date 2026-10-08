"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";

interface UseServerActionOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseServerActionReturn<T> {
  execute: (data: any) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  data: T | null;
  reset: () => void;
}

export function useServerAction<T = any>(
  action: (
    data: any
  ) => Promise<{ success?: string; error?: string; data?: T }>,
  options: UseServerActionOptions<T> = {}
): UseServerActionReturn<T> {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (actionData: any) => {
      setError(null);

      startTransition(async () => {
        try {
          const result = await action(actionData);

          if (result.error) {
            setError(result.error);
            options.onError?.(result.error);
            toast.error(
              result.error ||
                options.errorMessage ||
                "Une erreur s'est produite"
            );
          } else if (result.success) {
            setData(result.data || null);
            options.onSuccess?.(result.data as T);
            toast.success(
              result.success || options.successMessage || "Opération réussie"
            );
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Une erreur inattendue s'est produite";
          setError(errorMessage);
          options.onError?.(errorMessage);
          toast.error(errorMessage);
        }
      });
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return {
    execute,
    isLoading: isPending,
    error,
    data,
    reset,
  };
}
