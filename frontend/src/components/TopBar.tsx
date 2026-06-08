import { useEffect, useState } from "react";
import { fetchVersion } from "../api/client";
import type { VersionInfo } from "../types";

const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/** Kopfzeile: Titel, Versionsstand (Update-Hinweis) und Link zum Repository. */
export default function TopBar() {
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVersion(APP_VERSION)
      .then((v) => !cancelled && setInfo(v))
      .catch(() => {
        /* Versions-Check ist optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const repoUrl = info?.repoUrl ?? "https://github.com/mzluzifer/motorrad-routenplaner";

  return (
    <header className="topbar">
      <span className="tb-title">🏍️ Motorrad-Routenplaner</span>
      <span className="tb-version">v{APP_VERSION}</span>

      {info?.updateAvailable && (
        <a
          className="tb-update"
          href={info.releaseUrl}
          target="_blank"
          rel="noreferrer"
          title="Neueres Release auf GitHub verfügbar"
        >
          ⬆ Update verfügbar: {info.latest}
        </a>
      )}
      {info && !info.updateAvailable && info.latest && (
        <span className="tb-uptodate" title={`Neuestes Release: ${info.latest}`}>
          ✓ aktuell
        </span>
      )}

      <a
        className="tb-repo"
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        title="Projekt auf GitHub öffnen"
      >
        ⭐ Repository
      </a>
    </header>
  );
}
