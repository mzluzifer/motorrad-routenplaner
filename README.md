# 🏍️ Motorrad-Routenplaner

Open-Source Web-App zum Planen von Motorradtouren: Route von A nach B (optional als
Rundtour), beliebig viele Zwischenziele – per **Eingabefeld** (Adresse/Ort tippen)
oder Karten-Klick gesetzt, Start optional per **aktuellem Standort**. Profil
**Schnell / Kurvig** wahlweise global **oder pro Abschnitt** zwischen zwei Wegpunkten
(Kurvig meidet Städte & Dörfer), Vermeidung aktueller **Baustellen** (einzeln
übersteuerbar), Auswahl von **Restaurants/Imbissen** entlang der Strecke und
**GPX-Export** für Navi/Handy (OsmAnd, Calimoto, Garmin …). Große, zoombare Karte.

Alles basiert auf Open-Source-Bausteinen und offenen Daten (OpenStreetMap, BRouter,
MapLibre, OpenFreeMap, Overpass, Nominatim, Autobahn-GmbH-API).

## Architektur

```
Browser (React + MapLibre)
   │  REST  (/api/*)
   ▼
Backend (Node/Fastify)  ──►  BRouter (Routing-Engine)
   ├─ /api/route       Profil(e) hochladen + nogo-Sperrzonen + Routing (pro Abschnitt)
   ├─ /api/geocode     Adresssuche (Nominatim)
   ├─ /api/reverse     Standort -> Adresse (Nominatim, „aktueller Standort")
   ├─ /api/roadworks   Baustellen (Autobahn-GmbH-API + OSM/Overpass)
   ├─ /api/pois        Restaurants/Imbisse im Puffer um die Route (Overpass)
   └─ /api/gpx         Track + Wegpunkte -> GPX-Datei
```

## Einfachster Start: fertige Windows-EXE 🪟

Eine einzige Datei, kein Node/Docker/Terminal nötig:

```bash
npm install
npm run package:win
```

Das erzeugt **`desktop/Routenplaner.exe`**. Doppelklick startet die App und öffnet
automatisch den Browser (`http://localhost:8080`). Die EXE enthält Backend, Frontend
und die Profile; fürs Routing wird standardmäßig die öffentliche BRouter-Instanz
genutzt (kein Setup von Routing-Daten nötig).

> Hinweise:
> - Beim ersten Start meldet sich evtl. der Windows-SmartScreen („Unbekannter
>   Herausgeber"), weil die EXE nicht signiert ist → *Weitere Informationen → Trotzdem
>   ausführen*.
> - Zum Beenden einfach das Konsolenfenster schließen.
> - Eigene Einstellungen (z. B. selbst gehosteten BRouter) per Umgebungsvariablen,
>   etwa `set BROUTER_URL=http://localhost:17777/brouter` vor dem Start.

## Schnellstart (ohne Docker, zum Ausprobieren)

Nutzt die **öffentliche** BRouter-Instanz – kein Setup von Routing-Daten nötig.

```bash
npm install

# Backend: öffentliche BRouter-Instanz verwenden
cd backend
# .env anlegen (siehe .env.example) ODER Variablen direkt setzen:
#   BROUTER_URL=https://brouter.de/brouter
#   CONTACT_EMAIL=deine@echte-mail.de   (NICHT example.com – das blockt Nominatim!)
npm run dev

# In einem zweiten Terminal: Frontend
cd frontend
npm run dev      # http://localhost:5173
```

Oder beides zusammen vom Projekt-Root: `npm run dev`
(setze vorher `BROUTER_URL`/`CONTACT_EMAIL` in `backend/.env`).

## Voller Betrieb (selbst gehostetes Routing per Docker)

Für volle Kontrolle über die Profile und unabhängig von öffentlichen Limits.

1. **Routing-Daten herunterladen** – die rd5-Kacheln für dein Fahrgebiet von
   <https://brouter.de/brouter/segments4/> nach `./brouter-data/segments4/` legen
   (z. B. `E5_45.rd5`, `E10_45.rd5` für Süddeutschland).

2. **Starten:**
   ```bash
   docker compose up --build
   ```
   - BRouter läuft auf `:17777`, Backend auf `:8080`.
   - Frontend separat: `npm run dev:frontend` (Vite proxyt `/api` ans Backend).

   Das Backend ist im Compose bereits auf `BROUTER_URL=http://brouter:17777/brouter`
   gesetzt. Trage in der `backend`-Umgebung deine echte `CONTACT_EMAIL` ein.

## Routenprofile

Die Profile liegen als BRouter-Dateien in `backend/brouter-profiles/`:

- **`moto-fast.brf`** – bevorzugt schnelle, durchgängige Straßen, bestraft Zickzack.
- **`moto-curvy.brf`** – bevorzugt kurvige Land-/Nebenstraßen, niedrige Abbiegekosten,
  und **meidet Ortschaften** über hohe Kosten für `residential` / `living_street` /
  `service`. So führt die Route nicht durch Dörfer, nur weil es dort kurvig aussieht.

Die Zahlenwerte sind bewusst einfach gehalten und können in den `.brf`-Dateien
nachjustiert werden. Das Backend lädt das jeweilige Profil automatisch zum
BRouter-Server hoch und referenziert es beim Routing.

**Profil pro Abschnitt:** In der App lässt sich das Profil nicht nur global (als
Vorgabe für alle Teilstrecken) setzen, sondern zwischen je zwei Wegpunkten einzeln
auf ⚡ Schnell oder 🌀 Kurvig stellen. Das Backend bündelt aufeinanderfolgende
Abschnitte gleichen Profils, routet sie über BRouter und fügt die Teilstücke zu
einem durchgehenden Track zusammen (auch der Rückweg bei Rundtour ist eigen
einstellbar).

## Baustellen

`/api/roadworks` aggregiert für den Routenbereich:

- **Autobahn-GmbH-API** – zuverlässige Echtzeit-Baustellen auf Autobahnen (gecacht).
- **OSM/Overpass** (`highway=construction`) – auch Land-/Nebenstraßen, Datenlage
  jedoch lückenhaft und nicht immer top-aktuell (per Schalter abschaltbar).

In der App: globaler Schalter **„Baustellen meiden"** plus pro Baustelle ein Häkchen,
um einzelne Baustellen doch zu befahren. Aktive Baustellen werden als BRouter-`nogo`
übergeben, sodass die Route außen herum führt.

## Einkehr (Restaurants/Imbisse)

Nach der Routenberechnung „Entlang der Strecke suchen" – findet `restaurant`,
`fast_food` und `cafe` im 500-m-Puffer um die Route (Overpass). Auswahl fügt den Ort
als Zwischenziel ein, die Route wird neu berechnet.

## Konfiguration (Backend, `.env`)

| Variable        | Bedeutung                                   | Default |
|-----------------|---------------------------------------------|---------|
| `PORT`          | Backend-Port                                | `8080` |
| `BROUTER_URL`   | BRouter-Endpunkt                            | `http://localhost:17777/brouter` |
| `OVERPASS_URL`  | Overpass-API                                | `https://overpass-api.de/api/interpreter` |
| `NOMINATIM_URL` | Geocoding                                   | `https://nominatim.openstreetmap.org` |
| `AUTOBAHN_URL`  | Autobahn-GmbH-API                           | `https://verkehr.autobahn.de/o/autobahn` |
| `CONTACT_EMAIL` | Kontakt im User-Agent (Fair-Use)            | – |

> **Wichtig:** Nominatim blockt User-Agents mit `example.com`. Trage eine echte
> Kontakt-Adresse ein, sonst schlägt die Adresssuche mit `403` fehl.

> **Fair-Use:** Die öffentlichen Overpass-/Nominatim-Instanzen haben Nutzungslimits.
> Für regelmäßige/intensive Nutzung später eigene Instanzen hosten und die URLs
> in der `.env` anpassen.

## Tech-Stack

React · TypeScript · Vite · MapLibre GL · OpenFreeMap · Fastify · Turf.js · BRouter ·
OpenStreetMap (Overpass, Nominatim) · Autobahn-GmbH-API.
