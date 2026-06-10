# 🏍️ Planificador de Rutas para Moto

[🇩🇪 Deutsch](README.md) · [🇬🇧 English](README.en.md) · **🇪🇸 Español**

Aplicación web de código abierto para planificar rutas en moto: una ruta de A a B
(opcionalmente como viaje de ida y vuelta), con cualquier número de paradas intermedias
– fijadas mediante un **campo de entrada** (escribe una dirección/lugar) o haciendo clic
en el mapa, con el punto de partida tomado opcionalmente de tu **ubicación actual**.
Elige un perfil **Rápido / Con curvas / Autopista** ya sea de forma global **o por tramo**
entre dos puntos de ruta (Con curvas evita ciudades y pueblos, Autopista es el más
rápido); la **distancia y el tiempo de viaje de cada tramo** se muestran directamente en
el punto de ruta. Evitación de **obras** actuales (menú plegable, anulable
individualmente), selección de **restaurantes/puestos de comida y gasolineras** a lo largo
de la ruta (información al **pasar el ratón por encima**, un clic los inserta en la
**posición geográficamente adecuada**) y **exportación GPX** para tu navegador/móvil
(OsmAnd, Calimoto, Garmin …). Además, **el tiempo a lo largo de la ruta** (hoy o en una
fecha concreta), **peajes y ferris** y un **perfil de altitud** en la **barra de estado
debajo del mapa** (con distancia total, tiempo de viaje y exportación). Un mapa grande y
ampliable con una **barra lateral de ancho ajustable**.

Todo se basa en componentes de código abierto y datos abiertos (OpenStreetMap, BRouter,
MapLibre, OpenFreeMap, Overpass, Nominatim, API de Autobahn-GmbH).

## Captura de pantalla

![La app: campos de entrada de puntos de ruta con perfiles por tramo, mapa con la ruta y barra de estado](docs/screenshot.jpg)

*Viaje de ida y vuelta Ulm (A) ↔ Blaubeuren (B): a la izquierda los puntos de ruta como
campos de entrada con conmutadores ⚡/🌀 por tramo, perfil predeterminado y opciones de
obras; a la derecha la ruta con curvas en el mapa; abajo la barra de estado permanente con
distancia, tiempo de viaje y exportación GPX.*

## Arquitectura

```
Navegador (React + MapLibre)
   │  REST  (/api/*)
   ▼
Backend (Node/Fastify)  ──►  BRouter (motor de enrutamiento)
   ├─ /api/route       subir perfil(es) + zonas de exclusión nogo + enrutamiento (por tramo)
   ├─ /api/geocode     búsqueda de direcciones (Nominatim)
   ├─ /api/reverse     ubicación -> dirección (Nominatim, «ubicación actual»)
   ├─ /api/roadworks   obras (API de Autobahn-GmbH + OSM/Overpass)
   ├─ /api/pois        restaurantes/puestos de comida + gasolineras dentro del búfer (Overpass)
   ├─ /api/weather     tiempo diario en puntos de muestreo a lo largo de la ruta (Open-Meteo)
   └─ /api/gpx         traza + puntos de ruta -> archivo GPX

El enrutamiento devuelve además distancia/tiempo por tramo, el perfil de altitud así como
los tramos de peaje/ferri (a partir de las WayTags de BRouter).
```

## Inicio más sencillo: EXE de Windows lista para usar 🪟

Un único archivo, sin necesidad de Node/Docker/terminal:

```bash
npm install
npm run package:win
```

Esto genera **`desktop/Routenplaner.exe`**. Hacer doble clic inicia la app y abre
automáticamente el navegador (`http://localhost:8080`). El EXE contiene el backend, el
frontend y los perfiles; para el enrutamiento utiliza por defecto la instancia pública de
BRouter (no hace falta configurar datos de enrutamiento).

> Notas:
> - En el primer arranque puede aparecer Windows SmartScreen («Editor desconocido»)
>   porque el EXE no está firmado → *Más información → Ejecutar de todas formas*.
> - Para salir, simplemente cierra la ventana de la consola.
> - Establece tus propias opciones (p. ej. un BRouter autoalojado) mediante variables de
>   entorno, como `set BROUTER_URL=http://localhost:17777/brouter` antes de iniciar.

Hay EXEs listos para descargar en
[Releases](https://github.com/mzluzifer/motorrad-routenplaner/releases). Un flujo de
trabajo de GitHub Actions ([`.github/workflows/build-exe.yml`](.github/workflows/build-exe.yml))
construye el EXE automáticamente con cada nueva etiqueta de versión (`v*`) y lo adjunta al
release.

## Inicio rápido (sin Docker, para probarlo)

Utiliza la instancia **pública** de BRouter – no hace falta configurar datos de
enrutamiento.

```bash
npm install

# Backend: usar la instancia pública de BRouter
cd backend
# Crea .env (ver .env.example) O establece las variables directamente:
#   BROUTER_URL=https://brouter.de/brouter
#   CONTACT_EMAIL=tu@correo-real.com   (¡NO example.com – Nominatim lo bloquea!)
npm run dev

# En una segunda terminal: frontend
cd frontend
npm run dev      # http://localhost:5173
```

O ambos juntos desde la raíz del proyecto: `npm run dev`
(antes establece `BROUTER_URL`/`CONTACT_EMAIL` en `backend/.env`).

## Funcionamiento completo (enrutamiento autoalojado con Docker)

Para tener control total sobre los perfiles e independencia de los límites públicos.

1. **Descargar datos de enrutamiento** – coloca las teselas rd5 de tu zona de conducción
   desde <https://brouter.de/brouter/segments4/> en `./brouter-data/segments4/`
   (p. ej. `E5_45.rd5`, `E10_45.rd5` para el sur de Alemania).

2. **Iniciar:**
   ```bash
   docker compose up --build
   ```
   - BRouter se ejecuta en `:17777`, el backend en `:8080`.
   - Frontend por separado: `npm run dev:frontend` (Vite redirige `/api` al backend).

   El backend ya está configurado a `BROUTER_URL=http://brouter:17777/brouter` en Compose.
   Introduce tu `CONTACT_EMAIL` real en el entorno del `backend`.

## Perfiles de ruta

Los perfiles se almacenan como archivos de BRouter en `backend/brouter-profiles/`:

- **`moto-fast.brf`** – prefiere carreteras rápidas y continuas, penaliza los zigzags.
- **`moto-curvy.brf`** – prefiere carreteras secundarias/comarcales con curvas, costes de
  giro bajos, y **evita las zonas urbanizadas** mediante costes altos para `residential` /
  `living_street` / `service`. Así la ruta no pasa por los pueblos solo porque allí parezca
  haber curvas.
- **`moto-autobahn.brf`** – autopista/autovía claramente preferida, las carreteras más
  pequeñas solo como acceso. Para la conexión más rápida posible.

Los valores numéricos se mantienen deliberadamente sencillos y pueden ajustarse en los
archivos `.brf`. El backend sube automáticamente el perfil correspondiente al servidor de
BRouter y lo referencia durante el enrutamiento.

**Perfil por tramo:** En la app, el perfil puede establecerse no solo de forma global
(como valor predeterminado para todos los tramos), sino individualmente entre dos puntos
de ruta a ⚡ Rápido, 🌀 Con curvas o 🛣️ Autopista. El backend calcula cada tramo por
separado a través de BRouter, une los tramos en una traza continua y proporciona la
**distancia y el tiempo de viaje por tramo** (el tramo de vuelta en un viaje de ida y
vuelta también es configurable por separado). Los valores aparecen directamente en el
punto de ruta correspondiente.

## Obras

`/api/roadworks` agrega para la zona de la ruta:

- **API de Autobahn-GmbH** – obras en tiempo real fiables en autopistas (en caché).
- **OSM/Overpass** (`highway=construction`) – también carreteras secundarias/comarcales,
  pero la cobertura de datos es irregular y no siempre está actualizada (se puede
  desactivar con un interruptor).

En la app: un **menú de obras plegable** con un interruptor global **«evitar obras»** más,
por cada obra, una casilla para circular por obras concretas de todos modos. Las obras
activas se pasan a BRouter como `nogo`, de modo que la ruta las rodea.

## Paradas (restaurantes/puestos de comida) y gasolineras

Tras el cálculo de la ruta, «buscar a lo largo de la ruta» – encuentra `restaurant`,
`fast_food` y `cafe` dentro de un búfer de 500 m alrededor de la ruta (Overpass). En el
mapa, **pasar el ratón** por encima de un marcador muestra los detalles; un **clic**
inserta el lugar como parada intermedia – concretamente en la **posición geográficamente
adecuada** (entre los dos puntos de ruta cuyo tramo esté más cerca), no simplemente al
final. La ruta se recalcula. De forma análoga hay una **búsqueda de gasolineras**
(`amenity=fuel`): gasolineras reales y con nombre de OpenStreetMap, con marca y distancia
a la ruta.

Las consultas a Overpass se ejecutan mediante una **cadena de respaldo** de varios
servidores (ver más abajo).

**Calidad/«estrellas»:** Las valoraciones reales de usuarios/Google no existen en los
datos abiertos. En lugar de una integración (de pago, propietaria) con Google Places, se
muestra la **completitud de las etiquetas de OSM** (horario, sitio web, cocina,
dirección …) como una «calidad» de 0 a 5. Las entradas bien mantenidas cuentan como
«verificadas»; un control deslizante filtra por una calidad mínima (predeterminado 4,5).
Esto, de forma transparente, **no** es una valoración real, sino un indicador de calidad
de los datos.

## El tiempo a lo largo de la ruta

A través de **Open-Meteo** (gratis, sin clave de API) se consulta el **tiempo diario** en
varios puntos de muestreo a lo largo de la ruta – para **hoy** o una **fecha elegida**
(pasado mediante la API de archivo, pronóstico hasta ~16 días). Se muestra la situación
meteorológica (símbolo), el rango de temperatura, la precipitación y el viento – en la
barra lateral y como marcadores en el mapa (detalles al pasar el ratón).

## Peajes y ferris

A partir de las **WayTags de BRouter** (`processUnusedTags`), el backend detecta los
tramos `toll=yes` y `route=ferry` e informa de la posición y la longitud. En la app
aparecen como una lista propia (peaje 💶 / ferri ⛴️) y como marcadores en el mapa.

## Perfil de altitud e información de la ruta (barra de estado)

La distancia, el tiempo de viaje (estimado) y la **exportación GPX** están permanentemente
en una barra de estado **debajo del mapa**. En el centro – dinámicamente a lo ancho
completo – muestra el **perfil de altitud** de la ruta, incluidas las **marcas de los
puntos de ruta** (A, B, C …). Los datos de altitud provienen de la respuesta de BRouter.

## Ajustar el ancho de la barra lateral

Entre la barra lateral y el mapa hay una **barra de arrastre**: el ancho de la barra
lateral se puede ajustar libremente (se recuerda en el navegador).

## Configuración (backend, `.env`)

| Variable        | Significado                                      | Predeterminado |
|-----------------|--------------------------------------------------|---------|
| `PORT`          | Puerto del backend                               | `8080` |
| `BROUTER_URL`   | Endpoint de BRouter                              | `http://localhost:17777/brouter` |
| `OVERPASS_URL`  | API de Overpass (primera en la cadena de respaldo) | `https://overpass-api.de/api/interpreter` |
| `NOMINATIM_URL` | Geocodificación                                  | `https://nominatim.openstreetmap.org` |
| `AUTOBAHN_URL`  | API de Autobahn-GmbH                             | `https://verkehr.autobahn.de/o/autobahn` |
| `CONTACT_EMAIL` | Contacto en el User-Agent (uso justo)            | – |

> **Importante:** Nominatim bloquea los User-Agents con `example.com`. Introduce una
> dirección de contacto real, de lo contrario la búsqueda de direcciones falla con `403`.

> **Uso justo:** Las instancias públicas de Overpass/Nominatim tienen límites de uso. Para
> un uso regular/intensivo, aloja tus propias instancias más adelante y ajusta las URLs en
> `.env`.

> **Resiliencia de Overpass:** Las consultas de POI/gasolineras y de obras de OSM se
> ejecutan mediante una **cadena de respaldo** de varios servidores públicos de Overpass.
> Si uno no está accesible o está sobrecargado, se prueba automáticamente el siguiente; se
> prefiere el último que tuvo éxito. Si, excepcionalmente, todos están sobrecargados,
> aparece un mensaje claro en lugar de un críptico «fetch failed».

## Stack tecnológico

React · TypeScript · Vite · MapLibre GL · OpenFreeMap · Fastify · Turf.js · BRouter ·
OpenStreetMap (Overpass, Nominatim) · API de Autobahn-GmbH · Open-Meteo (tiempo).
