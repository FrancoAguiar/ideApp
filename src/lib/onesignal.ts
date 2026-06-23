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
    __ideappOneSignalInitialized?: boolean;
    __ideappOneSignalInstance?: OneSignalSdk;
    __ideappOneSignalInitializationPromise?: Promise<OneSignalSdk>;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ?? "";
const allowLocalhost = process.env.NEXT_PUBLIC_ONESIGNAL_ALLOW_LOCALHOST === "true";
const ACTIVATION_TIMEOUT_MS = 12_000;

export const NOTIFICATION_TIMEOUT_MESSAGE = "No pudimos activar los recordatorios. Cerrá y abrí IdeApp desde el ícono de inicio e intentá de nuevo.";

export class NotificationActivationTimeoutError extends Error {
  constructor() {
    super(NOTIFICATION_TIMEOUT_MESSAGE);
    this.name = "NotificationActivationTimeoutError";
  }
}

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

function isAlreadyInitializedError(error: unknown) {
  return errorDetails(error).message.toLowerCase().includes("already initialized");
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
  if (typeof window !== "undefined" && window.__ideappOneSignalInitialized) {
    debugLog("Error de carga ignorado porque el SDK ya estaba inicializado", {
      hasReusableInstance: Boolean(window.__ideappOneSignalInstance),
      originalMessage: error.message,
    });
    return;
  }

  sdkLoadState = "failed";
  sdkLoadError = error;
  debugError("Falló la carga del SDK", error, {
    source: "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js",
  });
  rejectInitialization?.(error);
  rejectInitialization = null;
  if (typeof window !== "undefined") {
    window.__ideappOneSignalInitializationPromise = undefined;
  }
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
  if (typeof window === "undefined") {
    const error = new Error("OneSignal solo puede inicializarse en el navegador.");
    debugError("Falló la inicialización", error);
    return Promise.reject(error);
  }

  if (window.__ideappOneSignalInitialized && window.__ideappOneSignalInstance) {
    debugLog("Reutilizando SDK ya inicializado", {
      source: "window.__ideappOneSignalInstance",
      permission: getNotificationPermission(),
    });
    return Promise.resolve(window.__ideappOneSignalInstance);
  }

  if (window.__ideappOneSignalInitializationPromise) {
    debugLog("Reutilizando inicialización en curso", {
      initialized: Boolean(window.__ideappOneSignalInitialized),
    });
    return window.__ideappOneSignalInitializationPromise;
  }

  const initializationPromise = new Promise<OneSignalSdk>((resolve, reject) => {
    rejectInitialization = reject;

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
      if (window.__ideappOneSignalInitialized && window.__ideappOneSignalInstance) {
        debugLog("Callback de inicialización reutilizó la instancia global", {
          initialized: true,
        });
        rejectInitialization = null;
        resolve(window.__ideappOneSignalInstance);
        return;
      }

      try {
        debugLog("Inicializando SDK", { sdkAvailable: Boolean(oneSignal) });
        await oneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: allowLocalhost,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
        });
        window.__ideappOneSignalInitialized = true;
        window.__ideappOneSignalInstance = oneSignal;
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
        if (isAlreadyInitializedError(error)) {
          window.__ideappOneSignalInitialized = true;
          window.__ideappOneSignalInstance = oneSignal;
          rejectInitialization = null;
          debugLog("SDK ya inicializado; instancia existente reutilizada", {
            originalMessage: errorDetails(error).message,
            permission: getNotificationPermission(),
          });
          resolve(oneSignal);
          return;
        }

        debugError("Falló la inicialización", error, {
          sdkLoadState,
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerScope: "/push/onesignal/",
        });
        rejectInitialization = null;
        window.__ideappOneSignalInitializationPromise = undefined;
        reject(error);
      }
    });
  });

  window.__ideappOneSignalInitializationPromise = initializationPromise;
  return initializationPromise;
}

function subscriptionState(oneSignal: OneSignalSdk) {
  return {
    optedIn: oneSignal.User.PushSubscription.optedIn,
    subscriptionId: oneSignal.User.PushSubscription.id,
    hasToken: Boolean(oneSignal.User.PushSubscription.token),
    permission: getNotificationPermission(),
  };
}

async function runNotificationActivation() {
  debugLog("init start", {
    initialized: typeof window !== "undefined" && Boolean(window.__ideappOneSignalInitialized),
  });

  const oneSignal = await initializeOneSignal();
  debugLog("init done", {
    reusedInstance: typeof window !== "undefined" && window.__ideappOneSignalInstance === oneSignal,
  });

  const permissionBefore = getNotificationPermission();
  debugLog("permission before", { permission: permissionBefore });

  if (permissionBefore === "unsupported" || permissionBefore === "denied") {
    debugLog("final subscription state", {
      ...subscriptionState(oneSignal),
      skipped: permissionBefore,
    });
    return permissionBefore;
  }

  const pushSupported = oneSignal.Notifications.isPushSupported();
  debugLog("Soporte push según OneSignal", { pushSupported });
  if (!pushSupported) {
    debugLog("final subscription state", {
      ...subscriptionState(oneSignal),
      skipped: "unsupported",
    });
    return "unsupported" as const;
  }

  if (permissionBefore !== "granted") {
    debugLog("permission requested", { permissionBefore });
    await oneSignal.Notifications.requestPermission();
  } else {
    debugLog("permission requested", { skipped: "already granted" });
  }

  const permissionAfter = getNotificationPermission();
  debugLog("permission after", {
    permission: permissionAfter,
    oneSignalPermission: oneSignal.Notifications.permission,
  });

  if (permissionAfter !== "granted") {
    debugLog("final subscription state", {
      ...subscriptionState(oneSignal),
      skipped: `permission=${permissionAfter}`,
    });
    return permissionAfter;
  }

  debugLog("optIn start", subscriptionState(oneSignal));
  await oneSignal.User.PushSubscription.optIn();
  debugLog("optIn done", subscriptionState(oneSignal));

  const finalState = subscriptionState(oneSignal);
  debugLog("final subscription state", finalState);

  if (!finalState.optedIn) {
    throw new Error("OneSignal no confirmó la suscripción de este dispositivo.");
  }

  return finalState.permission;
}

function withActivationTimeout<T>(operation: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new NotificationActivationTimeoutError();
      debugError("activation timeout", error, { timeoutMs: ACTIVATION_TIMEOUT_MS });
      reject(error);
    }, ACTIVATION_TIMEOUT_MS);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function requestNotificationPermission() {
  const activation = runNotificationActivation();

  try {
    return await withActivationTimeout(activation);
  } catch (error) {
    debugError("Falló la activación de notificaciones", error, {
      permission: getNotificationPermission(),
      sdkLoadState,
    });
    throw error;
  }
}
