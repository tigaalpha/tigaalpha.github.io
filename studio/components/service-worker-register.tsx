"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/constants";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {
      // Installability is a nice-to-have — never block the app on it.
    });
  }, []);

  return null;
}
