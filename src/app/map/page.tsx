"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import huntData from "../../../data/hunt.json";
import { loadTeam } from "@/lib/teamSession";
import type { SubmissionStatus } from "@/lib/types";

interface MapGem {
  slug: string;
  title: string;
  description: string | null;
  order_index: number;
  points: number;
  lat?: number;
  lng?: number;
}

type PinStatus = SubmissionStatus | "none";

const FALLBACK_GEMS: MapGem[] = (huntData.gems as MapGem[]).filter(
  (g) => typeof g.lat === "number" && typeof g.lng === "number"
);

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const [statusBySlug, setStatusBySlug] = useState<Record<string, PinStatus>>({});
  const [gems, setGems] = useState<MapGem[]>([]);

  // Coordinates come from the server (hunt.json defaults + organizer
  // calibration from /admin/map); fall back to the bundled file offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/gems", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        const placed = (data.gems as MapGem[]).filter(
          (g) => typeof g.lat === "number" && typeof g.lng === "number"
        );
        setGems(placed.length ? placed : FALLBACK_GEMS);
      } catch {
        if (!cancelled) setGems(FALLBACK_GEMS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the map once gem positions are known.
  useEffect(() => {
    if (gems.length === 0) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds = L.latLngBounds(gems.map((g) => [g.lat!, g.lng!]));
      map.fitBounds(bounds, { padding: [40, 40] });

      for (const gem of gems) {
        const marker = L.marker([gem.lat!, gem.lng!], {
          icon: pinIcon(L, gem.order_index, "none"),
          title: gem.title,
        }).addTo(map);
        marker.bindPopup(popupHtml(gem), { maxWidth: 260 });
        markersRef.current[gem.slug] = marker;
      }

      // Calibration helper: click anywhere to read coordinates for hunt.json.
      map.on("click", (e) => {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(
            `<code>"lat": ${e.latlng.lat.toFixed(5)}, "lng": ${e.latlng.lng.toFixed(5)}</code>`
          )
          .openOn(map);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [gems]);

  // If a team is joined, fetch their submissions and color the pins.
  useEffect(() => {
    const team = loadTeam();
    if (!team) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/hunt?code=${encodeURIComponent(team.code)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next: Record<string, PinStatus> = {};
        for (const gem of data.gems ?? []) {
          if (gem.submission) next[gem.slug] = gem.submission.status;
        }
        setStatusBySlug(next);
      } catch {
        // Map still works without statuses.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recolor markers when statuses arrive.
  useEffect(() => {
    if (!Object.keys(statusBySlug).length) return;
    (async () => {
      const L = (await import("leaflet")).default;
      for (const gem of gems) {
        const marker = markersRef.current[gem.slug];
        if (!marker) continue;
        marker.setIcon(pinIcon(L, gem.order_index, statusBySlug[gem.slug] ?? "none"));
      }
    })();
  }, [statusBySlug, gems]);

  return (
    <main className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 bg-stone-100 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-brown">Gem Map</h1>
          <p className="text-xs text-stone-500">{gems.length} gems · tap a pin for details</p>
        </div>
        <span className="flex gap-3 text-sm">
          <Link href="/hunt" className="underline">
            Hunt
          </Link>
          <Link href="/leaderboard" className="underline">
            Leaderboard
          </Link>
        </span>
      </header>

      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-3 left-3 z-[1000] rounded-xl bg-white/95 px-3 py-2 text-xs shadow">
          <p className="mb-1 font-semibold text-stone-700">Your team's progress</p>
          <div className="flex flex-col gap-1 text-stone-600">
            <LegendRow className="gem-pin--approved" label="Approved" />
            <LegendRow className="gem-pin--pending" label="Pending review" />
            <LegendRow className="gem-pin--rejected" label="Rejected — retake" />
            <LegendRow className="" label="Not submitted yet" />
          </div>
        </div>
      </div>
    </main>
  );
}

function LegendRow({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`gem-pin gem-pin--legend ${className}`} />
      {label}
    </span>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function pinIcon(L: any, orderIndex: number, status: PinStatus) {
  return L.divIcon({
    className: "",
    html: `<div class="gem-pin gem-pin--${status}">${orderIndex}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function popupHtml(gem: MapGem): string {
  return `
    <div class="gem-popup">
      <p class="gem-popup__title">${gem.order_index}. ${escapeHtml(gem.title)}
        <span class="gem-popup__pts">${gem.points} pt${gem.points === 1 ? "" : "s"}</span>
      </p>
      ${gem.description ? `<p class="gem-popup__desc">${escapeHtml(gem.description)}</p>` : ""}
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
