"use client";

import { useActionState } from "react";
import { createBlogFormAction } from "@/actions/blog-form-actions";
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

export function BlogForm() {
  const [state, formAction, isPending] = useActionState(createBlogFormAction, initialState);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Créer un nouveau blog</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder="Titre du blog"
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
            {isPending ? "Création..." : "Créer le blog"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
} 