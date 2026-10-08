import { BlogFormWrapper } from "@/components/blog/BlogFormWrapper";

export default function CreateBlogPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Créer un nouveau blog
          </h1>
          <p className="text-gray-600">
            Créez votre nouveau blog et commencez à partager vos idées
          </p>
        </div>
      </div>
      
      <BlogFormWrapper mode="create" />
    </div>
  );
} 