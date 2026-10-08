/**
 * Gestion centralisée des erreurs de l'application
 */

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Non authentifié") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Non autorisé") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Ressource") {
    super(`${resource} non trouvé(e)`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Trop de requêtes") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "Erreur de base de données") {
    super(message, 500, "DATABASE_ERROR", false);
  }
}

/**
 * Formate une erreur pour la réponse API
 */
export function formatError(error: unknown): {
  message: string;
  code?: string;
  statusCode: number;
  fields?: Record<string, string[]>;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...(error instanceof ValidationError && { fields: error.fields }),
    };
  }

  if (error instanceof Error) {
    return {
      message: process.env.NODE_ENV === "production" 
        ? "Une erreur est survenue" 
        : error.message,
      statusCode: 500,
    };
  }

  return {
    message: "Une erreur inattendue est survenue",
    statusCode: 500,
  };
}

/**
 * Wrapper pour gérer les erreurs dans les API routes
 */
export function handleApiError(error: unknown) {
  const formatted = formatError(error);
  
  // Logger l'erreur en développement
  if (process.env.NODE_ENV === "development") {
    console.error("API Error:", error);
  }
  
  return Response.json(
    {
      error: formatted.message,
      ...(formatted.code && { code: formatted.code }),
      ...(formatted.fields && { fields: formatted.fields }),
    },
    { status: formatted.statusCode }
  );
}
