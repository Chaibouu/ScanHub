"use server";

import { db } from "@/lib/db";
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  type ActionResponse,
} from "@/lib/response-utils";
import {
  createBlogSchema,
  updateBlogSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  type CreateBlogData,
  type UpdateBlogData,
  type CreateBlogPostData,
  type UpdateBlogPostData,
} from "@/schemas/blog";
import { getAuthenticatedUser } from "@/lib/auth-utils";

// ===== BLOG FORM ACTIONS (pour useActionState) =====

// Créer un blog - version compatible useActionState
export async function createBlogFormAction(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Validation
    const validatedFields = createBlogSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      slug: formData.get("slug"),
      isPublished: formData.get("isPublished") === "on",
    });

    if (!validatedFields.success) {
      const errors: Record<string, string> = {};
      validatedFields.error.errors.forEach(err => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });

      return createValidationErrorResponse(errors);
    }

    const { userId } = await getAuthenticatedUser();
    const validatedData = validatedFields.data;

    // Vérifier si le slug existe déjà
    const existingBlog = await db.blog.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingBlog) {
      return createErrorResponse("Un blog avec ce slug existe déjà");
    }

    // Gérer publishedAt
    const blogData = { ...validatedData };
    if (validatedData.isPublished && !validatedData.publishedAt) {
      blogData.publishedAt = new Date();
    } else if (!validatedData.isPublished) {
      blogData.publishedAt = null;
    }

    const blog = await db.blog.create({
      data: {
        ...blogData,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return createSuccessResponse(blog, "Blog créé avec succès");
  } catch (error) {
    console.error("Erreur createBlogFormAction:", error);
    return createErrorResponse("Erreur lors de la création du blog");
  }
}

// Mettre à jour un blog - version compatible useActionState
export async function updateBlogFormAction(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const blogId = formData.get("blogId") as string;
    if (!blogId) {
      return createErrorResponse("ID du blog manquant");
    }

    // Validation
    const validatedFields = updateBlogSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      slug: formData.get("slug"),
      isPublished: formData.get("isPublished") === "on",
    });

    if (!validatedFields.success) {
      const errors: Record<string, string> = {};
      validatedFields.error.errors.forEach(err => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });

      return createValidationErrorResponse(errors);
    }

    const { userId } = await getAuthenticatedUser();
    const validatedData = validatedFields.data;

    // Vérifier que le blog existe et appartient à l'utilisateur
    const existingBlog = await db.blog.findFirst({
      where: {
        id: blogId,
        authorId: userId,
        isDeleted: false,
      },
    });

    if (!existingBlog) {
      return createNotFoundResponse("Blog");
    }

    // Vérifier si le nouveau slug existe déjà (si fourni)
    if (validatedData.slug && validatedData.slug !== existingBlog.slug) {
      const slugExists = await db.blog.findUnique({
        where: { slug: validatedData.slug },
      });

      if (slugExists) {
        return createErrorResponse("Un blog avec ce slug existe déjà");
      }
    }

    // Gérer publishedAt
    const updateData = { ...validatedData };
    if (validatedData.isPublished && !existingBlog.isPublished) {
      updateData.publishedAt = new Date();
    } else if (!validatedData.isPublished && existingBlog.isPublished) {
      updateData.publishedAt = null;
    }

    const updatedBlog = await db.blog.update({
      where: { id: blogId },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return createSuccessResponse(updatedBlog, "Blog mis à jour avec succès");
  } catch (error) {
    console.error("Erreur updateBlogFormAction:", error);
    return createErrorResponse("Erreur lors de la mise à jour du blog");
  }
}

// Créer un post de blog - version compatible useActionState
export async function createBlogPostFormAction(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    // Validation
    const validatedFields = createBlogPostSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      excerpt: formData.get("excerpt"),
      slug: formData.get("slug"),
      blogId: formData.get("blogId"),
      isPublished: formData.get("isPublished") === "on",
    });

    if (!validatedFields.success) {
      const errors: Record<string, string> = {};
      validatedFields.error.errors.forEach(err => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });

      return createValidationErrorResponse(errors);
    }

    const { userId } = await getAuthenticatedUser();
    const validatedData = validatedFields.data;

    // Vérifier que le blog existe et appartient à l'utilisateur
    const blog = await db.blog.findFirst({
      where: {
        id: validatedData.blogId,
        authorId: userId,
        isDeleted: false,
      },
    });

    if (!blog) {
      return createNotFoundResponse("Blog");
    }

    // Vérifier si le slug existe déjà
    const existingPost = await db.blogPost.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingPost) {
      return createErrorResponse("Un post avec ce slug existe déjà");
    }

    const post = await db.blogPost.create({
      data: {
        ...validatedData,
        authorId: userId,
        publishedAt: validatedData.isPublished ? new Date() : null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        blog: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    return createSuccessResponse(post, "Post créé avec succès");
  } catch (error) {
    console.error("Erreur createBlogPostFormAction:", error);
    return createErrorResponse("Erreur lors de la création du post");
  }
}

// Mettre à jour un post de blog - version compatible useActionState
export async function updateBlogPostFormAction(
  prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const postId = formData.get("postId") as string;
    if (!postId) {
      return createErrorResponse("ID du post manquant");
    }

    // Validation
    const validatedFields = updateBlogPostSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
      excerpt: formData.get("excerpt"),
      slug: formData.get("slug"),
      isPublished: formData.get("isPublished") === "on",
    });

    if (!validatedFields.success) {
      const errors: Record<string, string> = {};
      validatedFields.error.errors.forEach(err => {
        const field = err.path.join(".");
        errors[field] = err.message;
      });

      return createValidationErrorResponse(errors);
    }

    const { userId } = await getAuthenticatedUser();
    const validatedData = validatedFields.data;

    // Vérifier que le post existe et appartient à l'utilisateur
    const existingPost = await db.blogPost.findFirst({
      where: {
        id: postId,
        authorId: userId,
        isDeleted: false,
      },
    });

    if (!existingPost) {
      return createNotFoundResponse("Post");
    }

    // Vérifier si le nouveau slug existe déjà (si fourni)
    if (validatedData.slug && validatedData.slug !== existingPost.slug) {
      const slugExists = await db.blogPost.findUnique({
        where: { slug: validatedData.slug },
      });

      if (slugExists) {
        return createErrorResponse("Un post avec ce slug existe déjà");
      }
    }

    // Gérer la publication
    const updateData = { ...validatedData };
    if (validatedData.isPublished && !existingPost.isPublished) {
      updateData.publishedAt = new Date();
    } else if (!validatedData.isPublished && existingPost.isPublished) {
      updateData.publishedAt = null;
    }

    const updatedPost = await db.blogPost.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        blog: {
          select: { id: true, title: true, slug: true },
        },
      },
    });

    return createSuccessResponse(updatedPost, "Post mis à jour avec succès");
  } catch (error) {
    console.error("Erreur updateBlogPostFormAction:", error);
    return createErrorResponse("Erreur lors de la mise à jour du post");
  }
}
