import { Suspense } from "react";
import { BlogsList } from "@/components/blog/BlogsList";
import { BlogsGridSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Page principale des blogs
export default function BlogsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mes Blogs
          </h1>
          <p className="text-gray-600 mb-4">
            Gérez vos blogs et partagez vos idées avec le monde
          </p>
          <Link href="/blogs/create">
            <Button>Créer un nouveau blog</Button>
          </Link>
        </div>
      </div>
      
      <Suspense fallback={<BlogsGridSkeleton />}>
        <BlogsList />
      </Suspense>
    </div>
  );
} 