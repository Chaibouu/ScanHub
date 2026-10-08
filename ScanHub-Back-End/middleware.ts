import {
  DEFAULT_LOGIN_REDIRECT,
  apiAuthPrefix,
  authRoutes,
  publicRoutes,
  publicApiRoutes,
} from "@/routes";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUser } from "./actions/getUser";
import { applyRateLimit } from "./lib/rateLimit";
import { isRouteProtected } from "./utils/is-route-protected";

// ─── CSP Nonce ────────────────────────────────────────────────────────────────
/**
 * Génère un nonce cryptographiquement aléatoire par requête.
 * Le nonce est transmis :
 *   - En header de requête (x-nonce) → lu par RootLayout pour les balises <Script>
 *   - En header de réponse (Content-Security-Policy) → envoyé au navigateur
 *
 * Cela permet de supprimer 'unsafe-inline' de script-src tout en
 * autorisant les scripts inline de Next.js (qui reçoivent le nonce).
 */
function buildCspWithNonce(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";

  // En dev, Next.js/Turbopack utilise eval() et des scripts inline pour le HMR.
  // On doit donc autoriser 'unsafe-eval' et 'unsafe-inline' (sans 'strict-dynamic'
  // ni nonce qui casseraient le HMR).
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
    "font-src 'self' data:",
    isDev ? "connect-src 'self' ws: wss: http: https:" : "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  return directives.join("; ");
}

// ─── Middleware principal ─────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;

  try {
    const isApiRoute = nextUrl.pathname.startsWith("/api");
    const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
    const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
    const isAuthRoute = authRoutes.includes(nextUrl.pathname);

    // ─── Nonce CSP — généré pour chaque requête HTML ───────────────────────
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCspWithNonce(nonce);

    // ─── Preflight CORS pour les routes API ────────────────────────────────
    if (isApiRoute && req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-device-key",
        },
      });
    }

    // ─── Rate limiting (in-memory) sur les routes d'auth ──────────────────
    if (isApiAuthRoute) {
      const rateLimitResponse = await applyRateLimit(req);
      if (rateLimitResponse) return rateLimitResponse;
      return NextResponse.next();
    }

    // ─── Routes API ────────────────────────────────────────────────────────
    if (isApiRoute) {
      const isPublicApi = publicApiRoutes.includes(nextUrl.pathname);
      const isIntegrationRoute = nextUrl.pathname.startsWith("/api/v1/integrations");

      if (isIntegrationRoute) {
        const apiKey = req.headers.get("x-api-key");
        if (!apiKey) {
          return NextResponse.json(
            { error: "En-tête x-api-key manquant pour l'API partenaire" },
            { status: 401 }
          );
        }
        return NextResponse.next();
      }

      // Premier filtre uniquement (présence d'un identifiant) : le middleware tourne en
      // Edge Runtime et ne peut pas vérifier le JWT. La vérification réelle (signature,
      // session, rôle) est faite dans chaque route via authService / authorizeUser.
      if (!isPublicRoute && !isPublicApi) {
        const authorizationHeader = req.headers.get("Authorization");
        const accessToken =
          authorizationHeader?.split(" ")[1] ?? req.cookies.get("accessToken")?.value;
        if (!accessToken) {
          return NextResponse.json(
            { error: "Token d'accès manquant ou non valide" },
            { status: 401 }
          );
        }
      }
      return NextResponse.next();
    }

    // ─── Routes Frontend ───────────────────────────────────────────────────
    // Transmettre le nonce en header de requête pour que le RootLayout puisse le lire
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);

    const result = await getUser();

    // Rafraîchissement du token d'accès si nécessaire
    if (result?.tokenInfo) {
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.cookies.set({
        name: "accessToken",
        value: result.tokenInfo.accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: result.tokenInfo.expiresAt,
        path: "/",
        sameSite: "lax",
      });
      response.headers.set("Content-Security-Policy", csp);
      response.headers.set("x-nonce", nonce);
      return response;
    }

    const isLoggedIn = !!result?.user && !result.error;
    const userRole = result?.user?.user?.role;
    const protectedRoute = isRouteProtected(userRole, nextUrl.pathname);

    if (isLoggedIn && protectedRoute && nextUrl.pathname !== "/unauthorized") {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl));
    }

    if (isAuthRoute && isLoggedIn) {
      return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }

    if (!isPublicRoute && !isAuthRoute && !isLoggedIn) {
      const callbackUrl = nextUrl.search
        ? `${nextUrl.pathname}${nextUrl.search}`
        : nextUrl.pathname;
      return NextResponse.redirect(
        new URL(
          `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          nextUrl
        )
      );
    }

    // Injecter x-nonce dans la requête transmise à l'app
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("x-nonce", nonce);
    return response;
  } catch (error) {
    console.error("Erreur dans le middleware:", error);
    return NextResponse.redirect(new URL("/auth/login", nextUrl));
  }
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
