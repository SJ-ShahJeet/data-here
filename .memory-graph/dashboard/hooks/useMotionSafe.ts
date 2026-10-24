"use client";

import { useState, useEffect } from "react";

export function useMotionSafe(): boolean {
  const [safe, setSafe] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSafe(!mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return safe;
}
