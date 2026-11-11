import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "storage");
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
  "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

export function checkFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `${file.name} : fichier trop volumineux (10 Mo max)`;
  if (!ALLOWED[file.type]) return `${file.name} : type de fichier non autorisé`;
  return null;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]; // pas de SVG : risque de script embarqué
export function checkLogo(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return "Logo : PNG, JPEG ou WebP uniquement";
  if (file.size > 1024 * 1024) return "Logo : 1 Mo maximum";
  return null;
}
export const deleteFile = (key: string) => fs.rm(path.join(ROOT, path.basename(key)), { force: true });

/** Stocke le fichier hors base ; la clé est un UUID (jamais le nom fourni par l'utilisateur). */
export async function saveFile(file: File) {
  const key = `${randomUUID()}${ALLOWED[file.type]}`;
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(path.join(ROOT, key), Buffer.from(await file.arrayBuffer()));
  return key;
}

export const readFile = (key: string) => fs.readFile(path.join(ROOT, path.basename(key)));
