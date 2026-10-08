import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBlogAction } from "@/actions/blog-actions";
import { BlogDetail } from "@/components/blog/BlogDetail";
import { PostsListSkeleton } from "@/components/skeletons";

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

  return (
    <div className="mb-8">
      <BlogDetail blogId={blogId} />
    </div>
  );
}

// Page principale avec paramètres async (Next.js 15)
export default async function BlogPage({ 
  params 
}: { 
  params: Promise<{ blogId: string }> 
}) {
  const { blogId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<PostsListSkeleton />}>
        <BlogInfo blogId={blogId} />
      </Suspense>
    </div>
  );
} 