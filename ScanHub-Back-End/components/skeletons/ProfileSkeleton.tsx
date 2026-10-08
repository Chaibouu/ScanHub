import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* En-tête du profil */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-8 rounded-lg">
        <div className="flex items-center space-x-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-64 mb-2" />
            <div className="flex items-center space-x-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>

      {/* Statistiques du profil */}
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-8 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 