// Versions-Check: liest das neueste GitHub-Release und vergleicht es mit der
// laufenden Version. Ergebnis wird ~1 h gecacht, um die GitHub-API (60 Abrufe/h
// pro IP, ohne Token) zu schonen.
import { config, userAgent } from "../config.js";

export interface VersionInfo {
  /** Laufende App-Version, z. B. "0.4.0". */
  current: string;
  /** Neuestes Release-Tag bei GitHub, z. B. "v0.5.0" (oder null, wenn unbekannt). */
  latest: string | null;
  /** true, wenn `latest` neuer als `current` ist. */
  updateAvailable: boolean;
  /** Link zur Release-Seite (oder zum Repository). */
  releaseUrl: string;
  /** Link zum Repository. */
  repoUrl: string;
}

const repoUrl = `https://github.com/${config.githubRepo}`;

// Einfacher In-Memory-Cache.
let cache: { at: number; info: VersionInfo } | null = null;
const TTL_MS = 60 * 60 * 1000; // 1 h

/** "v1.2.3" / "1.2.3" -> [1,2,3]; nicht-numerische Teile werden zu 0. */
function parseSemver(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0);
}

/** true, wenn `a` (latest) echt neuer ist als `b` (current). */
function isNewer(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function getVersionInfo(current: string): Promise<VersionInfo> {
  if (cache && Date.now() - cache.at < TTL_MS && cache.info.current === current) {
    return cache.info;
  }

  let latest: string | null = null;
  let releaseUrl = repoUrl;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${config.githubRepo}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": userAgent,
        },
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { tag_name?: string; html_url?: string };
      latest = data.tag_name ?? null;
      if (data.html_url) releaseUrl = data.html_url;
    }
  } catch {
    /* Versions-Check ist best effort – bei Fehler bleibt latest null. */
  }

  const info: VersionInfo = {
    current,
    latest,
    updateAvailable: latest != null && isNewer(latest, current),
    releaseUrl,
    repoUrl,
  };
  cache = { at: Date.now(), info };
  return info;
}
