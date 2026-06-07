// Fastify-Backend: orchestriert Routing (BRouter), POIs/Baustellen (Overpass +
// Autobahn-API), Geocoding (Nominatim) und GPX-Export.
import Fastify from "fastify";
import cors from "@fastify/cors";
import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config, packaged } from "./config.js";
import { route as brouterRoute } from "./services/brouter.js";
import { findPois } from "./services/overpass.js";
import { getRoadworks, bboxOf } from "./services/roadworks.js";
import { geocode, reverseGeocode } from "./services/geocode.js";
import { buildGpx, type GpxWaypoint } from "./services/gpx.js";
import { staticAsset, devPublicDir } from "./resources.js";
import type { LngLat, NoGo, ProfileName, RouteRequest } from "./types.js";

// In der gepackten EXE keinen Pino-Logger (vermeidet Worker-/Transport-Probleme).
const app = Fastify({ logger: !packaged });

app.get("/api/health", async () => ({ ok: true }));

// --- Routing ---------------------------------------------------------------
app.post<{ Body: RouteRequest }>("/api/route", async (req, reply) => {
  const { points, profile, profiles, nogos } = req.body ?? ({} as RouteRequest);
  if (!Array.isArray(points) || points.length < 2) {
    return reply.code(400).send({ error: "Mindestens zwei Punkte nötig." });
  }
  const norm = (p: unknown): ProfileName => (p === "fast" ? "fast" : "curvy");
  // Abschnittsprofile haben Vorrang; sonst einheitliches Profil auf alle Abschnitte.
  const profs: ProfileName[] =
    Array.isArray(profiles) && profiles.length
      ? profiles.map(norm)
      : new Array(points.length - 1).fill(norm(profile));
  try {
    const result = await brouterRoute(points, profs, nogos ?? []);
    return result;
  } catch (err: any) {
    req.log.error(err);
    return reply.code(502).send({ error: String(err.message ?? err) });
  }
});

// --- Geocoding -------------------------------------------------------------
app.get<{ Querystring: { q?: string } }>("/api/geocode", async (req, reply) => {
  const q = (req.query.q ?? "").trim();
  if (!q) return reply.code(400).send({ error: "Parameter q fehlt." });
  try {
    return await geocode(q);
  } catch (err: any) {
    return reply.code(502).send({ error: String(err.message ?? err) });
  }
});

// --- Reverse-Geocoding (aktueller Standort -> Adresse) --------------------
app.get<{ Querystring: { lat?: string; lng?: string } }>(
  "/api/reverse",
  async (req, reply) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.code(400).send({ error: "Parameter lat/lng fehlen." });
    }
    try {
      return await reverseGeocode(lat, lng);
    } catch (err: any) {
      return reply.code(502).send({ error: String(err.message ?? err) });
    }
  },
);

// --- Baustellen ------------------------------------------------------------
app.post<{ Body: { points: LngLat[]; includeOsm?: boolean } }>(
  "/api/roadworks",
  async (req, reply) => {
    const { points, includeOsm = true } = req.body ?? { points: [] };
    if (!Array.isArray(points) || points.length < 2) {
      return reply.code(400).send({ error: "Mindestens zwei Punkte nötig." });
    }
    try {
      return await getRoadworks(bboxOf(points), includeOsm);
    } catch (err: any) {
      req.log.error(err);
      return reply.code(502).send({ error: String(err.message ?? err) });
    }
  },
);

// --- POIs (Restaurants/Imbisse) -------------------------------------------
app.post<{
  Body: { line: LngLat[]; bufferM?: number; category?: "food" | "fuel" | "all" };
}>(
  "/api/pois",
  async (req, reply) => {
    const { line, bufferM = 500, category = "food" } = req.body ?? { line: [] };
    if (!Array.isArray(line) || line.length < 2) {
      return reply.code(400).send({ error: "Routen-Geometrie fehlt." });
    }
    try {
      return await findPois(line, { bufferM, category });
    } catch (err: any) {
      req.log.error(err);
      return reply.code(502).send({ error: String(err.message ?? err) });
    }
  },
);

// --- GPX-Export ------------------------------------------------------------
app.post<{ Body: { track: LngLat[]; waypoints?: GpxWaypoint[]; name?: string } }>(
  "/api/gpx",
  async (req, reply) => {
    const { track, waypoints = [], name } = req.body ?? { track: [] };
    if (!Array.isArray(track) || track.length < 2) {
      return reply.code(400).send({ error: "Track fehlt." });
    }
    const gpx = buildGpx(track, waypoints, name);
    reply
      .header("Content-Type", "application/gpx+xml")
      .header("Content-Disposition", `attachment; filename="route.gpx"`)
      .send(gpx);
  },
);

// --- Statisches Frontend ausliefern ---------------------------------------
// In der EXE aus eingebetteten Assets, im Dev-Betrieb optional aus frontend/dist.
const serveStatic = packaged || existsSync(devPublicDir);
if (serveStatic) {
  const mime: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    ico: "image/x-icon",
    map: "application/json",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    txt: "text/plain; charset=utf-8",
  };
  const contentType = (p: string) => mime[p.split(".").pop() ?? ""] ?? "application/octet-stream";

  app.get("/*", async (req, reply) => {
    let p = (req.url.split("?")[0] || "/").slice(1);
    if (p === "") p = "index.html";
    let buf = packaged ? staticAsset(p) : null;
    if (!buf && !packaged) {
      const f = join(devPublicDir, p);
      if (existsSync(f)) buf = await readFile(f);
    }
    // SPA-Fallback: unbekannte Pfade liefern index.html
    if (!buf) {
      buf = packaged
        ? staticAsset("index.html")
        : await readFile(join(devPublicDir, "index.html")).catch(() => null);
      p = "index.html";
    }
    if (!buf) return reply.code(404).send("Not found");
    return reply.header("Content-Type", contentType(p)).send(buf);
  });
}

// --- Start mit Port-Fallback + Browser öffnen -----------------------------
async function start() {
  await app.register(cors, { origin: true });
  const candidates = [config.port, 8081, 8082, 8090, 3000];
  for (const port of candidates) {
    try {
      await app.listen({ port, host: "127.0.0.1" });
      const url = `http://localhost:${port}`;
      if (packaged) {
        console.log(`\n  🏍️  Motorrad-Routenplaner läuft: ${url}\n  (zum Beenden dieses Fenster schließen)\n`);
        openBrowser(url);
      } else {
        app.log.info(`Backend läuft auf ${url}`);
      }
      return;
    } catch (err: any) {
      if (err?.code === "EADDRINUSE") continue;
      console.error(err);
      process.exit(1);
    }
  }
  console.error("Kein freier Port gefunden.");
  process.exit(1);
}

function openBrowser(url: string) {
  const platform = process.platform;
  const cmd =
    platform === "win32"
      ? `start "" "${url}"`
      : platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => { /* Browser-Start ist best effort */ });
}

start();
