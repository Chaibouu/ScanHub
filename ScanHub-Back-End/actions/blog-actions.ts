"use server";

import { db } from "@/lib/db";
import {
  withErrorHandling,
  withValidation,
  withAuth,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createPaginatedResponse,
} from "@/lib/response-utils";
import {
  createBlogSchema,
  updateBlogSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  blogPaginationSchema,
  postPaginationSchema,
  type CreateBlogData,
  type UpdateBlogData,
  type CreateBlogPostData,
  type UpdateBlogPostData,
  type BlogPaginationData,
  type PostPaginationData,
} from "@/schemas/blog";
import { getAuthenticatedUser } from "@/lib/auth-utils";

// ===== BLOG ACTIONS =====

// Créer un blog
export async function createBlogAction(formData: FormData) {
  return withErrorHandling(async () => {
    return withValidation(
      createBlogSchema,
      Object.fromEntries(formData.entries()),
      async (validatedData: CreateBlogData) => {
        const { userId } = await getAuthenticatedUser();

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
      }
    );
  });
}

// Récupérer tous les blogs (avec pagination)
export async function getBlogsAction(searchParams: URLSearchParams) {
  return withErrorHandling(async () => {
    const paginationData = blogPaginationSchema.parse({
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10"),
      search: searchParams.get("search") || undefined,
      authorId: searchParams.get("authorId") || undefined,
      isPublished: searchParams.get("isPublished")
        ? searchParams.get("isPublished") === "true"
        : undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const { page, limit, search, authorId, isPublished, sortBy, sortOrder } =
      paginationData;

    // Construire les conditions de recherche
    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    // Compter le total
    const total = await db.blog.count({ where });

    // Récupérer les blogs
    const blogs = await db.blog.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return createPaginatedResponse(blogs, page, limit, total);
  });
}

// Récupérer un blog par ID
export async function getBlogAction(blogId: string) {
  return withErrorHandling(async () => {
    const blog = await db.blog.findFirst({
      where: {
        id: blogId,
        isDeleted: false,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        posts: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            author: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    if (!blog) {
      return createNotFoundResponse("Blog");
    }

    return createSuccessResponse(blog);
  });
}

// Mettre à jour un blog
export async function updateBlogAction(blogId: string, formData: FormData) {
  return withErrorHandling(async () => {
    return withValidation(
      updateBlogSchema,
      Object.fromEntries(formData.entries()),
      async (validatedData: UpdateBlogData) => {
        const { userId } = await getAuthenticatedUser();

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

        return createSuccessResponse(
          updatedBlog,
          "Blog mis à jour avec succès"
        );
      }
    );
  });
}

// Supprimer un blog (soft delete)
export async function deleteBlogAction(blogId: string) {
  return withErrorHandling(async () => {
    const { userId } = await getAuthenticatedUser();

    const blog = await db.blog.findFirst({
      where: {
        id: blogId,
        authorId: userId,
        isDeleted: false,
      },
    });

    if (!blog) {
      return createNotFoundResponse("Blog");
    }

    await db.blog.update({
      where: { id: blogId },
      data: { isDeleted: true },
    });

    return createSuccessResponse(null, "Blog supprimé avec succès");
  });
}

// ===== BLOG POST ACTIONS =====

// Créer un post de blog
export async function createBlogPostAction(formData: FormData) {
  return withErrorHandling(async () => {
    return withValidation(
      createBlogPostSchema,
      Object.fromEntries(formData.entries()),
      async (validatedData: CreateBlogPostData) => {
        const { userId } = await getAuthenticatedUser();

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
      }
    );
  });
}

// Récupérer tous les posts (avec pagination)
export async function getBlogPostsAction(searchParams: URLSearchParams) {
  return withErrorHandling(async () => {
    const paginationData = postPaginationSchema.parse({
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10"),
      search: searchParams.get("search") || undefined,
      blogId: searchParams.get("blogId") || undefined,
      authorId: searchParams.get("authorId") || undefined,
      isPublished: searchParams.get("isPublished")
        ? searchParams.get("isPublished") === "true"
        : undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const {
      page,
      limit,
      search,
      blogId,
      authorId,
      isPublished,
      sortBy,
      sortOrder,
    } = paginationData;

    // Construire les conditions de recherche
    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }

    if (blogId) {
      where.blogId = blogId;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    // Compter le total
    const total = await db.blogPost.count({ where });

    // Récupérer les posts
    const posts = await db.blogPost.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        blog: {
          select: { id: true, title: true, slug: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return createPaginatedResponse(posts, page, limit, total);
  });
}

// Récupérer un post par ID
export async function getBlogPostAction(postId: string) {
  return withErrorHandling(async () => {
    const post = await db.blogPost.findFirst({
      where: {
        id: postId,
        isDeleted: false,
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

    if (!post) {
      return createNotFoundResponse("Post");
    }

    return createSuccessResponse(post);
  });
}

// Mettre à jour un post de blog
export async function updateBlogPostAction(postId: string, formData: FormData) {
  return withErrorHandling(async () => {
    return withValidation(
      updateBlogPostSchema,
      Object.fromEntries(formData.entries()),
      async (validatedData: UpdateBlogPostData) => {
        const { userId } = await getAuthenticatedUser();

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

        return createSuccessResponse(
          updatedPost,
          "Post mis à jour avec succès"
        );
      }
    );
  });
}

// Supprimer un post (soft delete)
export async function deleteBlogPostAction(postId: string) {
  return withErrorHandling(async () => {
    const { userId } = await getAuthenticatedUser();

    const post = await db.blogPost.findFirst({
      where: {
        id: postId,
        authorId: userId,
        isDeleted: false,
      },
    });

    if (!post) {
      return createNotFoundResponse("Post");
    }

    await db.blogPost.update({
      where: { id: postId },
      data: { isDeleted: true },
    });

    return createSuccessResponse(null, "Post supprimé avec succès");
  });
}
