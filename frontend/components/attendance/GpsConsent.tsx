"use client";

import { useState } from "react";

interface GpsConsentProps {
  onLocation: (location: { lat: number; lng: number; accuracy: number }) => void;
}

export default function GpsConsent({ onLocation }: GpsConsentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null
  );

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Tarayıcınız konum bilgisini desteklemiyor.");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(coords);
        onLocation(coords);
        setLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError(
          err.message ||
            "Konum bilgisi alınamadı. Lütfen izin verdiğinizden emin olun ve tekrar deneyin."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-teal-900 flex items-center gap-2">
          <span className="text-lg">📍</span>
          Konum Bilgisi
        </h3>
        <button
          type="button"
          onClick={requestLocation}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          {loading ? "Konum alınıyor..." : "Konumumu Kullan"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {location && (
        <div className="text-xs text-teal-700 bg-teal-50 border border-teal-100 px-3 py-2 rounded-lg">
          <div>Enlem: {location.lat.toFixed(6)}</div>
          <div>Boylam: {location.lng.toFixed(6)}</div>
          <div>Hassasiyet: ±{Math.round(location.accuracy)} metre</div>
        </div>
      )}
    </div>
  );
}


