import { useEffect, useRef, useState } from "react";
import { geocode } from "../api/client";
import type { GeocodeResult } from "../types";

interface Props {
  /** Anfangstext (z. B. das aktuelle Wegpunkt-Label). */
  value: string;
  placeholder?: string;
  /** Nach Auswahl das Feld leeren (für „Wegpunkt hinzufügen"). */
  clearOnPick?: boolean;
  onPick: (r: GeocodeResult) => void;
}

/** Texteingabe mit Adresssuche (Nominatim) und Ergebnis-Dropdown. */
export default function GeoInput({ value, placeholder, clearOnPick, onPick }: Props) {
  const [text, setText] = useState(value);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);

  // Klick außerhalb schließt die Ergebnisliste.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q) return;
    setBusy(true);
    try {
      const r = await geocode(q);
      setResults(r);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    onPick(r);
    setOpen(false);
    setResults([]);
    setText(clearOnPick ? "" : r.label.split(",")[0]);
  };

  return (
    <div className="geo" ref={boxRef}>
      <form className="geo-row" onSubmit={search}>
        <input
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        <button className="geo-go" type="submit" disabled={busy} title="Adresse suchen">
          {busy ? "…" : "🔍"}
        </button>
      </form>
      {open && results.length > 0 && (
        <ul className="geo-results">
          {results.map((r, i) => (
            <li key={i} onClick={() => pick(r)} title={r.label}>
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
