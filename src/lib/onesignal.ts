export type NotificationPermissionState = NotificationPermission | "unsupported";

type OneSignalNotifications = {
  isPushSupported: () => boolean;
  permission: boolean;
  requestPermission: () => Promise<void> | void;
};

type OneSignalPushSubscription = {
  id: string | null;
  token: string | null;
  optedIn: boolean;
  optIn: () => Promise<void> | void;
};

type OneSignalSdk = {
  init: (options: {
    appId: string;
    allowLocalhostAsSecureOrigin?: boolean;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
  }) => Promise<void>;
  Notifications: OneSignalNotifications;
  User: {
    PushSubscription: OneSignalPushSubscription;
  };
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
let rejectInitialization: ((reason?: unknown) => void) | null = null;
let sdkLoadState: "idle" | "loaded" | "failed" = "idle";
let sdkLoadError: Error | null = null;

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? "Stack no disponible",
      cause: error.cause,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : JSON.stringify(error),
    stack: "Stack no disponible para un error que no es Error",
  };
}

function debugLog(stage: string, details: Record<string, unknown>) {
  console.info(`[IdeApp][OneSignal] ${stage}`, details);
}

function debugError(stage: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error(`[IdeApp][OneSignal] ${stage}`, {
    ...context,
    ...errorDetails(error),
  }, error);
}

export function getOneSignalErrorMessage(error: unknown) {
  const details = errorDetails(error);
  return `${details.name}: ${details.message}`;
}

export function reportOneSignalSdkLoaded() {
  sdkLoadState = "loaded";
  sdkLoadError = null;
  debugLog("SDK cargado", {
    source: "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js",
    version: "v16",
  });
}

export function reportOneSignalSdkLoadError(error: Error) {
  sdkLoadState = "failed";
  sdkLoadError = error;
  debugError("Falló la carga del SDK", error, {
    source: "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js",
  });
  rejectInitialization?.(error);
  rejectInitialization = null;
  initializationPromise = null;
}

export function isOneSignalConfigured() {
  return Boolean(appId);
}

export function isInstalledPwa() {
  if (typeof window === "undefined") return false;

  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = window.navigator.standalone === true;
  const installed = displayModeStandalone || navigatorStandalone;

  debugLog("Detección PWA", {
    installed,
    displayModeStandalone,
    navigatorStandalone,
    userAgent: window.navigator.userAgent,
  });

  return installed;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    debugLog("Permiso del navegador", {
      permission: "unsupported",
      hasNotificationApi: typeof window !== "undefined" && "Notification" in window,
      hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
      hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    });
    return "unsupported";
  }

  const permission = Notification.permission;
  debugLog("Permiso del navegador", { permission });
  return permission;
}

export function initializeOneSignal(): Promise<OneSignalSdk> {
  if (initializationPromise) return initializationPromise;

  initializationPromise = new Promise<OneSignalSdk>((resolve, reject) => {
    rejectInitialization = reject;

    if (typeof window === "undefined") {
      const error = new Error("OneSignal solo puede inicializarse en el navegador.");
      debugError("Falló la inicialización", error);
      reject(error);
      return;
    }

    if (!appId) {
      const error = new Error("Falta NEXT_PUBLIC_ONESIGNAL_APP_ID.");
      debugError("Falló la inicialización", error);
      reject(error);
      return;
    }

    if (sdkLoadState === "failed") {
      const error = sdkLoadError ?? new Error("El SDK de OneSignal no pudo cargarse.");
      debugError("Inicialización cancelada porque falló el SDK", error);
      reject(error);
      return;
    }

    debugLog("Inicialización solicitada", {
      sdkLoadState,
      appId,
      allowLocalhostAsSecureOrigin: allowLocalhost,
      serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
      serviceWorkerScope: "/push/onesignal/",
    });

    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        debugLog("Inicializando SDK", { sdkAvailable: Boolean(oneSignal) });
        await oneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: allowLocalhost,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
        });
        debugLog("Inicialización completada", {
          pushSupported: oneSignal.Notifications.isPushSupported(),
          permission: getNotificationPermission(),
          optedIn: oneSignal.User.PushSubscription.optedIn,
          subscriptionId: oneSignal.User.PushSubscription.id,
          hasToken: Boolean(oneSignal.User.PushSubscription.token),
        });
        rejectInitialization = null;
        resolve(oneSignal);
      } catch (error) {
        debugError("Falló la inicialización", error, {
          sdkLoadState,
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerScope: "/push/onesignal/",
        });
        rejectInitialization = null;
        initializationPromise = null;
        reject(error);
      }
    });
  });

  return initializationPromise;
}

export async function requestNotificationPermission() {
  const permissionBefore = getNotificationPermission();
  debugLog("Solicitud de permiso iniciada", { permissionBefore });

  try {
    if (permissionBefore === "unsupported" || permissionBefore === "denied") {
      debugLog("Solicitud de permiso omitida", { reason: permissionBefore });
      return permissionBefore;
    }

    const oneSignal = await initializeOneSignal();
    const pushSupported = oneSignal.Notifications.isPushSupported();
    debugLog("Soporte push según OneSignal", { pushSupported });
    if (!pushSupported) return "unsupported";

    if (permissionBefore !== "granted") {
      debugLog("Mostrando solicitud nativa de permiso", { permissionBefore });
      await oneSignal.Notifications.requestPermission();
    }

    const permissionAfterRequest = getNotificationPermission();
    debugLog("Solicitud de permiso completada", {
      permissionBefore,
      permissionAfter: permissionAfterRequest,
      oneSignalPermission: oneSignal.Notifications.permission,
    });

    if (permissionAfterRequest !== "granted") {
      debugLog("PushSubscription.optIn omitido", {
        reason: `Notification.permission=${permissionAfterRequest}`,
      });
      return permissionAfterRequest;
    }

    debugLog("PushSubscription.optIn iniciado", {
      optedInBefore: oneSignal.User.PushSubscription.optedIn,
      subscriptionIdBefore: oneSignal.User.PushSubscription.id,
      hasTokenBefore: Boolean(oneSignal.User.PushSubscription.token),
    });
    await oneSignal.User.PushSubscription.optIn();
    debugLog("PushSubscription.optIn completado", {
      optedInAfter: oneSignal.User.PushSubscription.optedIn,
      subscriptionIdAfter: oneSignal.User.PushSubscription.id,
      hasTokenAfter: Boolean(oneSignal.User.PushSubscription.token),
    });

    return getNotificationPermission();
  } catch (error) {
    debugError("Falló la activación de notificaciones", error, {
      permissionBefore,
      permissionAfter: getNotificationPermission(),
      sdkLoadState,
    });
    throw error;
  }
}
