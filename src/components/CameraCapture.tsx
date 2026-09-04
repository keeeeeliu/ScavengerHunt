"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "starting" | "live" | "preview" | "error";

/**
 * Full-screen in-app camera. Shows a live preview with a shutter button, then a
 * retake/use confirmation, and returns the chosen frame as a JPEG File. If the
 * browser can't grant live camera access, it surfaces an error with a fallback
 * to the OS camera / file picker (wired by the parent via onFallback).
 */
export function CameraCapture({
  title,
  onCapture,
  onClose,
  onFallback,
}: {
  title: string;
  onCapture: (file: File) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("starting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const capturedFileRef = useRef<File | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(
    async (mode: "environment" | "user") => {
      setPhase("starting");
      setErrorMsg("");
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPhase("live");
      } catch {
        setErrorMsg(
          "Couldn't open the camera. Check camera permission for this site, or use your phone's camera instead."
        );
        setPhase("error");
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("This browser doesn't support the in-app camera.");
      setPhase("error");
      return;
    }
    startStream(facingMode);
    return () => {
      stopStream();
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
    };
    // Only run on mount; facingMode changes go through switchCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleShutter() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror the front camera so the still matches what the user saw.
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        capturedFileRef.current = file;
        const url = URL.createObjectURL(blob);
        if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current);
        capturedUrlRef.current = url;
        setCapturedUrl(url);
        stopStream();
        setPhase("preview");
      },
      "image/jpeg",
      0.92
    );
  }

  function switchCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startStream(next);
  }

  function retake() {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    setCapturedUrl(null);
    capturedFileRef.current = null;
    startStream(facingMode);
  }

  function usePhoto() {
    const file = capturedFileRef.current;
    stopStream();
    if (file) onCapture(file);
  }

  function close() {
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={close} className="text-sm font-medium text-white/80">
          Cancel
        </button>
        <p className="max-w-[60%] truncate text-sm font-semibold">{title}</p>
        <div className="w-14 text-right">
          {phase === "live" && (
            <button onClick={switchCamera} aria-label="Switch camera" className="text-xl">
              ↺
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Live video (kept mounted so the ref is stable) */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${
            phase === "live" ? "block" : "hidden"
          } ${facingMode === "user" ? "-scale-x-100" : ""}`}
        />

        {phase === "starting" && (
          <div className="flex h-full items-center justify-center text-white/70">
            Opening camera…
          </div>
        )}

        {phase === "preview" && capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="Captured" className="h-full w-full object-contain" />
        )}

        {phase === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white/80">
            <p className="text-sm">{errorMsg}</p>
            <button
              onClick={() => {
                stopStream();
                onFallback();
              }}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
            >
              Use phone camera / files
            </button>
            <button onClick={close} className="text-sm text-white/60 underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8 px-4 py-6">
        {phase === "live" && (
          <button
            onClick={handleShutter}
            aria-label="Take photo"
            className="rounded-full border-4 border-white p-1 active:scale-95"
            style={{ height: 72, width: 72 }}
          >
            <span className="block h-full w-full rounded-full bg-white" />
          </button>
        )}

        {phase === "preview" && (
          <>
            <button
              onClick={retake}
              className="rounded-xl bg-white/15 px-6 py-3 text-sm font-semibold text-white"
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              className="rounded-xl bg-white px-8 py-3 text-sm font-semibold text-black"
            >
              Use photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
