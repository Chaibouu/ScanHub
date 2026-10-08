import { z } from "zod";

// Schémas de validation communs
export const emailSchema = z.string().email("Email invalide");
export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères");
export const nameSchema = z
  .string()
  .min(2, "Le nom doit contenir au moins 2 caractères");
export const urlSchema = z.string().url("URL invalide").optional();

// Schéma pour les IDs
export const idSchema = z.string().min(1, "ID requis");

// Schéma pour les dates
export const dateSchema = z.string().datetime().optional();

// Schéma pour les nombres
export const numberSchema = z.number().positive("Le nombre doit être positif");

// Fonction utilitaire pour valider des données avec gestion d'erreurs
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

// Fonction pour formater les erreurs Zod en messages utilisateur
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};

  error.errors.forEach(err => {
    const field = err.path.join(".");
    formattedErrors[field] = err.message;
  });

  return formattedErrors;
}

// Fonction pour valider un FormData
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  formData: FormData
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const data: Record<string, any> = {};

  // Convertir FormData en objet
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }

  const result = validateData(schema, data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return {
      success: false,
      errors: formatZodErrors(result.errors),
    };
  }
}

// Schéma pour la pagination
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Type helper pour extraire le type d'un schéma Zod
export type InferSchemaType<T extends z.ZodSchema> = z.infer<T>;
