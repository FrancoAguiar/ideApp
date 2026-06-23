"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPermission,
  getOneSignalErrorMessage,
  isInstalledPwa,
  isOneSignalConfigured,
  NotificationActivationTimeoutError,
  NOTIFICATION_TIMEOUT_MESSAGE,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/onesignal";

type NotificationState = {
  installed: boolean;
  permission: NotificationPermissionState;
};

const initialState: NotificationState = {
  installed: false,
  permission: "unsupported",
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export default function NotificationSettings() {
  const [state, setState] = useState<NotificationState>(initialState);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function refreshState() {
      setState({
        installed: isInstalledPwa(),
        permission: getNotificationPermission(),
      });
    }

    refreshState();
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener?.("change", refreshState);
    window.addEventListener("focus", refreshState);
    document.addEventListener("visibilitychange", refreshState);

    return () => {
      displayMode.removeEventListener?.("change", refreshState);
      window.removeEventListener("focus", refreshState);
      document.removeEventListener("visibilitychange", refreshState);
    };
  }, []);

  async function activateNotifications() {
    setError(null);
    setIsRequesting(true);
    try {
      const installed = isInstalledPwa();
      if (!installed) {
        setState({ installed: false, permission: getNotificationPermission() });
        setError("Abrí IdeApp desde el ícono de inicio para activar recordatorios.");
        return;
      }

      const permissionBefore = getNotificationPermission();
      if (permissionBefore === "denied") {
        setState({ installed: true, permission: permissionBefore });
        setError("Las notificaciones están bloqueadas. Activá el permiso desde Ajustes del iPhone.");
        return;
      }

      if (!isOneSignalConfigured()) {
        setError("Los recordatorios todavía no están disponibles.");
        return;
      }

      const permission = await requestNotificationPermission();
      setState({ installed: isInstalledPwa(), permission });
      if (permission === "denied") {
        setError("Las notificaciones están bloqueadas. Activá el permiso desde Ajustes del iPhone.");
      }
    } catch (requestError) {
      console.error(
        "[IdeApp][OneSignal] No se pudo solicitar permiso de notificaciones",
        requestError,
        requestError instanceof Error ? requestError.stack : undefined,
      );
      setError(
        requestError instanceof NotificationActivationTimeoutError
          ? NOTIFICATION_TIMEOUT_MESSAGE
          : getOneSignalErrorMessage(requestError),
      );
    } finally {
      setIsRequesting(false);
    }
  }

  const isUnsupported = state.permission === "unsupported";
  const isGranted = state.permission === "granted";
  const isDenied = state.permission === "denied";
  const canRequest = state.installed && state.permission === "default";

  let copy = "Elegí cuándo querés volver a tus ideas.";
  if (!state.installed) copy = "Abrí IdeApp desde el ícono de inicio para activar recordatorios.";
  else if (isUnsupported) copy = "Este navegador no admite notificaciones para IdeApp.";
  else if (isGranted) copy = "Los recordatorios están activados en este dispositivo.";
  else if (isDenied) copy = "Las notificaciones están bloqueadas. Activá el permiso desde Ajustes del iPhone.";

  return (
    <section className="notification-settings" aria-labelledby="notification-settings-title">
      <div className="section-head">
        <h2 className="section-title" id="notification-settings-title">Notificaciones</h2>
        <span className={`notification-status ${isGranted ? "active" : ""}`}>
          {isGranted ? "Activadas" : isDenied ? "Bloqueadas" : "Opcional"}
        </span>
      </div>

      <div className="notification-settings-card">
        <span className="notification-settings-icon"><BellIcon /></span>
        <div className="notification-settings-content">
          <strong>Recordatorios de ideas</strong>
          <p>{copy}</p>
        </div>
        <button
          type="button"
          className="notification-activate"
          onClick={() => void activateNotifications()}
          disabled={!canRequest || isRequesting}
        >
          {isRequesting ? "Activando…" : isGranted ? "Recordatorios activados" : "Activar recordatorios"}
        </button>
        <p className={`notification-error ${error ? "show" : ""}`} role="alert">{error ?? ""}</p>
      </div>
    </section>
  );
}
