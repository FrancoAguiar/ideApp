"use client";

import Script from "next/script";
import {
  initializeOneSignal,
  isOneSignalConfigured,
  reportOneSignalSdkLoaded,
  reportOneSignalSdkLoadError,
} from "@/lib/onesignal";

export default function OneSignalInitializer() {
  if (!isOneSignalConfigured()) return null;

  return (
    <Script
      id="onesignal-web-sdk"
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
      onLoad={() => {
        reportOneSignalSdkLoaded();
        void initializeOneSignal().catch((error) => {
          console.error("[IdeApp][OneSignal] No se pudo inicializar OneSignal", error, error instanceof Error ? error.stack : undefined);
        });
      }}
      onError={(event) => {
        const error = new Error(`No se pudo cargar el SDK Web v16 de OneSignal: ${event.type}`);
        reportOneSignalSdkLoadError(error);
      }}
    />
  );
}
