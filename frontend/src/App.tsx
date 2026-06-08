import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import {
  downloadGpx,
  fetchPois,
  fetchRoadworks,
  fetchRoute,
  fetchWeather,
  reverseGeocode,
} from "./api/client";
import { projectDistanceAlong } from "./geo";
import type {
  LngLat,
  Poi,
  ProfileName,
  Roadwork,
  RouteResult,
  Waypoint,
  WeatherPoint,
} from "./types";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** LineString-Koordinaten der berechneten Route. */
export function routeLine(route: RouteResult | null): LngLat[] {
  if (!route?.geojson) return [];
  for (const f of route.geojson.features) {
    if (f.geometry.type === "LineString") return f.geometry.coordinates as LngLat[];
  }
  return [];
}

export default function App() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  // Vorgabeprofil für neue Abschnitte; einzelne Abschnitte können abweichen.
  const [defaultProfile, setDefaultProfile] = useState<ProfileName>("curvy");
  const [roundTrip, setRoundTrip] = useState(false);
  const [locating, setLocating] = useState(false);

  const [avoidConstruction, setAvoidConstruction] = useState(true);
  const [includeOsm, setIncludeOsm] = useState(true);
  const [roadworks, setRoadworks] = useState<Roadwork[]>([]);
  const [disabledRoadworks, setDisabledRoadworks] = useState<Set<string>>(new Set());

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  // Gewählte Variante: 0 = Hauptroute, 1..n = Alternative. Bei Neuberechnung -> 0.
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  // Alle Varianten (Haupt + Alternativen) und die aktuell aktive Route.
  const allRoutes = useMemo<RouteResult[]>(
    () => (route ? [route, ...(route.alternatives ?? [])] : []),
    [route],
  );
  const activeRoute = allRoutes[selectedRouteIdx] ?? route;

  const [pois, setPois] = useState<Poi[]>([]);
  const [selectedPois, setSelectedPois] = useState<Set<string>>(new Set());
  const [poiLoading, setPoiLoading] = useState(false);
  // Mindest-OSM-Qualität für Essen (Annäherung an „mind. 4,5 Sterne"; keine echten
  // Google-Sterne, sondern aus Tag-Vollständigkeit – offene Daten haben keine Ratings).
  const [minQuality, setMinQuality] = useState(4.5);
  const [poiError, setPoiError] = useState<string | null>(null);

  const [fuelPois, setFuelPois] = useState<Poi[]>([]);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelError, setFuelError] = useState<string | null>(null);

  // Hover-Position entlang der Strecke (kumulierte Distanz in m, null = kein Hover).
  // Bidirektional zwischen Karte und Höhenprofil synchronisiert.
  const [hoverM, setHoverM] = useState<number | null>(null);

  // Wetter entlang der Strecke (leeres Datum = heute).
  const [weatherDate, setWeatherDate] = useState("");
  const [weather, setWeather] = useState<WeatherPoint[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Breite der Seitenleiste (ziehbar, in localStorage gemerkt).
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const v = Number(localStorage.getItem("sidebarWidth"));
    return v >= 280 && v <= 720 ? v : 360;
  });
  const draggingRef = useRef(false);

  // Effektive Punktliste fürs Routing (inkl. Rückweg bei Rundtour).
  const effectivePoints = useMemo<LngLat[]>(() => {
    const pts = waypoints.map((w) => [w.lng, w.lat] as LngLat);
    if (roundTrip && pts.length >= 2) pts.push(pts[0]);
    return pts;
  }, [waypoints, roundTrip]);

  // Profil je Abschnitt: Abschnitt i führt von Wegpunkt i zum nächsten Punkt.
  // Bei Rundtour kommt der Rückweg (letzter Wegpunkt -> Start) hinzu.
  const segmentProfiles = useMemo<ProfileName[]>(() => {
    if (waypoints.length < 2) return [];
    const segs = roundTrip ? waypoints : waypoints.slice(0, -1);
    return segs.map((w) => w.profile ?? defaultProfile);
  }, [waypoints, roundTrip, defaultProfile]);

  // Aktive Sperrzonen aus Baustellen (nur wenn Vermeidung an und nicht einzeln deaktiviert).
  const activeNogos = useMemo(() => {
    if (!avoidConstruction) return [];
    return roadworks
      .filter((r) => !disabledRoadworks.has(r.id))
      .map((r) => ({ lng: r.lng, lat: r.lat, radius: r.radius }));
  }, [avoidConstruction, roadworks, disabledRoadworks]);

  // --- Wegpunkt-Operationen ---
  const addWaypoint = useCallback(
    (lng: number, lat: number, label?: string) => {
      setWaypoints((w) => [
        ...w,
        {
          id: newId(),
          lng,
          lat,
          label: label ?? `Punkt (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          profile: defaultProfile,
        },
      ]);
    },
    [defaultProfile],
  );
  const updateWaypoint = (id: string, lng: number, lat: number, label: string) =>
    setWaypoints((w) =>
      w.map((p) => (p.id === id ? { ...p, lng, lat, label } : p)),
    );
  const removeWaypoint = (id: string) =>
    setWaypoints((w) => w.filter((p) => p.id !== id));
  const moveWaypoint = (id: string, dir: -1 | 1) =>
    setWaypoints((w) => {
      const i = w.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= w.length) return w;
      const copy = [...w];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  // Profil eines einzelnen Abschnitts (am Start-Wegpunkt gespeichert).
  const setSegmentProfile = (id: string, pr: ProfileName) =>
    setWaypoints((w) => w.map((p) => (p.id === id ? { ...p, profile: pr } : p)));

  // Globaler Umschalter: setzt Vorgabe und überträgt sie auf alle Abschnitte.
  const setAllProfiles = (pr: ProfileName) => {
    setDefaultProfile(pr);
    setWaypoints((w) => w.map((p) => ({ ...p, profile: pr })));
  };

  // --- Aktueller Standort als Start ---
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setRouteError("Standortbestimmung wird vom Browser nicht unterstützt.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = "📍 Mein Standort";
        try {
          const r = await reverseGeocode(lat, lng);
          if (r?.label) label = "📍 " + r.label.split(",").slice(0, 2).join(",").trim();
        } catch {
          /* Adressauflösung ist optional */
        }
        // Als Start (Position 0) einfügen.
        setWaypoints((w) => [
          { id: newId(), lng, lat, label, profile: defaultProfile },
          ...w,
        ]);
        setLocating(false);
      },
      (err) => {
        setRouteError("Standort nicht verfügbar: " + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  // --- Routing (automatisch, leicht entprellt) ---
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (effectivePoints.length < 2) {
      setRoute(null);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setRouteLoading(true);
      setRouteError(null);
      try {
        const r = await fetchRoute(effectivePoints, segmentProfiles, activeNogos);
        setRoute(r);
        setSelectedRouteIdx(0);
      } catch (e: any) {
        setRouteError(e.message ?? String(e));
        setRoute(null);
      } finally {
        setRouteLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [effectivePoints, segmentProfiles, activeNogos]);

  // --- Baustellen laden, wenn sich die Wegpunkte ändern ---
  useEffect(() => {
    const pts = waypoints.map((w) => [w.lng, w.lat] as LngLat);
    if (pts.length < 2) {
      setRoadworks([]);
      return;
    }
    let cancelled = false;
    fetchRoadworks(pts, includeOsm)
      .then((rw) => !cancelled && setRoadworks(rw))
      .catch(() => !cancelled && setRoadworks([]));
    return () => {
      cancelled = true;
    };
  }, [waypoints, includeOsm]);

  // --- Seitenleiste in der Breite ziehen ---
  useEffect(() => {
    localStorage.setItem("sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setSidebarWidth(Math.min(720, Math.max(280, e.clientX)));
    };
    const up = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const toggleRoadwork = (id: string) =>
    setDisabledRoadworks((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // --- POIs (Restaurants/Imbisse + Tankstellen) ---
  const searchPois = async () => {
    const line = routeLine(activeRoute);
    if (line.length < 2) return;
    setPoiLoading(true);
    setPoiError(null);
    try {
      setPois(await fetchPois(line, "food", 500));
    } catch (e: any) {
      setPoiError(e.message ?? String(e));
    } finally {
      setPoiLoading(false);
    }
  };

  const searchFuel = async () => {
    const line = routeLine(activeRoute);
    if (line.length < 2) return;
    setFuelLoading(true);
    setFuelError(null);
    try {
      setFuelPois(await fetchPois(line, "fuel", 500));
    } catch (e: any) {
      setFuelError(e.message ?? String(e));
    } finally {
      setFuelLoading(false);
    }
  };

  // An welcher Stelle der Wegpunktliste passt der POI geografisch am besten?
  // Wir projizieren den POI auf die berechnete Route und ordnen ihn dem Abschnitt
  // zu, in dem die Projektion liegt -> Einfügen direkt nach dessen Start-Wegpunkt.
  const insertIndexForPoi = (poi: Poi): number => {
    const line = routeLine(activeRoute);
    const legs = activeRoute?.legs ?? [];
    if (line.length < 2 || legs.length === 0) {
      return Math.max(1, waypoints.length - 1);
    }
    const dAlong = projectDistanceAlong(line, [poi.lng, poi.lat]);
    let cum = 0;
    for (let i = 0; i < legs.length; i++) {
      cum += legs[i].distanceM;
      if (dAlong <= cum) return i + 1;
    }
    return legs.length;
  };

  const togglePoi = (poi: Poi) => {
    const icon = poi.category === "fuel" ? "⛽" : "🍴";
    const insertAt = insertIndexForPoi(poi);
    setSelectedPois((s) => {
      const next = new Set(s);
      if (next.has(poi.id)) {
        next.delete(poi.id);
        setWaypoints((w) => w.filter((p) => p.id !== `poi-${poi.id}`));
      } else {
        next.add(poi.id);
        // An der geografisch passenden Stelle einfügen (vor/nach dem Wegpunkt).
        setWaypoints((w) => {
          const at = Math.min(Math.max(1, insertAt), w.length);
          const wp: Waypoint = {
            id: `poi-${poi.id}`,
            lng: poi.lng,
            lat: poi.lat,
            label: `${icon} ${poi.name}`,
            profile: defaultProfile,
          };
          return [...w.slice(0, at), wp, ...w.slice(at)];
        });
      }
      return next;
    });
  };

  // --- Wetter entlang der Strecke ---
  const searchWeather = async () => {
    const line = routeLine(activeRoute);
    if (line.length < 2) return;
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const res = await fetchWeather(line, weatherDate || undefined, 5);
      setWeather(res.points);
    } catch (e: any) {
      setWeatherError(e.message ?? String(e));
    } finally {
      setWeatherLoading(false);
    }
  };

  // Essen nach OSM-Qualität gefiltert (verifiziert + >= Schwelle).
  const filteredFood = useMemo(
    () => pois.filter((p) => p.verified && (p.quality ?? 0) >= minQuality),
    [pois, minQuality],
  );
  // Alle Marker für die Karte: gefiltertes Essen + Tankstellen.
  const mapPois = useMemo(
    () => [...filteredFood, ...fuelPois],
    [filteredFood, fuelPois],
  );

  // Wegpunkt-Markierungen fürs Höhenprofil (kumulierte Distanz + Buchstabe).
  const waypointMarks = useMemo(() => {
    const legs = activeRoute?.legs ?? [];
    if (!legs.length) return [] as { atM: number; label: string }[];
    const letter = (i: number) => String.fromCharCode(65 + i);
    const marks = [{ atM: 0, label: letter(0) }];
    let cum = 0;
    for (let i = 0; i < legs.length; i++) {
      cum += legs[i].distanceM;
      const isReturn = roundTrip && i === legs.length - 1;
      marks.push({ atM: cum, label: isReturn ? letter(0) : letter(i + 1) });
    }
    return marks;
  }, [activeRoute, roundTrip]);

  // --- GPX-Export (für die Statusleiste unter der Karte) ---
  const exportGpx = () => {
    const track = routeLine(activeRoute);
    if (track.length < 2) return;
    const wpts = waypoints.map((w) => ({ lng: w.lng, lat: w.lat, name: w.label }));
    downloadGpx(track, wpts);
  };

  return (
    <div
      className="app"
      style={{ ["--sidebar-w" as string]: `${sidebarWidth}px` } as React.CSSProperties}
    >
      <TopBar />
      <Sidebar
        waypoints={waypoints}
        profile={defaultProfile}
        setProfile={setAllProfiles}
        setSegmentProfile={setSegmentProfile}
        roundTrip={roundTrip}
        setRoundTrip={setRoundTrip}
        locating={locating}
        onUseMyLocation={useMyLocation}
        onUpdateWaypoint={updateWaypoint}
        avoidConstruction={avoidConstruction}
        setAvoidConstruction={setAvoidConstruction}
        includeOsm={includeOsm}
        setIncludeOsm={setIncludeOsm}
        roadworks={roadworks}
        disabledRoadworks={disabledRoadworks}
        toggleRoadwork={toggleRoadwork}
        route={route}
        pois={filteredFood}
        foodTotal={pois.length}
        selectedPois={selectedPois}
        poiLoading={poiLoading}
        poiError={poiError}
        onSearchPois={searchPois}
        minQuality={minQuality}
        setMinQuality={setMinQuality}
        fuelPois={fuelPois}
        fuelLoading={fuelLoading}
        fuelError={fuelError}
        onSearchFuel={searchFuel}
        weatherDate={weatherDate}
        setWeatherDate={setWeatherDate}
        weather={weather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
        onSearchWeather={searchWeather}
        onTogglePoi={togglePoi}
        onAddWaypoint={addWaypoint}
        onRemoveWaypoint={removeWaypoint}
        onMoveWaypoint={moveWaypoint}
        onClearWaypoints={() => {
          setWaypoints([]);
          setSelectedPois(new Set());
          setPois([]);
          setFuelPois([]);
          setWeather([]);
        }}
      />
      <div className="resizer" onMouseDown={startResize} title="Breite ziehen" />
      <div className="main">
        <MapView
          waypoints={waypoints}
          route={activeRoute}
          allRoutes={allRoutes}
          selectedRouteIdx={selectedRouteIdx}
          onSelectRoute={setSelectedRouteIdx}
          roadworks={roadworks}
          disabledRoadworks={disabledRoadworks}
          avoidConstruction={avoidConstruction}
          pois={mapPois}
          selectedPois={selectedPois}
          weather={weather}
          hoverM={hoverM}
          onHoverM={setHoverM}
          onMapClick={(lng, lat) => addWaypoint(lng, lat)}
          onTogglePoi={togglePoi}
        />
        <StatusBar
          route={activeRoute}
          routeLoading={routeLoading}
          routeError={routeError}
          waypointMarks={waypointMarks}
          allRoutes={allRoutes}
          selectedRouteIdx={selectedRouteIdx}
          onSelectRoute={setSelectedRouteIdx}
          hoverM={hoverM}
          onHoverM={setHoverM}
          onExportGpx={exportGpx}
        />
      </div>
    </div>
  );
}
