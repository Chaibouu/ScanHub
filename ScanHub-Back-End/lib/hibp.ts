/**
 * HaveIBeenPwned — vérification de compromission de mot de passe
 *
 * Utilise l'API HIBP avec k-anonymity :
 *   - Seuls les 5 premiers caractères du hash SHA-1 sont envoyés à l'API
 *   - Le mot de passe en clair ne quitte JAMAIS le serveur
 *   - HIBP renvoie tous les hashs commençant par ce préfixe
 *   - On vérifie localement si le suffixe correspond
 *
 * Si l'API est indisponible → fail open (ne bloque pas l'inscription).
 *
 * Usage :
 *   const { pwned, count } = await checkPasswordPwned(password);
 *   if (pwned) return { error: `Ce mot de passe a été compromis ${count} fois.` };
 */

import crypto from "crypto";
import { logger } from "./logger";

interface HibpResult {
  pwned: boolean;
  count: number;
}

export async function checkPasswordPwned(password: string): Promise<HibpResult> {
  try {
    // SHA-1 du mot de passe (HIBP l'exige — k-anonymity fonctionne avec SHA-1)
    const hash = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex")
      .toUpperCase();

    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          "Add-Padding": "true",   // Padding pour rendre les réponses indiscernables par taille
          "User-Agent": "scanhub-security-check",
        },
        // Pas de cache — vérification temps réel
        cache: "no-store",
      }
    );

    if (!response.ok) {
      logger.warn({ status: response.status }, "HIBP API indisponible — fail open");
      return { pwned: false, count: 0 };
    }

    const text = await response.text();

    // Chaque ligne : "SUFFIXE:COUNT"
    const match = text
      .split("\n")
      .find((line) => line.trimEnd().startsWith(suffix));

    if (!match) return { pwned: false, count: 0 };

    const count = parseInt(match.split(":")[1].trim(), 10);
    return { pwned: count > 0, count };
  } catch (err) {
    // Fail open — ne jamais bloquer l'utilisateur à cause d'une erreur réseau
    logger.error({ err }, "Erreur lors de la vérification HIBP — fail open");
    return { pwned: false, count: 0 };
  }
}
