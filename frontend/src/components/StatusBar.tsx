import { useMemo, useRef } from "react";
import type { RouteResult } from "../types";
import { fmtDistance, fmtDuration } from "../format";

interface Props {
  route: RouteResult | null;
  routeLoading: boolean;
  routeError: string | null;
  /** Wegpunkt-Markierungen fürs Höhenprofil (kumulierte Distanz + Buchstabe). */
  waypointMarks: { atM: number; label: string }[];
  /** Alle Varianten (Haupt + Alternativen) zur Auswahl. */
  allRoutes: RouteResult[];
  selectedRouteIdx: number;
  onSelectRoute: (idx: number) => void;
  /** Hover-Position entlang der Strecke (kumulierte Distanz in m, null = aus). */
  hoverM: number | null;
  /** Hover-Position melden (vom Überfahren des Höhenprofils). */
  onHoverM: (m: number | null) => void;
  onExportGpx: () => void;
}

/** Höhe (interpoliert) an kumulierter Distanz `m` aus den Stützstellen. */
function elevationAt(elev: { d: number; e: number }[], m: number): number | null {
  if (elev.length === 0) return null;
  if (m <= elev[0].d) return elev[0].e;
  for (let i = 0; i < elev.length - 1; i++) {
    if (m <= elev[i + 1].d) {
      const span = elev[i + 1].d - elev[i].d || 1;
      const t = (m - elev[i].d) / span;
      return elev[i].e + t * (elev[i + 1].e - elev[i].e);
    }
  }
  return elev[elev.length - 1].e;
}

const VB_W = 1000;
const VB_H = 100;

/** Baut Flächen-/Linienpfad fürs Höhenprofil + min/max-Höhe. */
function buildPath(
  elevation: { d: number; e: number }[],
  totalM: number,
): { area: string; line: string; minE: number; maxE: number } | null {
  if (!elevation || elevation.length < 2 || totalM <= 0) return null;
  let minE = Infinity;
  let maxE = -Infinity;
  for (const s of elevation) {
    if (s.e < minE) minE = s.e;
    if (s.e > maxE) maxE = s.e;
  }
  const span = maxE - minE || 1;
  const pad = 12;
  const x = (d: number) => (d / totalM) * VB_W;
  const y = (e: number) => VB_H - pad - ((e - minE) / span) * (VB_H - 2 * pad);

  let line = "";
  for (let i = 0; i < elevation.length; i++) {
    line += `${i === 0 ? "M" : "L"}${x(elevation[i].d).toFixed(1)},${y(
      elevation[i].e,
    ).toFixed(1)} `;
  }
  const area =
    `M0,${VB_H} ` +
    elevation
      .map((s) => `L${x(s.d).toFixed(1)},${y(s.e).toFixed(1)}`)
      .join(" ") +
    ` L${VB_W},${VB_H} Z`;
  return { area, line, minE, maxE };
}

/** Dauerhafte Statusleiste unter der Karte: Distanz, Fahrzeit, Höhenprofil, GPX-Export. */
export default function StatusBar({
  route,
  routeLoading,
  routeError,
  waypointMarks,
  allRoutes,
  selectedRouteIdx,
  onSelectRoute,
  hoverM,
  onHoverM,
  onExportGpx,
}: Props) {
  const totalM = route?.distanceM ?? 0;
  const elev = route?.elevation ?? [];
  const chart = useMemo(() => buildPath(elev, totalM), [elev, totalM]);
  const elevRef = useRef<HTMLDivElement>(null);

  // Maus über dem Höhenprofil -> Distanz aus x-Position ableiten und melden.
  const onElevMove = (e: React.MouseEvent) => {
    const box = elevRef.current?.getBoundingClientRect();
    if (!box || totalM <= 0 || box.width === 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    onHoverM(frac * totalM);
  };

  const hoverPct = hoverM != null && totalM > 0 ? (hoverM / totalM) * 100 : null;
  const hoverEle = hoverM != null ? elevationAt(elev, hoverM) : null;

  return (
    <div className="statusbar">
      <div className="sb-stats">
        <div className="sb-stat">
          <span className="sb-label">Distanz</span>
          <span className="sb-value">{route ? fmtDistance(route.distanceM) : "–"}</span>
        </div>
        <div className="sb-sep" />
        <div className="sb-stat">
          <span className="sb-label">Fahrzeit (ca.)</span>
          <span className="sb-value">{route ? fmtDuration(route.durationS) : "–"}</span>
        </div>

        {allRoutes.length > 1 && (
          <>
            <div className="sb-sep" />
            <div className="sb-variants" title="Streckenvariante wählen">
              {allRoutes.map((r, i) => (
                <button
                  key={i}
                  className={`sb-variant${i === selectedRouteIdx ? " active" : ""}`}
                  onClick={() => onSelectRoute(i)}
                  title={`${fmtDistance(r.distanceM)} · ${fmtDuration(r.durationS)}`}
                >
                  {i === 0 ? "Route" : `Var. ${i}`}
                  <span className="sb-variant-meta">{fmtDistance(r.distanceM)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sb-mid">
        {routeLoading && <span className="spinner">Berechne Route …</span>}
        {!routeLoading && routeError && <span className="error">Fehler: {routeError}</span>}
        {!routeLoading && !routeError && chart && (
          <div
            className="elev"
            title="Höhenprofil"
            ref={elevRef}
            onMouseMove={onElevMove}
            onMouseLeave={() => onHoverM(null)}
          >
            <svg
              className="elev-svg"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
            >
              <path d={chart.area} className="elev-area" />
              <path d={chart.line} className="elev-line" />
              {hoverPct != null && (
                <line
                  x1={(hoverPct / 100) * VB_W}
                  x2={(hoverPct / 100) * VB_W}
                  y1={0}
                  y2={VB_H}
                  className="elev-hover"
                />
              )}
              {waypointMarks.map((m, i) => {
                const xPct = totalM > 0 ? (m.atM / totalM) * 100 : 0;
                return (
                  <line
                    key={i}
                    x1={(xPct / 100) * VB_W}
                    x2={(xPct / 100) * VB_W}
                    y1={0}
                    y2={VB_H}
                    className="elev-wp"
                  />
                );
              })}
            </svg>
            {/* Höhenbeschriftung */}
            <span className="elev-max">{Math.round(chart.maxE)} m</span>
            <span className="elev-min">{Math.round(chart.minE)} m</span>
            {/* Wegpunkt-Buchstaben (HTML, damit unverzerrt) */}
            {waypointMarks.map((m, i) => {
              const xPct = totalM > 0 ? (m.atM / totalM) * 100 : 0;
              return (
                <span
                  key={i}
                  className="elev-wp-label"
                  style={{ left: `${xPct}%` }}
                >
                  {m.label}
                </span>
              );
            })}
            {/* Hover-Anzeige: km + Höhe an der Cursor-Position */}
            {hoverPct != null && (
              <span
                className="elev-hover-label"
                style={{ left: `${hoverPct}%` }}
              >
                {(hoverM! / 1000).toFixed(1)} km
                {hoverEle != null ? ` · ${Math.round(hoverEle)} m` : ""}
              </span>
            )}
          </div>
        )}
        {!routeLoading && !routeError && !chart && (
          <span className="muted">Wegpunkte setzen, um eine Route zu planen.</span>
        )}
      </div>

      <button className="primary sb-export" onClick={onExportGpx} disabled={!route}>
        ⬇ GPX exportieren
      </button>
    </div>
  );
}
