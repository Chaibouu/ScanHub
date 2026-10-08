// Types pour les données de blog
export interface Blog {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  isDeleted: boolean;
  author: {
    id: string;
    name: string | null;
    email: string | null;
  };
  _count: {
    posts: number;
  };
}

// Types pour les données de post
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  blogId: string;
  isDeleted: boolean;
  author: {
    id: string;
    name: string | null;
    email: string | null;
  };
  blog: {
    id: string;
    title: string;
    slug: string;
  };
}

// Types pour les réponses paginées
export interface PaginatedResponse<T> {
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

// Types pour les réponses d'action
export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Types spécifiques pour les réponses
export type BlogResponse = ActionResponse<Blog>;
export type BlogListResponse = ActionResponse<PaginatedResponse<Blog>>;
export type BlogPostResponse = ActionResponse<BlogPost>;
export type BlogPostListResponse = ActionResponse<PaginatedResponse<BlogPost>>;
