import { Suspense } from "react";
import { getBlogsAction } from "@/actions/blog-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlogsGridSkeleton } from "@/components/skeletons";
import Link from "next/link";
import type { Blog } from "@/types/blog";

async function BlogsListContent() {
  const searchParams = new URLSearchParams();
  const blogsData = await getBlogsAction(searchParams);

  if (!blogsData.success) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {blogsData.error}</p>
      </div>
    );
  }

  // Vérifier que les données existent et ont la bonne structure
  if (!blogsData.data || !Array.isArray(blogsData.data.data)) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Format de données invalide</p>
      </div>
    );
  }

  const { data: blogs, pagination } = blogsData.data;

  if (blogs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucun blog trouvé
          </h3>
          <p className="text-gray-600 mb-6">
            Commencez par créer votre premier blog pour partager vos idées.
          </p>
          <Link href="/blogs/create">
            <Button>Créer votre premier blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogs.map((blog: Blog) => (
          <Card key={blog.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2">
                    <Link 
                      href={`/blogs/${blog.id}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {blog.title}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Par {blog.author.name || blog.author.email || 'Auteur inconnu'}
                  </p>
                </div>
                <Badge variant={blog.isPublished ? "default" : "secondary"}>
                  {blog.isPublished ? "Publié" : "Brouillon"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {blog.description && (
                <p className="text-gray-700 mb-3 line-clamp-3">
                  {blog.description}
                </p>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>{blog._count.posts} posts</span>
                <span>
                  {new Date(blog.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/blogs/${blog.id}`}>
                  <Button variant="outline" size="sm">
                    Voir
                  </Button>
                </Link>
                <Link href={`/blogs/${blog.id}/edit`}>
                  <Button variant="outline" size="sm">
                    Modifier
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          {pagination.hasPrev && (
            <Link href={`/blogs?page=${pagination.page - 1}`}>
              <Button variant="outline" size="sm">
                Précédent
              </Button>
            </Link>
          )}
          <span className="text-sm text-gray-600">
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          {pagination.hasNext && (
            <Link href={`/blogs?page=${pagination.page + 1}`}>
              <Button variant="outline" size="sm">
                Suivant
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function BlogsList() {
  return (
    <Suspense fallback={<BlogsGridSkeleton />}>
      <BlogsListContent />
    </Suspense>
  );
} 