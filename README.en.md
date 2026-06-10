# 🏍️ Motorcycle Route Planner

[🇩🇪 Deutsch](README.md) · **🇬🇧 English** · [🇪🇸 Español](README.es.md)

Open-source web app for planning motorcycle tours: a route from A to B (optionally as a
round trip), with any number of intermediate stops – set via an **input field** (type an
address/place) or by clicking the map, with the start optionally taken from your
**current location**. Choose a **Fast / Curvy / Motorway** profile either globally **or
per section** between two waypoints (Curvy avoids towns & villages, Motorway is the
fastest); the **distance and travel time for each leg** are shown right at the waypoint.
Avoidance of current **roadworks** (collapsible menu, individually overridable),
selection of **restaurants/snack bars and fuel stations** along the route (info on
**mouse hover**, a click inserts them at the **geographically appropriate position**) and
**GPX export** for your sat-nav/phone (OsmAnd, Calimoto, Garmin …). On top of that,
**weather along the route** (today or on a chosen date), **tolls & ferries** and an
**elevation profile** in the **status bar below the map** (with total distance, travel
time and export). A large, zoomable map with a **horizontally resizable sidebar**.

Everything is built on open-source building blocks and open data (OpenStreetMap, BRouter,
MapLibre, OpenFreeMap, Overpass, Nominatim, Autobahn-GmbH API).

## Screenshot

![The app: waypoint input fields with per-section profiles, map with route and status bar](docs/screenshot.jpg)

*Round trip Ulm (A) ↔ Blaubeuren (B): on the left the waypoints as input fields with
⚡/🌀 toggles per leg, profile default and roadworks options; on the right the curvy
route on the map; at the bottom the persistent status bar with distance, travel time
and GPX export.*

## Architecture

```
Browser (React + MapLibre)
   │  REST  (/api/*)
   ▼
Backend (Node/Fastify)  ──►  BRouter (routing engine)
   ├─ /api/route       upload profile(s) + nogo exclusion zones + routing (per section)
   ├─ /api/geocode     address search (Nominatim)
   ├─ /api/reverse     location -> address (Nominatim, "current location")
   ├─ /api/roadworks   roadworks (Autobahn-GmbH API + OSM/Overpass)
   ├─ /api/pois        restaurants/snack bars + fuel stations within the buffer (Overpass)
   ├─ /api/weather     daily weather at sample points along the route (Open-Meteo)
   └─ /api/gpx         track + waypoints -> GPX file

Routing additionally returns distance/time per section, the elevation profile as well as
toll/ferry sections (from the BRouter WayTags).
```

## Easiest start: ready-made Windows EXE 🪟

A single file, no Node/Docker/terminal needed:

```bash
npm install
npm run package:win
```

This produces **`desktop/Routenplaner.exe`**. Double-clicking starts the app and
automatically opens the browser (`http://localhost:8080`). The EXE contains the backend,
frontend and the profiles; for routing it uses the public BRouter instance by default (no
setup of routing data needed).

> Notes:
> - On first launch Windows SmartScreen may appear ("Unknown publisher") because the EXE
>   is not signed → *More info → Run anyway*.
> - To quit, simply close the console window.
> - Set your own options (e.g. a self-hosted BRouter) via environment variables, such as
>   `set BROUTER_URL=http://localhost:17777/brouter` before starting.

Ready-made EXEs are available for download under
[Releases](https://github.com/mzluzifer/motorrad-routenplaner/releases). A GitHub Actions
workflow ([`.github/workflows/build-exe.yml`](.github/workflows/build-exe.yml)) builds the
EXE automatically on every new version tag (`v*`) and attaches it to the release.

## Quick start (without Docker, to try it out)

Uses the **public** BRouter instance – no setup of routing data needed.

```bash
npm install

# Backend: use the public BRouter instance
cd backend
# Create .env (see .env.example) OR set variables directly:
#   BROUTER_URL=https://brouter.de/brouter
#   CONTACT_EMAIL=your@real-mail.com   (NOT example.com – that gets blocked by Nominatim!)
npm run dev

# In a second terminal: frontend
cd frontend
npm run dev      # http://localhost:5173
```

Or both together from the project root: `npm run dev`
(first set `BROUTER_URL`/`CONTACT_EMAIL` in `backend/.env`).

## Full operation (self-hosted routing via Docker)

For full control over the profiles and independent of public limits.

1. **Download routing data** – place the rd5 tiles for your riding area from
   <https://brouter.de/brouter/segments4/> into `./brouter-data/segments4/`
   (e.g. `E5_45.rd5`, `E10_45.rd5` for southern Germany).

2. **Start:**
   ```bash
   docker compose up --build
   ```
   - BRouter runs on `:17777`, the backend on `:8080`.
   - Frontend separately: `npm run dev:frontend` (Vite proxies `/api` to the backend).

   The backend is already set to `BROUTER_URL=http://brouter:17777/brouter` in Compose.
   Enter your real `CONTACT_EMAIL` in the `backend` environment.

## Route profiles

The profiles are stored as BRouter files in `backend/brouter-profiles/`:

- **`moto-fast.brf`** – prefers fast, continuous roads, penalizes zig-zagging.
- **`moto-curvy.brf`** – prefers curvy country/back roads, low turn costs, and **avoids
  built-up areas** via high costs for `residential` / `living_street` / `service`. This
  way the route doesn't run through villages just because it looks curvy there.
- **`moto-autobahn.brf`** – motorway/expressway clearly preferred, smaller roads only as
  feeders. For the fastest possible connection.

The numeric values are deliberately kept simple and can be fine-tuned in the `.brf`
files. The backend automatically uploads the respective profile to the BRouter server and
references it during routing.

**Profile per section:** In the app, the profile can be set not only globally (as a
default for all legs) but individually between any two waypoints to ⚡ Fast, 🌀 Curvy or
🛣️ Motorway. The backend routes each section individually via BRouter, joins the legs into
one continuous track and provides the **distance and travel time per leg** (the return leg
on a round trip is separately configurable too). The values appear directly at the
respective waypoint.

## Roadworks

`/api/roadworks` aggregates for the route area:

- **Autobahn-GmbH API** – reliable real-time roadworks on motorways (cached).
- **OSM/Overpass** (`highway=construction`) – also country/back roads, but the data
  coverage is patchy and not always up to date (can be turned off via a switch).

In the app: a **collapsible roadworks menu** with a global **"avoid roadworks"** switch
plus, per roadwork, a checkbox to drive through individual roadworks after all. Active
roadworks are passed to BRouter as `nogo`, so the route goes around them.

## Stops (restaurants/snack bars) & fuel stations

After route calculation, "search along the route" – finds `restaurant`, `fast_food` and
`cafe` within a 500 m buffer around the route (Overpass). On the map, a **mouse hover**
over a marker shows the details; a **click** inserts the place as an intermediate stop –
specifically at the **geographically appropriate position** (between the two waypoints
whose leg is closest), not simply at the end. The route is recalculated. Similarly there
is a **fuel station search** (`amenity=fuel`): real, named fuel stations from
OpenStreetMap with brand and distance to the route.

The Overpass queries run through a **fallback chain** of several servers (see below).

**Quality/"stars":** Real user/Google ratings don't exist in open data. Instead of a
(paid, proprietary) Google Places integration, the **completeness of the OSM tags**
(opening hours, website, cuisine, address …) is shown as a 0–5 "quality". Well-maintained
entries count as "verified"; a slider filters for a minimum quality (default 4.5). This is
transparently **not** a real rating, but a data-quality indicator.

## Weather along the route

Via **Open-Meteo** (free, no API key) the **daily weather** is queried at several sample
points along the route – for **today** or a **chosen date** (past via the archive API,
forecast up to ~16 days). It shows the weather situation (symbol), temperature range,
precipitation and wind – in the sidebar and as markers on the map (details on hover).

## Tolls & ferries

From the **BRouter WayTags** (`processUnusedTags`) the backend detects `toll=yes` and
`route=ferry` sections and reports position and length. In the app they appear as a
separate list (toll 💶 / ferry ⛴️) and as map markers.

## Elevation profile & route information (status bar)

Distance, travel time (estimated) and the **GPX export** sit permanently in a status bar
**below the map**. In the center – dynamically across the full width – it shows the
**elevation profile** of the route including the **waypoint markers** (A, B, C …). The
elevation data comes from the BRouter response.

## Resize the sidebar horizontally

Between the sidebar and the map there's a **drag bar**: the width of the sidebar can be
freely adjusted (remembered in the browser).

## Configuration (backend, `.env`)

| Variable        | Meaning                                       | Default |
|-----------------|-----------------------------------------------|---------|
| `PORT`          | Backend port                                  | `8080` |
| `BROUTER_URL`   | BRouter endpoint                              | `http://localhost:17777/brouter` |
| `OVERPASS_URL`  | Overpass API (comes first in the fallback chain) | `https://overpass-api.de/api/interpreter` |
| `NOMINATIM_URL` | Geocoding                                     | `https://nominatim.openstreetmap.org` |
| `AUTOBAHN_URL`  | Autobahn-GmbH API                             | `https://verkehr.autobahn.de/o/autobahn` |
| `CONTACT_EMAIL` | Contact in the User-Agent (fair use)          | – |

> **Important:** Nominatim blocks User-Agents with `example.com`. Enter a real contact
> address, otherwise the address search fails with `403`.

> **Fair use:** The public Overpass/Nominatim instances have usage limits. For regular/
> intensive use, host your own instances later and adjust the URLs in `.env`.

> **Overpass resilience:** The POI/fuel-station and OSM roadworks queries run through a
> **fallback chain** of several public Overpass servers. If one is unreachable or
> overloaded, the next is tried automatically; the most recently successful one is
> preferred. If, exceptionally, all are overloaded, you get a clear message instead of a
> cryptic "fetch failed".

## Tech stack

React · TypeScript · Vite · MapLibre GL · OpenFreeMap · Fastify · Turf.js · BRouter ·
OpenStreetMap (Overpass, Nominatim) · Autobahn-GmbH API · Open-Meteo (weather).
