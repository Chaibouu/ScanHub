/**
 * Utilitaires pour la gestion des uploads de fichiers
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";

export interface UploadOptions {
  maxSize?: number;       // Taille maximale en bytes
  allowedTypes?: string[]; // Types MIME autorisés
  destination?: string;   // Dossier de destination
}

export interface UploadResult {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_DESTINATION = "public/uploads";

// ─── Magic Numbers ────────────────────────────────────────────────────────────
// Signatures binaires des types de fichiers autorisés.
// Cela empêche un attaquant de renommer un .exe en .jpg pour contourner
// la validation basée uniquement sur le Content-Type ou l'extension.

interface MagicEntry {
  bytes: number[];
  offset?: number; // Offset dans le fichier (défaut : 0)
}

const MAGIC_SIGNATURES: Record<string, MagicEntry[]> = {
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
  "image/png":  [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/gif":  [{ bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },  // GIF87a
                 { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }], // GIF89a
  "image/webp": [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }],  // RIFF header (on vérifie aussi "WEBP" à offset 8)
  "image/svg+xml": [], // SVG est du texte/XML — pas de magic number, validé autrement
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }],       // %PDF
};

/**
 * Vérifie que le buffer correspond à la signature binaire du type MIME déclaré.
 * Retourne false si le type est inconnu ou si la signature ne correspond pas.
 */
function validateMagicNumber(buffer: Buffer, declaredMime: string): boolean {
  const entries = MAGIC_SIGNATURES[declaredMime];

  // Type non référencé → refusé par défaut
  if (entries === undefined) return false;

  // Certains types (SVG) n'ont pas de magic number → on accepte
  if (entries.length === 0) return true;

  // Vérifier si au moins une des signatures correspond
  return entries.some(({ bytes, offset = 0 }) => {
    if (buffer.length < offset + bytes.length) return false;
    return bytes.every((byte, i) => buffer[offset + i] === byte);
  });
}

/**
 * Normalise et sécurise un nom de fichier fourni par l'utilisateur.
 * - Supprime les path traversals (../ etc.)
 * - Remplace les caractères spéciaux
 * - Tronque à 64 caractères max
 */
function sanitizeExtension(filename: string): string {
  const raw = filename.split(".").pop() ?? "";
  // Autoriser uniquement lettres, chiffres et tiret — refuser tout le reste
  return raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Valide un fichier avant l'upload (taille + MIME déclaré).
 * La validation du magic number nécessite le buffer et se fait dans uploadFile().
 */
export function validateFile(
  file: File,
  options: UploadOptions = {}
): { valid: boolean; error?: string } {
  const maxSize =
    options.maxSize ??
    parseInt(process.env.MAX_UPLOAD_SIZE ?? String(DEFAULT_MAX_SIZE));

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille max : ${maxSize / 1024 / 1024} MB`,
    };
  }

  if (options.allowedTypes && options.allowedTypes.length > 0) {
    if (!options.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Type non autorisé. Types acceptés : ${options.allowedTypes.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Upload un fichier vers le système de fichiers local.
 * Effectue une double validation :
 *   1. Taille et type MIME déclaré (header)
 *   2. Magic number (contenu binaire réel du fichier)
 */
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // 1. Validation taille + MIME
  const validation = validateFile(file, options);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Lire le contenu pour valider le magic number
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (!validateMagicNumber(buffer, file.type)) {
    throw new Error(
      `Contenu du fichier invalide : la signature binaire ne correspond pas au type "${file.type}".`
    );
  }

  // 3. Préparer le chemin de destination
  const destination = options.destination ?? DEFAULT_DESTINATION;
  const uploadDir = join(process.cwd(), destination);

  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }

  // 4. Nom de fichier sécurisé : UUID + extension assainie (pas de path traversal possible)
  const extension = sanitizeExtension(file.name);
  if (!extension) {
    throw new Error("Extension de fichier invalide ou manquante.");
  }

  const filename = `${randomUUID()}.${extension}`;
  const filepath = join(uploadDir, filename);

  // 5. Écriture sur le disque
  await writeFile(filepath, new Uint8Array(buffer));

  return {
    filename,
    path: `/${destination}/${filename}`,
    size: file.size,
    mimetype: file.type,
  };
}

/**
 * Upload depuis un FormData (pour les API routes).
 */
export async function uploadFromFormData(
  formData: FormData,
  fieldName: string = "file",
  options: UploadOptions = {}
): Promise<UploadResult> {
  const file = formData.get(fieldName) as File;

  if (!file) {
    throw new Error(`Aucun fichier trouvé dans le champ "${fieldName}"`);
  }

  return uploadFile(file, options);
}

/**
 * Supprime un fichier uploadé.
 */
export async function deleteUploadedFile(filepath: string): Promise<void> {
  const { unlink } = await import("fs/promises");
  const fullPath = join(process.cwd(), filepath);

  if (existsSync(fullPath)) {
    await unlink(fullPath);
  }
}
