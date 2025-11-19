"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

interface TenantSummary {
  id: string;
  name: string;
  city?: string | null;
}

interface TenantSwitcherProps {
  className?: string;
}

export default function TenantSwitcher({ className }: TenantSwitcherProps) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedTenantId = localStorage.getItem("tenantId");
    if (storedTenantId) {
      setCurrentTenantId(storedTenantId);
    }

    const storedTenants = localStorage.getItem("tenants");
    if (storedTenants) {
      try {
        const parsed: string[] = JSON.parse(storedTenants);
        if (!storedTenantId && parsed.length > 0) {
          setCurrentTenantId(parsed[0]);
        }
      } catch (error) {
        console.warn("Tenant list parse error", error);
      }
    }

    api
      .get<TenantSummary[]>("/tenants/my")
      .then((response) => {
        setTenants(response.data);
        if (!storedTenantId && response.data.length > 0) {
          const fallbackId = response.data[0].id;
          localStorage.setItem("tenantId", fallbackId);
          setCurrentTenantId(fallbackId);
        }
      })
      .catch(() => {
        setTenants([]);
      });
  }, []);

  const handleChange = (value: string) => {
    setCurrentTenantId(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("tenantId", value);
      window.location.reload();
    }
  };

  const options = useMemo(() => {
    if (!tenants.length) return [];
    return tenants.map((tenant) => ({
      id: tenant.id,
      label: tenant.city ? `${tenant.name} (${tenant.city})` : tenant.name,
    }));
  }, [tenants]);

  if (!options.length) {
    return null;
  }

  return (
    <div className={className}>
      <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
        Şube
      </label>
      <select
        value={currentTenantId}
        onChange={(event) => handleChange(event.target.value)}
        className="mt-1 px-3 py-1.5 border border-emerald-200 rounded-lg text-sm text-emerald-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

