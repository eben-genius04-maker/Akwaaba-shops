"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { ACCRA_CENTER, GHANA_BOUNDS, isInGhana, type LatLng } from "@/lib/delivery";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type SearchResult = { display_name: string; lat: string; lon: string };

// Pin in the brand colour, drawn with SVG so no marker image files are needed
const PIN_HTML =
  '<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="#0b6e4f" stroke="#fff" stroke-width="2.5"/>' +
  '<circle cx="17" cy="17" r="5.5" fill="#e3a03a"/></svg>';

// A map where the user drops/drags a pin, uses their phone's GPS, or searches
// for a place. OpenStreetMap tiles via Leaflet.
export function LocationPicker({
  value,
  onChange,
  height = 320,
  invalid,
  label = "Location",
}: {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  height?: number;
  invalid?: boolean;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placeRef = useRef<(p: LatLng, zoom?: boolean) => void>(() => {});
  const onChangeRef = useRef(onChange);
  const initialValue = useRef(value);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the map once (Leaflet needs the browser, so it's loaded here)
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const start = initialValue.current;
      map = L.map(containerRef.current, {
        center: start ?? ACCRA_CENTER,
        zoom: start ? 16 : 12,
        maxBounds: L.latLngBounds([GHANA_BOUNDS.minLat - 0.5, GHANA_BOUNDS.minLng - 0.5], [GHANA_BOUNDS.maxLat + 0.5, GHANA_BOUNDS.maxLng + 0.5]),
        minZoom: 6,
        scrollWheelZoom: false, // so the page still scrolls normally
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [34, 44], iconAnchor: [17, 43] });

      const place = (p: LatLng, zoom = false) => {
        if (!map) return;
        if (!isInGhana(p)) {
          setNotice("That spot is outside Ghana. Please pick a location in Ghana.");
          return;
        }
        setNotice(null);
        const rounded = { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
        if (markerRef.current) {
          markerRef.current.setLatLng(rounded);
        } else {
          const marker = L.marker(rounded, { icon, draggable: true, keyboard: true, title: "Drag to adjust" }).addTo(map);
          marker.on("dragend", () => {
            const ll = marker.getLatLng();
            if (!isInGhana({ lat: ll.lat, lng: ll.lng })) {
              setNotice("That spot is outside Ghana. Please pick a location in Ghana.");
              return;
            }
            setNotice(null);
            onChangeRef.current({ lat: Math.round(ll.lat * 1e6) / 1e6, lng: Math.round(ll.lng * 1e6) / 1e6 });
          });
          markerRef.current = marker;
        }
        if (zoom) map.setView(rounded, Math.max(map.getZoom(), 16));
        onChangeRef.current(rounded);
      };
      placeRef.current = place;

      if (start) {
        markerRef.current = null;
        place(start);
      }
      map.on("click", (e) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Pin removed from outside (e.g. "Remove pin")
  useEffect(() => {
    if (!value && markerRef.current && mapRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [value]);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setNotice("Your browser can't share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        placeRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
        if (pos.coords.accuracy > 100) {
          setNotice(`Your location is accurate to about ${Math.round(pos.coords.accuracy)} m. Drag the pin to the exact spot if needed.`);
        }
      },
      (err) => {
        setLocating(false);
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was blocked. Allow location for this site, or tap the map instead."
            : "We couldn't get your location. Tap the map to drop the pin instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    setResults(null);
    try {
      // OpenStreetMap place search: only on button press (fair-use rules)
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=gh&limit=5&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data: SearchResult[] = res.ok ? await res.json() : [];
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the settings form
                search();
              }
            }}
            placeholder="Search a place, e.g. Teshie Nungua Estates"
            aria-label="Search for a place"
            className={cn(inputClass, "pl-9")}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={search} disabled={searching || query.trim().length < 3}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            Search
          </Button>
          <Button type="button" variant="secondary" onClick={locateMe} disabled={locating || !ready}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Crosshair className="h-4 w-4" aria-hidden="true" />}
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        </div>
      </div>

      {results && (
        <div className="rounded-lg border border-line bg-surface text-sm">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-muted">No places found. Try a nearby landmark, or tap the map.</p>
          ) : (
            <ul className="divide-y divide-line">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-paper"
                    onClick={() => {
                      placeRef.current({ lat: Number(r.lat), lng: Number(r.lon) }, true);
                      setResults(null);
                    }}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span>{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        className={cn("relative overflow-hidden rounded-xl border bg-paper", invalid ? "border-danger" : "border-line-strong")}
        style={{ height }}
      >
        <div ref={containerRef} className="absolute inset-0 z-0" role="application" aria-label={`${label} map. Click to drop a pin.`} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading map…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-muted">
          {value ? (
            <>Pin at {value.lat.toFixed(5)}, {value.lng.toFixed(5)} · drag it to adjust</>
          ) : (
            <>Tap or click the map to drop a pin.</>
          )}
        </p>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 font-medium text-muted hover:text-danger">
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove pin
          </button>
        )}
      </div>
      {notice && <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning" role="status">{notice}</p>}
    </div>
  );
}
