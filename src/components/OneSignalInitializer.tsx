"use client";

import Script from "next/script";
import { initializeOneSignal, isOneSignalConfigured } from "@/lib/onesignal";

export default function OneSignalInitializer() {
  if (!isOneSignalConfigured()) return null;

  return (
    <Script
      id="onesignal-web-sdk"
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
      onLoad={() => {
        void initializeOneSignal().catch((error) => {
          console.error("No se pudo inicializar OneSignal", error);
        });
      }}
    />
  );
}
