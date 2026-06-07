import type { RouteResult } from "../types";

interface Props {
  route: RouteResult | null;
  routeLoading: boolean;
  routeError: string | null;
  onExportGpx: () => void;
}

function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${min} min` : `${min} min`;
}

/** Dauerhafte Statusleiste unter der Karte: Distanz, Fahrzeit, GPX-Export. */
export default function StatusBar({ route, routeLoading, routeError, onExportGpx }: Props) {
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
      </div>

      <div className="sb-msg">
        {routeLoading && <span className="spinner">Berechne Route …</span>}
        {!routeLoading && routeError && <span className="error">Fehler: {routeError}</span>}
        {!routeLoading && !routeError && !route && (
          <span className="muted">Wegpunkte setzen, um eine Route zu planen.</span>
        )}
      </div>

      <button className="primary sb-export" onClick={onExportGpx} disabled={!route}>
        ⬇ GPX exportieren
      </button>
    </div>
  );
}
