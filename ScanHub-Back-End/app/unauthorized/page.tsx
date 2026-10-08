import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full mx-auto px-4">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            <div className="mx-auto w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-12 h-12 text-amber-600" />
            </div>
            <h1 className="text-6xl font-bold text-gray-900 mb-2">403</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Accès refusé</h2>
            <p className="text-gray-600 mb-8">
              Votre rôle ne vous permet pas d'accéder à cette page. Contactez un
              administrateur si vous pensez qu'il s'agit d'une erreur.
            </p>
            <Link href="/dashboard">
              <Button>Retour au tableau de bord</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
