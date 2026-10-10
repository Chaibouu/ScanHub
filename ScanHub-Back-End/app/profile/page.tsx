import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/actions/getUser";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getUser();
  const currentUser = session?.user?.user;

  if (!currentUser) {
    redirect("/auth/login");
  }

  const [scanCount, deviceCount, lastLogin] = await Promise.all([
    prisma.scan.count({ where: { userId: currentUser.id } }),
    prisma.device.count({ where: { userId: currentUser.id, activatedAt: { not: null } } }),
    prisma.auditLog.findFirst({
      where: { userId: currentUser.id, action: "LOGIN_SUCCESS" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const displayName = currentUser.name || currentUser.email || "Utilisateur";
  const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <Avatar className="h-20 w-20">
            {currentUser.image && <AvatarImage src={currentUser.image} alt={displayName} />}
            <AvatarFallback className="text-2xl">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
            <p className="text-gray-600">{currentUser.email}</p>
            <Badge variant="outline" className="mt-2">
              {currentUser.role}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contrôles effectués</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scanCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Terminaux activés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deviceCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Dernière connexion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {lastLogin
                ? lastLogin.createdAt.toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accès rapides</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button>Tableau de bord</Button>
          </Link>
          <Link href="/scans">
            <Button variant="outline">Journal des scans</Button>
          </Link>
          {isAdmin && (
            <Link href="/devices">
              <Button variant="outline">Terminaux mobiles</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
