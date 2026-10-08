// Types pour les réponses standardisées
export interface ActionResponse<T = any> {
  success?: string;
  error?: string;
  data?: T;
  errors?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  success?: string;
  error?: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Fonctions utilitaires pour créer des réponses standardisées
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): ActionResponse<T> {
  return {
    success: message || "Opération réussie",
    data,
  };
}

export function createErrorResponse(
  error: string,
  errors?: Record<string, string>
): ActionResponse {
  return {
    error,
    errors,
  };
}

export function createValidationErrorResponse(
  errors: Record<string, string>
): ActionResponse {
  return {
    error: "Données invalides",
    errors,
  };
}

export function createNotFoundResponse(
  resource: string = "Ressource"
): ActionResponse {
  return {
    error: `${resource} introuvable`,
  };
}

export function createUnauthorizedResponse(): ActionResponse {
  return {
    error: "Accès non autorisé",
  };
}

export function createForbiddenResponse(): ActionResponse {
  return {
    error: "Accès interdit",
  };
}

export function createServerErrorResponse(): ActionResponse {
  return {
    error: "Erreur interne du serveur",
  };
}

// Fonction pour créer une réponse paginée
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: message || "Données récupérées avec succès",
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// Fonction pour wrapper une Server Action avec gestion d'erreurs
export async function withErrorHandling<T>(
  action: () => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    const result = await action();
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Erreur dans Server Action:", error);

    if (error instanceof Error) {
      return createErrorResponse(error.message);
    }

    return createServerErrorResponse();
  }
}

// Fonction pour wrapper une Server Action avec validation
export async function withValidation<T, S>(
  schema: any,
  data: unknown,
  action: (validatedData: S) => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    const validation = schema.safeParse(data);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err: any) => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });

      return createValidationErrorResponse(errors);
    }

    const result = await action(validation.data);
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Erreur dans Server Action:", error);

    if (error instanceof Error) {
      return createErrorResponse(error.message);
    }

    return createServerErrorResponse();
  }
}

// Fonction pour wrapper une Server Action avec authentification
export async function withAuth<T>(
  action: () => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    // Import dynamique pour éviter les problèmes de circular dependencies
    const { getAuthenticatedUser } = await import("./auth-utils");
    await getAuthenticatedUser();

    const result = await action();
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    return createUnauthorizedResponse();
  }
}

// Fonction pour wrapper une Server Action avec permissions
export async function withPermission<T>(
  permission: string,
  action: () => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    // Import dynamique pour éviter les problèmes de circular dependencies
    const { requirePermission } = await import("./auth-utils");
    await requirePermission(permission);

    const result = await action();
    return createSuccessResponse(result);
  } catch (error) {
    console.error("Erreur de permission:", error);
    return createForbiddenResponse();
  }
}
