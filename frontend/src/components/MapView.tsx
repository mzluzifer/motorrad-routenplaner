import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { weatherIcon, weatherText } from "../weather";
import { coordAtDistance, projectOnLine } from "../geo";
import type { LngLat, Poi, Roadwork, RouteResult, Waypoint, WeatherPoint } from "../types";

interface Props {
  waypoints: Waypoint[];
  route: RouteResult | null;
  /** Alle Varianten (Haupt + Alternativen); Index 0 = Hauptroute. */
  allRoutes: RouteResult[];
  selectedRouteIdx: number;
  onSelectRoute: (idx: number) => void;
  roadworks: Roadwork[];
  disabledRoadworks: Set<string>;
  avoidConstruction: boolean;
  pois: Poi[];
  selectedPois: Set<string>;
  weather: WeatherPoint[];
  /** Hover-Position entlang der Strecke (kumulierte Distanz in m, null = aus). */
  hoverM: number | null;
  /** Hover-Position melden (vom Überfahren der Karte). */
  onHoverM: (m: number | null) => void;
  onMapClick: (lng: number, lat: number) => void;
  onTogglePoi: (poi: Poi) => void;
}

/** LineString-Koordinaten der berechneten Route. */
function lineOf(route: RouteResult | null): LngLat[] {
  if (!route?.geojson) return [];
  for (const f of route.geojson.features) {
    if (f.geometry.type === "LineString") return f.geometry.coordinates as LngLat[];
  }
  return [];
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function markerEl(html: string, bg: string, size = 26): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${bg};
    display:grid;place-items:center;font-size:13px;font-weight:700;color:#111;
    border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer;`;
  el.innerHTML = html;
  return el;
}

export default function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);
  // Beständiger Hover-Marker (Streckenposition) – außerhalb des Marker-Rebuilds.
  const hoverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hoverLabelRef = useRef<HTMLDivElement | null>(null);
  // aktuellste Callbacks ohne Stale-Closure
  const cbRef = useRef(props);
  cbRef.current = props;

  // Karte einmalig initialisieren
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [10.45, 51.16], // Deutschland
      zoom: 6,
      // Erlaubt den Export des Kartenbilds (z. B. Screenshot via canvas.toDataURL).
      preserveDrawingBuffer: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // Alternativrouten zuerst (liegen unter der aktiven Route).
      map.addSource("alt-routes", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "alt-lines",
        type: "line",
        source: "alt-routes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#9aa3b2",
          "line-width": 5,
          "line-opacity": 0.7,
          "line-dasharray": [1.5, 1.5],
        },
      });
      map.addSource("route", { type: "geojson", data: emptyFc() });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff7a18", "line-width": 5, "line-opacity": 0.9 },
      });
      loadedRef.current = true;
      syncRoute();
      syncAltRoutes();
      syncMarkers();
    });

    map.on("click", (e) => {
      // Klick auf eine Alternativroute -> als aktive Variante wählen (kein neuer Wegpunkt).
      const hits = map.queryRenderedFeatures(e.point, { layers: ["alt-lines"] });
      const idx = hits[0]?.properties?.idx;
      if (idx != null) {
        cbRef.current.onSelectRoute(Number(idx));
        return;
      }
      cbRef.current.onMapClick(e.lngLat.lng, e.lngLat.lat);
    });
    map.on("mouseenter", "alt-lines", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "alt-lines", () => {
      map.getCanvas().style.cursor = "";
    });

    // Hover über der Karte: Cursor auf die Route projizieren -> km-Position melden.
    map.on("mousemove", (e) => {
      const line = lineOf(cbRef.current.route);
      if (line.length < 2) {
        if (cbRef.current.hoverM != null) cbRef.current.onHoverM(null);
        return;
      }
      const { distance, point } = projectOnLine(line, [e.lngLat.lng, e.lngLat.lat]);
      // Nur als „auf der Strecke" werten, wenn der Cursor nah genug (in Pixeln) ist.
      const footPx = map.project(point as [number, number]);
      const dpx = Math.hypot(footPx.x - e.point.x, footPx.y - e.point.y);
      cbRef.current.onHoverM(dpx <= 24 ? distance : null);
    });
    map.getCanvas().addEventListener("mouseleave", () => cbRef.current.onHoverM(null));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route aktualisieren + einpassen
  useEffect(syncRoute, [props.route]);
  // Alternativrouten (nicht gewählte Varianten) zeichnen
  useEffect(syncAltRoutes, [props.allRoutes, props.selectedRouteIdx]);
  // Hover-Punkt (Streckenposition) anzeigen/verschieben
  useEffect(syncHover, [props.hoverM, props.route]);
  // Marker (Wegpunkte, Baustellen, POIs, Maut/Fähren, Wetter) neu aufbauen
  useEffect(syncMarkers, [
    props.waypoints,
    props.roadworks,
    props.disabledRoadworks,
    props.avoidConstruction,
    props.pois,
    props.selectedPois,
    props.weather,
    props.route,
  ]);

  function syncRoute() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const route = cbRef.current.route;
    if (route?.geojson) {
      src.setData(route.geojson as any);
      try {
        const b = new maplibregl.LngLatBounds();
        for (const f of route.geojson.features) {
          const g = f.geometry;
          if (g.type === "LineString") g.coordinates.forEach((c) => b.extend(c as [number, number]));
        }
        if (!b.isEmpty()) map.fitBounds(b, { padding: 60, maxZoom: 14 });
      } catch {
        /* ignore */
      }
    } else {
      src.setData(emptyFc());
    }
  }

  /** Nicht gewählte Varianten als gestrichelte Linien zeichnen (klickbar). */
  function syncAltRoutes() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("alt-routes") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const p = cbRef.current;
    const features: GeoJSON.Feature[] = [];
    p.allRoutes.forEach((r, idx) => {
      if (idx === p.selectedRouteIdx) return; // aktive Route liegt im "route"-Layer
      const coords = lineOf(r);
      if (coords.length < 2) return;
      features.push({
        type: "Feature",
        properties: { idx },
        geometry: { type: "LineString", coordinates: coords },
      });
    });
    src.setData({ type: "FeatureCollection", features });
  }

  /** Hover-Marker auf der Strecke an der Position `hoverM` zeigen/verschieben. */
  function syncHover() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const m = cbRef.current.hoverM;
    const line = lineOf(cbRef.current.route);
    const pt = m != null ? coordAtDistance(line, m) : null;
    if (!pt) {
      hoverMarkerRef.current?.remove();
      hoverMarkerRef.current = null;
      return;
    }
    if (!hoverMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;background:var(--accent-2,#18a0ff);" +
        "border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.4);pointer-events:none;";
      const label = document.createElement("div");
      label.style.cssText =
        "position:absolute;left:50%;bottom:18px;transform:translateX(-50%);white-space:nowrap;" +
        "background:#18a0ff;color:#06121f;font-size:11px;font-weight:700;padding:1px 6px;" +
        "border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.5);";
      el.appendChild(label);
      hoverLabelRef.current = label;
      hoverMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
    } else {
      hoverMarkerRef.current.setLngLat(pt);
    }
    if (hoverLabelRef.current) {
      hoverLabelRef.current.textContent = `${(m! / 1000).toFixed(1)} km`;
    }
  }

  /** Popup, das beim Überfahren (Hover) des Markers erscheint. */
  function attachHoverPopup(
    map: maplibregl.Map,
    el: HTMLElement,
    lngLat: [number, number],
    html: string,
  ) {
    const popup = new maplibregl.Popup({
      offset: 14,
      closeButton: false,
      closeOnClick: false,
    }).setLngLat(lngLat).setHTML(html);
    popupsRef.current.push(popup);
    el.addEventListener("mouseenter", () => popup.addTo(map));
    el.addEventListener("mouseleave", () => popup.remove());
  }

  function syncMarkers() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((pp) => pp.remove());
    popupsRef.current = [];
    const p = cbRef.current;

    // Wegpunkte: A, B, C ...
    p.waypoints.forEach((wp, i) => {
      const letter = String.fromCharCode(65 + i);
      const el = markerEl(letter, "#ff7a18");
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([wp.lng, wp.lat])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(wp.label))
        .addTo(map);
      markersRef.current.push(m);
    });

    // Baustellen
    p.roadworks.forEach((rw) => {
      const active = p.avoidConstruction && !p.disabledRoadworks.has(rw.id);
      const el = markerEl("⚠", active ? "#ff5470" : "#9aa3b2", 22);
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([rw.lng, rw.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 14 }).setHTML(
            `<b>${escapeHtml(rw.title)}</b><br>${escapeHtml(rw.description ?? "")}` +
              `<br><span style="color:#9aa3b2">${rw.source.toUpperCase()} · ${
                active ? "wird gemieden" : "wird befahren"
              }</span>`,
          ),
        )
        .addTo(map);
      markersRef.current.push(m);
    });

    // POIs (Restaurants/Imbisse 🍴 + Tankstellen ⛽) – Info beim Hover, Klick fügt ein.
    p.pois.forEach((poi) => {
      const selected = p.selectedPois.has(poi.id);
      const isFuel = poi.category === "fuel";
      const icon = isFuel ? "⛽" : "🍴";
      const baseColor = isFuel ? "#7ad1a0" : "#ffd24a";
      const el = markerEl(icon, selected ? "#18a0ff" : baseColor, 22);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cbRef.current.onTogglePoi(poi);
      });
      const meta = isFuel
        ? `${poi.brand ? escapeHtml(poi.brand) : "Tankstelle"}`
        : `${escapeHtml(poi.kind)}${poi.cuisine ? " · " + escapeHtml(poi.cuisine) : ""}${
            poi.quality != null ? " · ★ " + poi.quality.toFixed(1) + " (OSM)" : ""
          }`;
      attachHoverPopup(
        map,
        el,
        [poi.lng, poi.lat],
        `<b>${escapeHtml(poi.name)}</b><br>${meta}` +
          `<br><span style="color:#9aa3b2">${poi.distance} m zur Route · klicken zum ${
            selected ? "Entfernen" : "Hinzufügen"
          }</span>`,
      );
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map);
      markersRef.current.push(m);
    });

    // Maut 💶 / Fähren ⛴️ entlang der Route
    (p.route?.features ?? []).forEach((f) => {
      const isFerry = f.kind === "ferry";
      const el = markerEl(isFerry ? "⛴️" : "💶", isFerry ? "#6cc0ff" : "#ffcf6c", 22);
      attachHoverPopup(
        map,
        el,
        [f.lng, f.lat],
        `<b>${isFerry ? "Fähre" : "Maut"}</b><br>` +
          `<span style="color:#9aa3b2">Länge ${
            f.lengthM >= 1000 ? (f.lengthM / 1000).toFixed(1) + " km" : f.lengthM + " m"
          }</span>`,
      );
      const m = new maplibregl.Marker({ element: el }).setLngLat([f.lng, f.lat]).addTo(map);
      markersRef.current.push(m);
    });

    // Wetter-Stützpunkte entlang der Route
    p.weather.forEach((w) => {
      const el = markerEl(weatherIcon(w.weatherCode), "#ffffff", 24);
      el.style.fontSize = "15px";
      const temps =
        w.tempMin != null && w.tempMax != null
          ? `${Math.round(w.tempMin)}–${Math.round(w.tempMax)} °C`
          : "";
      attachHoverPopup(
        map,
        el,
        [w.lng, w.lat],
        `<b>${weatherText(w.weatherCode)}</b><br>` +
          `<span style="color:#9aa3b2">${temps}` +
          `${w.precipMm != null ? " · ☔ " + w.precipMm.toFixed(1) + " mm" : ""}` +
          `${w.windMaxKmh != null ? " · 💨 " + Math.round(w.windMaxKmh) + " km/h" : ""}</span>`,
      );
      const m = new maplibregl.Marker({ element: el }).setLngLat([w.lng, w.lat]).addTo(map);
      markersRef.current.push(m);
    });
  }

  return <div className="map" ref={containerRef} />;
}

function emptyFc(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
