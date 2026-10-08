"use client";

import { useActionState } from "react";
import { createBlogPostFormAction } from "@/actions/blog-form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// État initial compatible avec useActionState
const initialState = {
  success: undefined,
  error: undefined,
  data: undefined,
  errors: undefined,
};

interface BlogPostFormProps {
  blogId: string;
  blogTitle?: string;
}

export function BlogPostForm({ blogId, blogTitle }: BlogPostFormProps) {
  const [state, formAction, isPending] = useActionState(createBlogPostFormAction, initialState);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>
          {blogTitle ? `Nouveau post pour "${blogTitle}"` : "Créer un nouveau post"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {/* Champ caché pour l'ID du blog */}
          <input type="hidden" name="blogId" value={blogId} />
          
          <div className="space-y-2">
            <Label htmlFor="title">Titre du post</Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="Titre du post"
              required
            />
            {state.errors?.title && (
              <p className="text-red-500 text-sm">{state.errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Extrait</Label>
            <textarea
              id="excerpt"
              name="excerpt"
              placeholder="Court résumé du post (optionnel)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.errors?.excerpt && (
              <p className="text-red-500 text-sm">{state.errors.excerpt}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu</Label>
            <textarea
              id="content"
              name="content"
              placeholder="Contenu du post..."
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {state.errors?.content && (
              <p className="text-red-500 text-sm">{state.errors.content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="mon-post"
              required
            />
            {state.errors?.slug && (
              <p className="text-red-500 text-sm">{state.errors.slug}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="isPublished" name="isPublished" />
            <Label htmlFor="isPublished">Publier immédiatement</Label>
          </div>

          {state.error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
              {state.error}
            </div>
          )}

          {state.success && (
            <div className="text-green-500 text-sm bg-green-50 p-3 rounded">
              {state.success}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Création..." : "Créer le post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 