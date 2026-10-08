import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBlogAction } from "@/actions/blog-actions";
import { BlogPostForm } from "@/components/blog/BlogPostForm";
import { Card, CardContent } from "@/components/ui/card";

// Composant pour récupérer les informations du blog
async function BlogInfo({ blogId }: { blogId: string }) {
  const blogData = await getBlogAction(blogId);

  if (!blogData.success) {
    if (blogData.error?.includes("introuvable")) {
      notFound();
    }
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {blogData.error}</p>
      </div>
    );
  }

  const blog = blogData.data?.data;

  return (
    <div className="mb-8">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Créer un nouveau post
        </h1>
        <p className="text-gray-600">
          Ajoutez un nouveau post au blog "{blog?.title || 'Blog'}"
        </p>
      </div>
    </div>
  );
}

// Skeleton pour les informations du blog
function BlogInfoSkeleton() {
  return (
    <div className="mb-8">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
        <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-96"></div>
      </div>
    </div>
  );
}

// Page principale avec paramètres async (Next.js 15)
export default async function CreatePostPage({ 
  params 
}: { 
  params: Promise<{ blogId: string }> 
}) {
  const { blogId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<BlogInfoSkeleton />}>
        <BlogInfo blogId={blogId} />
      </Suspense>
      
      <BlogPostForm blogId={blogId} />
    </div>
  );
} 