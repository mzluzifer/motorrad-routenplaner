import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { weatherIcon, weatherText } from "../weather";
import type { Poi, Roadwork, RouteResult, Waypoint, WeatherPoint } from "../types";

interface Props {
  waypoints: Waypoint[];
  route: RouteResult | null;
  roadworks: Roadwork[];
  disabledRoadworks: Set<string>;
  avoidConstruction: boolean;
  pois: Poi[];
  selectedPois: Set<string>;
  weather: WeatherPoint[];
  onMapClick: (lng: number, lat: number) => void;
  onTogglePoi: (poi: Poi) => void;
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
      syncMarkers();
    });

    map.on("click", (e) => {
      cbRef.current.onMapClick(e.lngLat.lng, e.lngLat.lat);
    });

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
