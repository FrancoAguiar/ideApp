export type NotificationPermissionState = NotificationPermission | "unsupported";

type OneSignalNotifications = {
  isPushSupported: () => boolean;
  permission: boolean;
  requestPermission: () => Promise<void> | void;
};

type OneSignalSdk = {
  init: (options: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
  }) => Promise<void>;
  Notifications: OneSignalNotifications;
};

type OneSignalCallback = (oneSignal: OneSignalSdk) => void | Promise<void>;
type OneSignalDeferred = OneSignalCallback[] | { push: (callback: OneSignalCallback) => void };

declare global {
  interface Window {
    OneSignalDeferred?: OneSignalDeferred;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ?? "";
const allowLocalhost = process.env.NEXT_PUBLIC_ONESIGNAL_ALLOW_LOCALHOST === "true";

let initializationPromise: Promise<OneSignalSdk> | null = null;

export function isOneSignalConfigured() {
  return Boolean(appId);
}

export function isInstalledPwa() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  return Notification.permission;
}

export function initializeOneSignal(): Promise<OneSignalSdk> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise<OneSignalSdk>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OneSignal solo puede inicializarse en el navegador."));
      return;
    }

    if (!appId) {
      reject(new Error("Falta NEXT_PUBLIC_ONESIGNAL_APP_ID."));
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: allowLocalhost,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
        });
        resolve(oneSignal);
      } catch (error) {
        initializationPromise = null;
        reject(error);
      }
    });
  });

  return initializationPromise;
}

export async function requestNotificationPermission() {
  const permission = getNotificationPermission();
  if (permission === "unsupported" || permission === "denied" || permission === "granted") {
    return permission;
  }

  const oneSignal = await initializeOneSignal();
  if (!oneSignal.Notifications.isPushSupported()) return "unsupported";

  await oneSignal.Notifications.requestPermission();
  return getNotificationPermission();
}
