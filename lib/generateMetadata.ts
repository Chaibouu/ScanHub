import appConfig from "@/settings";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  try {
    return {
      title: {
        default: appConfig.websiteTitle || "ScanHub",
        template: `%s | ${appConfig.websiteTitle || "ScanHub"}`,
      },
      description:
        appConfig.websiteDescription ||
        "Plateforme centralisée de scan et de vérification QR pour événements et partenaires",
      keywords: [
        "ScanHub",
        "QR Code",
        "scanner",
        "vérification",
        "billetterie",
        "badges",
        "contrôle d'accès",
      ],
      authors: [{ name: "ScanHub Team" }],
      creator: "ScanHub",
      publisher: "ScanHub",
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      metadataBase: new URL(
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      ),
      alternates: {
        canonical: "/",
      },
      openGraph: {
        type: "website",
        locale: "fr_FR",
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        title: appConfig.websiteTitle || "ScanHub",
        description:
          appConfig.websiteDescription ||
          "Plateforme centralisée de scan et de vérification QR",
        siteName: appConfig.appName || "ScanHub",
        images: appConfig.logoUrl
          ? [
              {
                url: `${process.env.NEXT_PUBLIC_APP_URL}${appConfig.logoUrl}`,
                width: 1200,
                height: 630,
                alt: "ScanHub Logo",
              },
            ]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title: appConfig.websiteTitle || "ScanHub",
        description:
          appConfig.websiteDescription ||
          "Plateforme centralisée de scan et de vérification QR",
        images: appConfig.logoUrl
          ? [`${process.env.NEXT_PUBLIC_APP_URL}${appConfig.logoUrl}`]
          : [],
        creator: "@scanhub",
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      verification: {
        google: process.env.GOOGLE_VERIFICATION,
        yandex: process.env.YANDEX_VERIFICATION,
        yahoo: process.env.YAHOO_VERIFICATION,
      },
    };
  } catch (error) {
    console.error("Erreur lors de la génération des métadonnées:", error);

    return {
      title: "ScanHub",
      description: "Plateforme centralisée de scan et de vérification QR",
    };
  }
}
