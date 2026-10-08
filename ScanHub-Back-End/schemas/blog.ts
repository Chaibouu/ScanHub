import { z } from "zod";
import { nameSchema, idSchema } from "@/lib/validation-utils";

// Schéma pour créer un blog
export const createBlogSchema = z.object({
  title: nameSchema.max(255, "Le titre ne peut pas dépasser 255 caractères"),
  description: z
    .string()
    .max(1000, "La description ne peut pas dépasser 1000 caractères")
    .optional(),
  slug: z
    .string()
    .min(3, "Le slug doit contenir au moins 3 caractères")
    .max(255, "Le slug ne peut pas dépasser 255 caractères")
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"
    ),
  isPublished: z.boolean().default(false),
  publishedAt: z
    .string()
    .datetime()
    .optional()
    .transform(val => (val ? new Date(val) : null)),
});

// Schéma pour mettre à jour un blog
export const updateBlogSchema = createBlogSchema.partial();

// Schéma pour créer un post de blog
export const createBlogPostSchema = z.object({
  title: nameSchema.max(255, "Le titre ne peut pas dépasser 255 caractères"),
  content: z
    .string()
    .min(10, "Le contenu doit contenir au moins 10 caractères"),
  excerpt: z
    .string()
    .max(500, "L'extrait ne peut pas dépasser 500 caractères")
    .optional(),
  slug: z
    .string()
    .min(3, "Le slug doit contenir au moins 3 caractères")
    .max(255, "Le slug ne peut pas dépasser 255 caractères")
    .regex(
      /^[a-z0-9-]+$/,
      "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets"
    ),
  blogId: idSchema,
  isPublished: z.boolean().default(false),
  publishedAt: z
    .string()
    .datetime()
    .optional()
    .transform(val => (val ? new Date(val) : null)),
});

// Schéma pour mettre à jour un post de blog
export const updateBlogPostSchema = createBlogPostSchema
  .partial()
  .omit({ blogId: true });

// Schéma pour la pagination des blogs
export const blogPaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(10),
  search: z.string().optional(),
  authorId: idSchema.optional(),
  isPublished: z.boolean().optional(),
  sortBy: z
    .enum(["title", "createdAt", "updatedAt", "publishedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Schéma pour la pagination des posts
export const postPaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(50).default(10),
  search: z.string().optional(),
  blogId: idSchema.optional(),
  authorId: idSchema.optional(),
  isPublished: z.boolean().optional(),
  sortBy: z
    .enum(["title", "createdAt", "updatedAt", "publishedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Types dérivés des schémas
export type CreateBlogData = z.infer<typeof createBlogSchema>;
export type UpdateBlogData = z.infer<typeof updateBlogSchema>;
export type CreateBlogPostData = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostData = z.infer<typeof updateBlogPostSchema>;
export type BlogPaginationData = z.infer<typeof blogPaginationSchema>;
export type PostPaginationData = z.infer<typeof postPaginationSchema>;
