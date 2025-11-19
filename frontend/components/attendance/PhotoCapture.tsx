"use client";

import { useEffect, useRef, useState } from "react";

interface PhotoCaptureProps {
  onCapture: (dataUrl: string) => void;
}

export default function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string>("");
  const [streamReady, setStreamReady] = useState(false);
  const [lastCapture, setLastCapture] = useState<string>("");

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamReady(true);
        }
      } catch (err: any) {
        console.error("Camera init error:", err);
        setError(
          err?.message ||
            "Kamera erişimine izin verilmedi. Lütfen tarayıcı ayarlarını kontrol edin."
        );
      }
    };

    init();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setLastCapture(dataUrl);
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="aspect-[3/4] w-full max-w-sm mx-auto rounded-3xl overflow-hidden border-4 border-emerald-200 bg-emerald-50 shadow-xl relative">
        {error ? (
          <div className="flex items-center justify-center h-full px-4 text-sm text-red-600 text-center">
            {error}
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {!streamReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/40 text-white text-sm">
                Kamera hazırlanıyor...
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleCapture}
          disabled={!!error || !streamReady}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold shadow hover:from-emerald-700 hover:to-green-700 disabled:opacity-60"
        >
          📸 Fotoğraf Çek
        </button>
      </div>

      {lastCapture && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-emerald-900">Son çekim</h3>
          <img
            src={lastCapture}
            alt="Son çekilen görüntü"
            className="w-full max-w-xs rounded-2xl border border-emerald-100 shadow"
          />
        </div>
      )}

      <canvas ref={canvasRef} hidden />
    </div>
  );
}


