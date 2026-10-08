import { notFound } from "next/navigation";
import { getBlogAction } from "@/actions/blog-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostsListSkeleton } from "@/components/skeletons";
import { BlogPosts } from "@/components/blog/BlogPosts";
import Link from "next/link";
import type { Blog } from "@/types/blog";

interface BlogDetailProps {
  blogId: string;
}

export async function BlogDetail({ blogId }: BlogDetailProps) {
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

  // Vérifier que les données existent
  if (!blogData.data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Données du blog non disponibles</p>
      </div>
    );
  }

  const blog: Blog = blogData.data.data;

  return (
    <div className="space-y-8">
      {/* En-tête du blog */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {blog.title}
            </h1>
            {blog.description && (
              <p className="text-lg text-gray-700 mb-4 max-w-3xl">
                {blog.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Par {blog.author.name || blog.author.email}</span>
              <span>•</span>
              <span>{blog._count.posts} posts</span>
              <span>•</span>
              <span>Créé le {new Date(blog.createdAt).toLocaleDateString()}</span>
              {blog.publishedAt && (
                <>
                  <span>•</span>
                  <span>Publié le {new Date(blog.publishedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={blog.isPublished ? "default" : "secondary"}>
              {blog.isPublished ? "Publié" : "Brouillon"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link href={`/blogs/${blogId}/edit`}>
          <Button>Modifier le blog</Button>
        </Link>
        <Link href={`/blogs/${blogId}/posts/create`}>
          <Button variant="outline">Nouveau post</Button>
        </Link>
        <Link href="/blogs">
          <Button variant="outline">Retour aux blogs</Button>
        </Link>
      </div>

      {/* Posts du blog */}
      <BlogPosts blogId={blogId} />
    </div>
  );
} 