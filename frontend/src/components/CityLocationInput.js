import { useEffect, useMemo, useRef, useState } from "react";
import citiesData from "indian-cities-json";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

function normalize(str) {
  return String(str ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function decodeCity(item) {
  // indian-cities-json package shape varies by version; normalize to {name, state, lat, lng}
  const name = item.city || item.name || item.place || item.city_name || item.CITY || "";
  const state = item.state || item.region || item.ST || item.state_name || "";
  const lat = Number(item.latitude ?? item.lat ?? item.Latitude ?? item.LAT);
  const lng = Number(item.longitude ?? item.lng ?? item.Longitude ?? item.LNG);

  return {
    name: String(name),
    state: String(state),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

export default function CityLocationInput({
  value,
  onChange,
  coordinates,
  onCoordinatesChange,
  placeholder = "Enter city",
  maxSuggestions = 8,
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [status, setStatus] = useState("");

  const rootRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Close dropdown on outside click / escape
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const allCities = useMemo(() => {
    // If package exports directly as array
    const raw = Array.isArray(citiesData) ? citiesData : citiesData?.cities || citiesData?.data || [];
    return raw.map(decodeCity).filter((c) => c.name);
  }, []);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];

    // Match city or city, state
    const scored = [];
    for (const c of allCities) {
      const name = normalize(c.name);
      const state = normalize(c.state);
      if (!name.includes(q) && !state.includes(q)) continue;

      // Very simple scoring: start-with gets higher
      const score = (name.startsWith(q) ? 3 : 0) + (state.startsWith(q) ? 2 : 0) + (name.includes(q) ? 1 : 0);
      scored.push({ c, score });
    }

    scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
    return scored.slice(0, maxSuggestions).map((s) => s.c);
  }, [allCities, query, maxSuggestions]);

  const commitCity = (city) => {
    const nextName = city.state && !city.name.toLowerCase().includes(city.state.toLowerCase())
      ? `${city.name}, ${city.state}`
      : city.name;

    setQuery(nextName);
    onChange(nextName);
    setOpen(false);

    if (city.lat != null && city.lng != null) {
      onCoordinatesChange({ lat: city.lat, lng: city.lng });
    } else {
      // If city dataset doesn't include coordinates, keep old coords or null.
      onCoordinatesChange(null);
    }
  };

  const reverseGeocodeToCity = async (lat, lng) => {
    // https://nominatim.openstreetmap.org/reverse
    const url = new URL(`${NOMINATIM_BASE}/reverse`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Reverse geocoding failed (${res.status})`);
      }

      const data = await res.json();
      const addr = data?.address || {};

      // Prefer city/town/village; fall back to state/county
      const cityLike = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || "";
      const state = addr.state || "";

      if (cityLike) return state ? `${cityLike}, ${state}` : cityLike;
      if (addr.county) return addr.county;
      if (data?.display_name) return data.display_name;

      throw new Error("No readable city name found from reverse geocoding");
    } finally {
      clearTimeout(timeout);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported by this browser");
      return;
    }

    setGpsLoading(true);
    setStatus("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          const cityName = await reverseGeocodeToCity(lat, lng);

          // 1) set coordinates
          onCoordinatesChange({ lat, lng });
          // 2) fill input with readable city name
          setQuery(cityName);
          onChange(cityName);
          setOpen(false);
        } catch (e) {
          console.warn("Reverse geocode error:", e);
          // Fallback: show coordinates text if reverse fails
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onCoordinatesChange({ lat, lng });
          setQuery(fallback);
          onChange(fallback);
          setStatus("Could not detect city name, but location coordinates are set.");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setGpsLoading(false);

        // Handle common error codes
        if (err?.code === 1) {
          setStatus("Permission denied. Choose a city from the suggestions.");
        } else if (err?.code === 2) {
          setStatus("Location unavailable. Choose a city from the suggestions.");
        } else if (err?.code === 3) {
          setStatus("Location request timed out. Choose a city from the suggestions.");
        } else {
          setStatus("Location error. Choose a city from the suggestions.");
        }

        // Do NOT block manual typing.
        setOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="location-autocomplete" ref={rootRef}>
      <div className="location-input-row">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            onChange(next);
            onCoordinatesChange(null);
            setOpen(true);
          }}
        />

        <button
          type="button"
          className="gps-btn"
          onClick={useCurrentLocation}
          disabled={gpsLoading}
          aria-busy={gpsLoading}
        >
          📍 {gpsLoading ? "Locating..." : "Use Current Location"}
        </button>
      </div>

      {status ? <div className="location-status">{status}</div> : null}

      {open && suggestions.length > 0 && query.trim() ? (
        <ul className="places-dropdown" role="listbox">
          {suggestions.map((city) => {
            const label = city.state ? `${city.name}, ${city.state}` : city.name;
            return (
              <li
                key={`${city.name}-${city.state}`}
                className="places-item"
                onMouseDown={(e) => {
                  // Prevent blur before click
                  e.preventDefault();
                  commitCity(city);
                }}
              >
                {label}
              </li>
            );
          })}
        </ul>
      ) : null}

      {open && query.trim() && suggestions.length === 0 ? (
        <div className="places-empty">No matching cities found</div>
      ) : null}
    </div>
  );
}

