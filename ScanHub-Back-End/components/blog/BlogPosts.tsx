import { Suspense } from "react";
import { getBlogPostsAction } from "@/actions/blog-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostsListSkeleton } from "@/components/skeletons";
import Link from "next/link";
import type { BlogPost } from "@/types/blog";

interface BlogPostsProps {
  blogId: string;
}

async function BlogPostsList({ blogId }: BlogPostsProps) {
  const searchParams = new URLSearchParams();
  searchParams.set("blogId", blogId);
  searchParams.set("isPublished", "true");
  
  const postsData = await getBlogPostsAction(searchParams);


  if (!postsData.success) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {postsData.error}</p>
      </div>
    );
  }

  // Vérifier que les données existent et ont la bonne structure
  if (!postsData.data || !Array.isArray(postsData.data.data)) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Aucun post publié pour le moment.</p>
      </div>
    );
  }

  const { data: posts, pagination } = postsData.data;

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Aucun post publié pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Posts récents</h2>
        <Link href={`/blogs/${blogId}/posts/create`}>
          <Button size="sm">Nouveau post</Button>
        </Link>
      </div>
      
      <div className="grid gap-4">
        {posts.map((post: BlogPost) => (
          <Card key={post.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    <Link 
                      href={`/blogs/${blogId}/posts/${post.id}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {post.title}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Par {post.author.name || post.author.email || 'Auteur inconnu'}
                  </p>
                </div>
                <Badge variant={post.isPublished ? "default" : "secondary"}>
                  {post.isPublished ? "Publié" : "Brouillon"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {post.excerpt && (
                <p className="text-gray-700 mb-3">{post.excerpt}</p>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>
                  {post.publishedAt 
                    ? new Date(post.publishedAt).toLocaleDateString()
                    : new Date(post.createdAt).toLocaleDateString()
                  }
                </span>
                <div className="flex gap-2">
                  <Link href={`/blogs/${blogId}/posts/${post.id}`}>
                    <Button variant="outline" size="sm">
                      Lire
                    </Button>
                  </Link>
                  <Link href={`/blogs/${blogId}/posts/${post.id}/edit`}>
                    <Button variant="outline" size="sm">
                      Modifier
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Pagination pour les posts */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          {pagination.hasPrev && (
            <Link href={`/blogs/${blogId}?page=${pagination.page - 1}`}>
              <Button variant="outline" size="sm">
                Précédent
              </Button>
            </Link>
          )}
          <span className="text-sm text-gray-600">
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          {pagination.hasNext && (
            <Link href={`/blogs/${blogId}?page=${pagination.page + 1}`}>
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

export function BlogPosts({ blogId }: BlogPostsProps) {
  return (
    <Suspense fallback={<PostsListSkeleton />}>
      <BlogPostsList blogId={blogId} />
    </Suspense>
  );
} 