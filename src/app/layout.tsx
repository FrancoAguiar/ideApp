import type { Metadata, Viewport } from "next";
import Script from "next/script";
import OneSignalInitializer from "@/components/OneSignalInitializer";
import "./globals.css";

const isOneSignalConfigured = Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim());

export const metadata: Metadata = {
  applicationName: "IdeApp",
  title: "IdeApp",
  description: "Captura ideas rápidas antes de olvidarlas.",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IdeApp",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f5ec",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {isOneSignalConfigured && (
          <Script id="onesignal-deferred-queue" strategy="beforeInteractive">
            {"window.OneSignalDeferred = window.OneSignalDeferred || [];"}
          </Script>
        )}
        {children}
        <OneSignalInitializer />
      </body>
    </html>
  );
}
