import type { RouteResult } from "../types";
import { fmtDistance, fmtDuration } from "../format";

interface Props {
  route: RouteResult | null;
  routeLoading: boolean;
  routeError: string | null;
  onExportGpx: () => void;
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
