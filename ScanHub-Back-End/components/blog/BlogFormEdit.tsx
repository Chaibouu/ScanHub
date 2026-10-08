"use client";

import { useActionState } from "react";
import { updateBlogFormAction } from "@/actions/blog-form-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { Blog } from "@/types/blog";

interface BlogFormEditProps {
  blogId: string;
  initialData?: Blog;
}

// État initial compatible avec useActionState
const initialState = {
  success: undefined,
  error: undefined,
  data: undefined,
  errors: undefined,
};

export function BlogFormEdit({ blogId, initialData }: BlogFormEditProps) {
  const [state, formAction, isPending] = useActionState(updateBlogFormAction, initialState);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    slug: initialData?.slug || "",
    isPublished: initialData?.isPublished || false,
  });

  // Mettre à jour le formulaire quand les données initiales changent
  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description || "",
        slug: initialData.slug,
        isPublished: initialData.isPublished,
      });
    }
  }, [initialData]);

  const handleSubmit = (formData: FormData) => {
    // Ajouter le blogId au FormData
    formData.append("blogId", blogId);
    formAction(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Modifier le blog</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="Titre du blog"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
            {state.errors?.title && (
              <p className="text-red-500 text-sm">{state.errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              placeholder="Description du blog"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {state.errors?.description && (
              <p className="text-red-500 text-sm">{state.errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="mon-blog"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              required
            />
            {state.errors?.slug && (
              <p className="text-red-500 text-sm">{state.errors.slug}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              id="isPublished" 
              name="isPublished"
              checked={formData.isPublished}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublished: checked }))}
            />
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
            {isPending ? "Modification..." : "Modifier le blog"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 