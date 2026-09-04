"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { StatusBadge } from "./StatusBadge";
import { CameraCapture } from "./CameraCapture";
import { gemImageForSlug } from "@/lib/gemImages";
import type { SubmissionStatus } from "@/lib/types";

export interface HuntSubmission {
  id: number;
  status: SubmissionStatus;
  points_awarded: number;
  photo_url: string | null;
}

export interface HuntGem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  points: number;
  order_index: number;
  submission: HuntSubmission | null;
}

export function GemCard({
  gem,
  teamCode,
  onUpdated,
}: {
  gem: HuntGem;
  teamCode: string;
  onUpdated: (gemId: number, submission: HuntSubmission) => void;
}) {
  // Two hidden file inputs: the gallery one has no `capture` attribute so
  // phones open the photo library; the camera one forces the native camera
  // and only backs up the in-app camera when getUserMedia is unavailable.
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const status: SubmissionStatus | "none" = gem.submission?.status ?? "none";

  async function uploadFile(file: File) {
    setError(null);
    setBusy(true);
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      const form = new FormData();
      form.append("code", teamCode);
      form.append("gemId", String(gem.id));
      form.append("file", compressed, `gem-${gem.id}.jpg`);

      const res = await uploadWithRetry(form);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      onUpdated(gem.id, {
        id: data.submission.id,
        status: data.submission.status,
        points_awarded: data.submission.points_awarded,
        photo_url: preview,
      });
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) uploadFile(file);
  }

  function handleCapture(file: File) {
    setShowCamera(false);
    uploadFile(file);
  }

  const thumb = localPreview ?? gem.submission?.photo_url ?? null;
  const hasPhoto = Boolean(thumb);
  const sketch = gemImageForSlug(gem.slug);

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : sketch ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sketch}
              alt={`Sketch of ${gem.title}`}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">💎</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight text-stone-900">{gem.title}</h3>
            <span className="whitespace-nowrap text-xs font-semibold text-brown">
              {gem.points} pts
            </span>
          </div>
          {gem.description && (
            <p className="mt-0.5 text-sm text-stone-500">{gem.description}</p>
          )}
          <div className="mt-2">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {status === "approved" ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700">
          ✅ Approved — {gem.submission?.points_awarded ?? gem.points} pts locked in
        </p>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brown px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            <span aria-hidden>📷</span>
            {busy ? "Uploading…" : hasPhoto ? "Retake photo" : "Take photo"}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            title="Choose an existing photo from your gallery"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 px-3 py-2.5 text-sm font-medium text-stone-600 transition active:scale-[0.99] disabled:opacity-50"
          >
            <span aria-hidden>🖼️</span>
            Gallery
          </button>
        </div>
      )}

      {showCamera && (
        <CameraCapture
          title={gem.title}
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
          onFallback={() => {
            setShowCamera(false);
            cameraInputRef.current?.click();
          }}
        />
      )}
    </li>
  );
}

async function uploadWithRetry(form: FormData, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch("/api/submit", { method: "POST", body: form });
      // Retry only on transient server errors.
      if (res.status >= 500 && i < attempts - 1) {
        await delay(500 * (i + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await delay(500 * (i + 1));
    }
  }
  throw lastErr ?? new Error("Upload failed");
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
