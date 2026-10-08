// context/SessionContext.tsx
"use client";

import { User } from "@/types/user";
import { createContext, useContext, ReactNode, useMemo, useCallback } from "react";

type SessionContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonation: boolean;
  refreshUser: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({
  user,
  isImpersonation = false,
  children,
}: {
  user: User | null;
  isImpersonation?: boolean;
  children: ReactNode;
}) => {
  const isAuthenticated = useMemo(() => !!user, [user]);

  const refreshUser = useCallback(async () => {
    try {
      // Implémentation possible : appel API pour rafraîchir les données utilisateur
    } catch (error) {
      console.error("Erreur lors du rafraîchissement de l'utilisateur:", error);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading: false,
      isImpersonation,
      refreshUser,
    }),
    [user, isAuthenticated, isImpersonation, refreshUser]
  );

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession doit être utilisé à l'intérieur de SessionProvider");
  }
  return context;
};

export const useAuth = () => {
  const { isAuthenticated, user } = useSession();
  return { isAuthenticated, user };
};
