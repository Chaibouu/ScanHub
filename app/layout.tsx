import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/context/SessionContext";
import { getUser } from "@/actions/getUser";
import { generateMetadata as generateAppMetadata } from "@/lib/generateMetadata";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import NextTopLoader from 'nextjs-toploader';
import appConfig from "@/settings";
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

// Utiliser la nouvelle API de métadonnées de Next.js 15
export async function generateMetadata() {
  return await generateAppMetadata();
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null;
  let isImpersonation = false;

  try {
    const result = await getUser();
    user = result?.user;
    isImpersonation = result?.isImpersonation ?? false;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'utilisateur:", error);
  }

  // Lire le nonce CSP injecté par le middleware
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <SessionProvider user={user?.user} isImpersonation={isImpersonation}>
            <NextTopLoader
              color={appConfig.primaryColor}
              showSpinner={false}
              nonce={nonce}
            />
              {children}
              <Toaster />
            </SessionProvider>
          </Suspense>
        </ErrorBoundary>
      </body>
    </html>
  );
}
