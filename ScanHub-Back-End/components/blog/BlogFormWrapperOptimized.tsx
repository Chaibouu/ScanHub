import { Suspense, use } from "react";
import { getBlogAction } from "@/actions/blog-actions";
import { BlogForm } from "./BlogForm";
import { BlogFormEdit } from "./BlogFormEdit";
import { Card, CardContent } from "@/components/ui/card";
import type { Blog } from "@/types/blog";

interface BlogFormWrapperProps {
  blogId?: string;
  mode: "create" | "edit";
}

// Composant optimisé avec use hook
function BlogFormWithData({ blogId, mode }: BlogFormWrapperProps) {
  if (mode === "create") {
    return <BlogForm />;
  }

  if (!blogId) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">ID du blog manquant</p>
      </div>
    );
  }

  // Utilisation du hook use pour une meilleure performance
  const blogData = use(getBlogAction(blogId));

  if (!blogData.success) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {blogData.error}</p>
      </div>
    );
  }

  if (!blogData.data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Blog non trouvé</p>
      </div>
    );
  }

  const blog = blogData.data.data;

  return <BlogFormEdit blogId={blogId} initialData={blog} />;
}

// Skeleton optimisé
function BlogFormSkeleton() {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BlogFormWrapperOptimized({ blogId, mode }: BlogFormWrapperProps) {
  return (
    <Suspense fallback={<BlogFormSkeleton />}>
      <BlogFormWithData blogId={blogId} mode={mode} />
    </Suspense>
  );
} 