// Zugriff auf eingebettete Ressourcen (Frontend-Dateien, BRouter-Profile).
// In der gepackten EXE (Node SEA) liegen sie als eingebettete Assets vor,
// im Dev-Betrieb werden sie aus dem Dateisystem gelesen.
import { getAsset } from "node:sea";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config, packaged } from "./config.js";

/** Profiltext (.brf) holen. */
export async function profileText(file: string): Promise<string> {
  if (packaged) {
    return getAsset(`brouter-profiles/${file}`, "utf8");
  }
  return readFile(join(config.profilesDir, file), "utf8");
}

/** Statische Frontend-Datei als Buffer holen (nur in der EXE). null, wenn nicht vorhanden. */
export function staticAsset(relPath: string): Buffer | null {
  if (!packaged) return null;
  try {
    return Buffer.from(getAsset(`public/${relPath}`));
  } catch {
    return null;
  }
}

/** Frontend-dist-Verzeichnis im Dev-Betrieb (für optionales statisches Ausliefern). */
export const devPublicDir = resolve(config.profilesDir, "..", "..", "frontend", "dist");
