import { NextRequest } from "next/server";

// Interface pour les informations de géolocalisation
export interface GeoInfo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

// Fonction pour extraire l'IP de manière compatible avec tous les hébergeurs
export function getClientIP(req: NextRequest): string {
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip", // Cloudflare
    "x-forwarded",
    "forwarded-for",
    "forwarded"
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      const ip = value.split(",")[0].trim();
      if (ip && ip !== "unknown") {
        return ip;
      }
    }
  }

  return "127.0.0.1";
}

// Fonction pour obtenir les informations de géolocalisation
// Compatible avec tous les hébergeurs (VPS, Vercel, etc.)
export async function getGeoInfo(req: NextRequest): Promise<GeoInfo> {
  try {
    const ip = getClientIP(req);
    
    // Éviter les appels API pour les IPs locales
    if (ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return {
        country: "Local",
        city: "Development",
      };
    }

    // Utiliser une API gratuite pour la géolocalisation (HTTPS obligatoire)
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,timezone`);
    const data = await response.json();

    if (data.status === "success") {
      return {
        country: data.country,
        region: data.regionName,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
      };
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de la géolocalisation:", error);
  }

  return {};
}

// Fonction pour vérifier si l'IP est dans une liste de pays autorisés
export function isCountryAllowed(geoInfo: GeoInfo, allowedCountries: string[]): boolean {
  if (!allowedCountries.length) return true;
  if (!geoInfo.country) return true; // Si on ne peut pas déterminer le pays, autoriser
  
  return allowedCountries.includes(geoInfo.country);
}

// Fonction pour obtenir le fuseau horaire de l'utilisateur
export function getUserTimezone(geoInfo: GeoInfo): string {
  return geoInfo.timezone || "UTC";
} 