import React, { useEffect, useRef, useState } from "react";
import {
  LayersControl,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Fix Leaflet default marker icons in bundlers (Vite/React)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Smaller pin
const smallIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [18, 30],
  iconAnchor: [9, 30],
  popupAnchor: [0, -30],
  shadowSize: [30, 30],
});

function normalizeText(v) {
  return String(v || "").trim();
}

function buildGeocodeQuery(base, { city, state, zip }) {
  const parts = [normalizeText(base)];
  const c = normalizeText(city);
  const s = normalizeText(state);
  const z = normalizeText(zip);

  if (c) parts.push(c);
  if (s) parts.push(s);
  if (z) parts.push(z);

  return parts.filter(Boolean).join(", ");
}

async function nominatimSearch(q, signal) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=" +
    encodeURIComponent(q);

  const resp = await fetch(url, {
    method: "GET",
    signal,
    headers: { "Accept-Language": "en" },
  });

  if (!resp.ok) throw new Error(`Geocoding failed (${resp.status})`);

  const json = await resp.json();
  const list = Array.isArray(json) ? json : [];

  return list
    .map((r) => {
      const lat = Number(r?.lat);
      const lng = Number(r?.lon);
      const label = r?.display_name || "";
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, label };
    })
    .filter(Boolean);
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView([center.lat, center.lng], zoom || map.getZoom(), {
      animate: true,
    });
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onPick }) {
  const map = useMap();
  useEffect(() => {
    function handler(e) {
      const lat = e?.latlng?.lat;
      const lng = e?.latlng?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        onPick?.({ lat, lng });
      }
    }
    map.on("click", handler);
    return () => map.off("click", handler);
  }, [map, onPick]);
  return null;
}

export function MapPickerModal({
  isOpen,
  title = "Pick on Map (OpenStreetMap)",
  addressQuery = "",
  contextCity = "",
  contextState = "",
  contextZip = "",
  fallbackCenter = { lat: 32.7767, lng: -96.797 },
  initialZoom = 16,
  onClose,
  onPick,
}) {
  const [query, setQuery] = useState(addressQuery || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null); // {lat,lng,label}
  const [center, setCenter] = useState(fallbackCenter);

  const abortRef = useRef(null);

  async function runSearch(inputQuery) {
    const q = normalizeText(inputQuery ?? query);

    setError("");
    setResults([]);

    if (!q) {
      setError("Type an address or place to search.");
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);

    try {
      // Declare list ONCE so scope is always correct
      let list = await nominatimSearch(q, controller.signal);

      // Fallback: try looser query (raw input field) if first returns empty
      if (!list.length) {
        const loose = normalizeText(query);
        if (loose && loose !== q) {
          list = await nominatimSearch(loose, controller.signal);
        }
      }

      // Guard: never touch list[0] if empty
      if (!list.length) {
        setSelected(null);
        setCenter(fallbackCenter);
        setError(
          "No results found. Try adding street type (St/Ave/Blvd) or simplifying the search.",
        );
        return;
      }

      setResults(list);
      setCenter({ lat: list[0].lat, lng: list[0].lng });
      setSelected({ lat: list[0].lat, lng: list[0].lng, label: list[0].label });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  // Auto-search on open using address + company context
  useEffect(() => {
    if (!isOpen) return;

    setQuery(addressQuery || "");
    setResults([]);
    setSelected(null);
    setError("");

    const auto = buildGeocodeQuery(addressQuery, {
      city: contextCity,
      state: contextState,
      zip: contextZip,
    });

    if (auto) runSearch(auto);
    else setCenter(fallbackCenter);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, addressQuery, contextCity, contextState, contextZip]);

  function chooseResult(r) {
    setSelected({ lat: r.lat, lng: r.lng, label: r.label });
    setCenter({ lat: r.lat, lng: r.lng });
  }

  function confirmPick() {
    const lat = selected?.lat;
    const lng = selected?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      setError("Click the map to drop a pin, or select a result first.");
      return;
    }
    onPick?.({ lat, lng });
    onClose?.();
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal card">
        <div className="row space-between" style={{ alignItems: "center" }}>
          <div className="h2" style={{ margin: 0 }}>
            {title}
          </div>
          <button className="btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="stack" style={{ marginTop: 10 }}>
          <div className="muted">
            Search the address, then click the map (or drag the pin) to set the
            exact spot.
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 260 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address or place…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q2 = buildGeocodeQuery(query, {
                    city: contextCity,
                    state: contextState,
                    zip: contextZip,
                  });
                  runSearch(q2);
                }
              }}
            />

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                const q2 = buildGeocodeQuery(query, {
                  city: contextCity,
                  state: contextState,
                  zip: contextZip,
                });
                runSearch(q2);
              }}
              disabled={busy}
            >
              {busy ? "Searching..." : "Search"}
            </button>
          </div>

          {error ? <div className="muted">{error}</div> : null}

          {results.length ? (
            <div className="stack">
              <div className="muted">Results:</div>
              <div className="stack" style={{ gap: 6 }}>
                {results.map((r, idx) => (
                  <button
                    key={`${r.lat},${r.lng},${idx}`}
                    className="btn"
                    type="button"
                    onClick={() => chooseResult(r)}
                    title={r.label}
                    style={{ textAlign: "left" }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="map-wrap map-crosshair">
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={initialZoom}
              scrollWheelZoom
              style={{ height: 360, width: "100%", borderRadius: 14 }}
            >
              <Recenter center={center} zoom={initialZoom} />

              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Streets (OpenStreetMap)">
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="Satellite (Esri World Imagery)">
                  <TileLayer
                    attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <MapClickHandler
                onPick={({ lat, lng }) =>
                  setSelected({ lat, lng, label: "Pinned location" })
                }
              />

              {selected?.lat != null && selected?.lng != null ? (
                <Marker
                  icon={smallIcon}
                  position={[selected.lat, selected.lng]}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e?.target?.getLatLng?.();
                      if (ll?.lat != null && ll?.lng != null) {
                        setSelected({
                          lat: ll.lat,
                          lng: ll.lng,
                          label: "Pinned location",
                        });
                      }
                    },
                  }}
                />
              ) : null}
            </MapContainer>
          </div>

          <div className="row space-between" style={{ marginTop: 6 }}>
            <div className="muted">
              {selected ? (
                <>
                  Selected:{" "}
                  <code>
                    {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
                  </code>
                </>
              ) : (
                "No point selected yet."
              )}
            </div>

            <button
              className="btn btn-primary"
              type="button"
              onClick={confirmPick}
            >
              Use these coordinates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
