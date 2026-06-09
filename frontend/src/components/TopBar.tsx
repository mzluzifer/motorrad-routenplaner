import { useEffect, useState } from "react";
import { fetchVersion } from "../api/client";
import { LANGS, useI18n } from "../i18n";
import type { VersionInfo } from "../types";

const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

/** Kopfzeile: Titel, Versionsstand (Update-Hinweis) und Link zum Repository. */
export default function TopBar() {
  const { lang, setLang, t } = useI18n();
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
      <span className="tb-title">{t("app.title")}</span>
      <span className="tb-version">v{APP_VERSION}</span>

      {info?.updateAvailable && (
        <a
          className="tb-update"
          href={info.releaseUrl}
          target="_blank"
          rel="noreferrer"
          title={t("topbar.updateTitle")}
        >
          {t("topbar.updateAvailable", { v: info.latest })}
        </a>
      )}
      {info && !info.updateAvailable && info.latest && (
        <span
          className="tb-uptodate"
          title={t("topbar.latestRelease", { v: info.latest })}
        >
          {t("topbar.upToDate")}
        </span>
      )}

      <div className="tb-lang" title={t("topbar.langTitle")}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={`tb-lang-btn${lang === l.id ? " active" : ""}`}
            onClick={() => setLang(l.id)}
            title={l.label}
            aria-label={l.label}
          >
            {l.flag}
          </button>
        ))}
      </div>

      <a
        className="tb-repo"
        href={repoUrl}
        target="_blank"
        rel="noreferrer"
        title={t("topbar.repoTitle")}
      >
        {t("topbar.repo")}
      </a>
    </header>
  );
}
