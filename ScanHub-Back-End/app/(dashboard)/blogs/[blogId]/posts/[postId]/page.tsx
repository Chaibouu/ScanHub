import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBlogPostAction } from "@/actions/blog-actions";
import { getBlogAction } from "@/actions/blog-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostsListSkeleton } from "@/components/skeletons";
import Link from "next/link";
import type { BlogPost } from "@/types/blog";

interface PostDetailProps {
  postId: string;
  blogId: string;
}

async function PostDetail({ postId, blogId }: PostDetailProps) {
  const postData = await getBlogPostAction(postId);

  if (!postData.success) {
    if (postData.error?.includes("introuvable")) {
      notFound();
    }
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {postData.error}</p>
      </div>
    );
  }

  const post = postData.data?.data;

  // Vérifier que le post appartient au bon blog
  if (post && post.blogId !== blogId) {
    notFound();
  }

  // Récupérer les informations du blog
  const blogData = await getBlogAction(blogId);

  if (!blogData.success) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Erreur: {blogData.error}</p>
      </div>
    );
  }

  const blog = blogData.data?.data;

  return (
    <div className="space-y-8">
      {/* En-tête du post */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-8 rounded-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {post?.title}
            </h1>
            {post?.excerpt && (
              <p className="text-lg text-gray-700 mb-4 max-w-3xl">
                {post.excerpt}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Par {post?.author.name || post?.author.email || 'Auteur inconnu'}</span>
              <span>•</span>
              <span>Blog: {blog?.title || 'Blog'}</span>
              <span>•</span>
              <span>Créé le {post?.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Date inconnue'}</span>
              {post?.publishedAt && (
                <>
                  <span>•</span>
                  <span>Publié le {new Date(post.publishedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={post?.isPublished ? "default" : "secondary"}>
              {post?.isPublished ? "Publié" : "Brouillon"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link href={`/blogs/${blogId}/posts/${postId}/edit`}>
          <Button>Modifier le post</Button>
        </Link>
        <Link href={`/blogs/${blogId}`}>
          <Button variant="outline">Retour au blog</Button>
        </Link>
        <Link href="/blogs">
          <Button variant="outline">Retour aux blogs</Button>
        </Link>
      </div>

      {/* Contenu du post */}
      <Card>
        <CardContent className="p-8">
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap text-gray-800 font-sans">
              {post?.content}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Page principale avec paramètres async (Next.js 15)
export default async function PostPage({ 
  params 
}: { 
  params: Promise<{ blogId: string; postId: string }> 
}) {
  const { blogId, postId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<PostsListSkeleton />}>
        <PostDetail postId={postId} blogId={blogId} />
      </Suspense>
    </div>
  );
} 