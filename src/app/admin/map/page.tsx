"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

interface EditableGem {
  slug: string;
  title: string;
  order_index: number;
  points: number;
  lat: number | null;
  lng: number | null;
}

const PASSCODE_KEY = "scavenger.admin.passcode";

export default function AdminMapPage() {
  const [passcode, setPasscode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [gems, setGems] = useState<EditableGem[]>([]);
  const [status, setStatus] = useState<string>("Drag any pin to its exact spot — it saves automatically.");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const passcodeRef = useRef("");
  passcodeRef.current = passcode;

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthed(true);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        headers: { "x-admin-passcode": input },
        cache: "no-store",
      });
      if (res.ok) {
        sessionStorage.setItem(PASSCODE_KEY, input);
        setPasscode(input);
        setAuthed(true);
      } else if (res.status === 401) {
        setAuthError("Wrong passcode.");
      } else {
        setAuthError(`Server error (HTTP ${res.status}).`);
      }
    } catch {
      setAuthError("Network error — is the app running?");
    }
  }

  // Load gems once authed.
  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const res = await fetch("/api/gems", { cache: "no-store" });
        const data = await res.json();
        setGems(data.gems ?? []);
      } catch {
        setStatus("Could not load gems — refresh the page.");
      }
    })();
  }, [authed]);

  // Build the map once gems arrive.
  useEffect(() => {
    if (!authed || gems.length === 0 || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const placed = gems.filter((g) => g.lat !== null && g.lng !== null);
      const map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      if (placed.length) {
        map.fitBounds(
          L.latLngBounds(placed.map((g) => [g.lat!, g.lng!])),
          { padding: [40, 40] }
        );
      } else {
        map.setView([41.8268, -71.4029], 16); // campus fallback
      }

      for (const gem of placed) {
        const marker = L.marker([gem.lat!, gem.lng!], {
          draggable: true,
          title: gem.title,
          icon: L.divIcon({
            className: "",
            html: `<div style="width:30px;height:30px;border-radius:50%;background:#4b3226;color:#fff;display:flex;align-items:center;justify-content:center;font:700 13px system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:grab;">${gem.order_index}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(map);
        marker.bindTooltip(`#${gem.order_index} ${gem.title}`, { direction: "top", offset: [0, -12] });

        marker.on("dragend", async () => {
          const { lat, lng } = marker.getLatLng();
          setStatus(`Saving #${gem.order_index} ${gem.title}…`);
          try {
            const res = await fetch("/api/admin/coords", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-admin-passcode": passcodeRef.current,
              },
              body: JSON.stringify({ slug: gem.slug, lat, lng }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setStatus(`❌ Save failed for #${gem.order_index}: ${data.error ?? `HTTP ${res.status}`}`);
              return;
            }
            setStatus(
              `✅ Saved #${gem.order_index} ${gem.title} → ${lat.toFixed(5)}, ${lng.toFixed(5)}`
            );
          } catch {
            setStatus(`❌ Network error saving #${gem.order_index} — drag it again to retry.`);
          }
        });

        markersRef.current[gem.slug] = marker;
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [authed, gems]);

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="mb-4 text-xl font-bold text-brown">Organizer login</h1>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin passcode"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 focus:border-brown focus:outline-none"
          />
          {authError && <p className="text-sm text-red-600">{authError}</p>}
          <button className="w-full rounded-xl bg-brown px-4 py-3 font-semibold text-white transition active:scale-[0.99]">
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-stone-200 bg-stone-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-brown">Map editor</h1>
          <div className="flex gap-4 text-sm">
            <a href="/admin" className="underline">
              Review queue
            </a>
            <a href="/admin/teams" className="underline">
              Teams
            </a>
            <a href="/map" className="underline">
              Public map
            </a>
          </div>
        </div>
        <p className="mt-1 text-xs text-stone-500">{status}</p>
      </header>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </main>
  );
}
