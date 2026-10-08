import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full mx-auto px-4">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            {/* Icône 404 */}
            <div className="mb-8">
              <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-12 h-12 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                Page introuvable
              </h2>
            </div>

            {/* Message d'erreur */}
            <div className="mb-8">
              <p className="text-gray-600 mb-4">
                Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
              </p>
              <p className="text-sm text-gray-500">
                Vérifiez l'URL ou utilisez les liens ci-dessous pour naviguer.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Link href="/" className="block">
                <Button className="w-full">
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Retour à l'accueil
                </Button>
              </Link>
              
              <div className="flex gap-3">
                <Link href="/blogs" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                      />
                    </svg>
                    Blogs
                  </Button>
                </Link>
                
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Dashboard
                  </Button>
                </Link>
              </div>
            </div>

            {/* Informations supplémentaires */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Si vous pensez qu'il s'agit d'une erreur, contactez notre support.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 