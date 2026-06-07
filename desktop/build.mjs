// Baut eine eigenständige Windows-EXE des Motorrad-Routenplaners.
//
// Ablauf:
//   1. Frontend bauen (Vite -> frontend/dist)
//   2. Backend mit esbuild zu einer einzelnen CJS-Datei bündeln
//   3. Frontend-Dateien + BRouter-Profile als SEA-Assets einsammeln
//   4. Node Single Executable Application (SEA) erzeugen
//   5. node.exe kopieren und den SEA-Blob hineininjizieren (postject)
//
// Ergebnis:  desktop/Routenplaner.exe  (Doppelklick -> Browser öffnet sich)

import { build as esbuild } from "esbuild";
import { execFileSync, execSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  cpSync,
  copyFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "desktop", "build");
const exePath = join(root, "desktop", "Routenplaner.exe");
const SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

// npm/npx über die Shell (mit Quoting), damit .cmd-Wrapper unter Windows laufen.
function sh(cmdline) {
  console.log(`\n> ${cmdline}`);
  execSync(cmdline, { stdio: "inherit", cwd: root });
}
// Node-Aufrufe direkt (kein Shell -> Leerzeichen im Node-Pfad sind unkritisch).
function node(args) {
  console.log(`\n> node ${args.join(" ")}`);
  execFileSync(process.execPath, args, { stdio: "inherit", cwd: root });
}
const q = (s) => `"${s}"`;

/** Alle Dateien unter dir rekursiv (absolute Pfade). */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

console.log("=== 1/5  Frontend bauen ===");
sh("npm run build --workspace frontend");

console.log("=== 2/5  Backend bündeln (esbuild) ===");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
await esbuild({
  entryPoints: [join(root, "backend", "src", "index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  outfile: join(outDir, "server.cjs"),
  // node:-Builtins (inkl. node:sea) bleiben extern.
  banner: { js: "/* Motorrad-Routenplaner – gebündeltes Backend */" },
  logLevel: "info",
});

console.log("=== 3/5  Assets einsammeln ===");
const assets = {};
// Frontend
const distDir = join(root, "frontend", "dist");
for (const f of walk(distDir)) {
  const rel = relative(distDir, f).split("\\").join("/");
  assets[`public/${rel}`] = f;
}
// BRouter-Profile
const profDir = join(root, "backend", "brouter-profiles");
for (const f of readdirSync(profDir)) {
  assets[`brouter-profiles/${f}`] = join(profDir, f);
}
console.log(`  ${Object.keys(assets).length} Assets`);

const seaConfig = {
  main: join(outDir, "server.cjs"),
  output: join(outDir, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets,
};
const seaConfigPath = join(outDir, "sea-config.json");
writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

console.log("=== 4/5  SEA-Blob erzeugen ===");
node(["--experimental-sea-config", seaConfigPath]);

console.log("=== 5/5  EXE erzeugen (node.exe kopieren + Blob injizieren) ===");
copyFileSync(process.execPath, exePath);
sh(
  `npx --yes postject ${q(exePath)} NODE_SEA_BLOB ${q(join(outDir, "sea-prep.blob"))} ` +
    `--sentinel-fuse ${SENTINEL}`,
);

console.log(`\n✅ Fertig:  ${exePath}`);
console.log("   Doppelklick startet die App und öffnet den Browser.");
