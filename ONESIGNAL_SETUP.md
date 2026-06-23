# OneSignal para IdeApp

## Variables

Agregar en `.env.local` y en las variables del proyecto de Vercel:

```bash
NEXT_PUBLIC_ONESIGNAL_APP_ID=tu-app-id
NEXT_PUBLIC_ONESIGNAL_ALLOW_LOCALHOST=true
```

`NEXT_PUBLIC_ONESIGNAL_ALLOW_LOCALHOST` debe omitirse o configurarse como `false` en producción. El App ID es un identificador público; no agregar REST API keys al frontend.

## Dashboard de OneSignal

1. Crear una app Web con integración **Custom Code**.
2. Configurar la URL exacta de producción de IdeApp.
3. Desactivar los prompts automáticos; IdeApp solicita permiso desde Ajustes.
4. En la configuración avanzada del service worker usar:
   - Path: `/push/onesignal/`
   - Filename: `OneSignalSDKWorker.js`
   - Scope: `/push/onesignal/`
5. Para desarrollo local, usar una app de OneSignal separada y habilitar localhost.

En iPhone/iPad se requiere iOS 16.4 o posterior, instalar IdeApp en la pantalla de inicio y abrirla desde allí antes de activar recordatorios.
