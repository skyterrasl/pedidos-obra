/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — push.js
   Notificaciones al celular, sin depender de WhatsApp.

   Cómo funciona: el navegador se suscribe y devuelve un "endpoint" propio de
   ese dispositivo. Se guarda en el perfil del usuario (usuarios/{uid}.pushSubs)
   y el servicio del VPS es el que después firma y entrega el aviso — el
   navegador no puede mandarse notificaciones a sí mismo estando cerrado.

   Un usuario puede tener varios dispositivos, así que pushSubs es una lista.

   iPhone: SOLO funciona con la app agregada a la pantalla de inicio. En
   Safari normal la API existe pero el permiso nunca se concede; por eso se
   detecta el caso y se explica, en vez de fallar sin decir nada.
   ============================================================================ */

window.PO = window.PO || {};

PO.push = {
  /** El navegador tiene lo necesario (service worker + push + permisos). */
  soportado() {
    return "serviceWorker" in navigator &&
           "PushManager" in window &&
           "Notification" in window;
  },

  /** ¿Está corriendo como app instalada? En iOS es condición para el push. */
  esPWA() {
    return window.matchMedia("(display-mode: standalone)").matches ||
           window.navigator.standalone === true;
  },

  esIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  },

  /** Motivo por el que no se puede activar acá, o null si sí se puede. */
  impedimento() {
    if (!this.soportado()) {
      return this.esIOS()
        ? "Tu iPhone no tiene una versión de iOS que soporte avisos (hace falta iOS 16.4 o más nuevo)."
        : "Este navegador no soporta notificaciones.";
    }
    if (this.esIOS() && !this.esPWA()) {
      return "En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio: " +
             "tocá Compartir → “Agregar a inicio” y abrila desde ahí.";
    }
    if (Notification.permission === "denied") {
      return "Bloqueaste los avisos para esta app. Se habilitan desde los ajustes del teléfono " +
             "(Ajustes → Notificaciones → Pedidos de Obra).";
    }
    return null;
  },

  /** ¿Este dispositivo ya está suscripto? */
  async estaActivo() {
    if (!this.soportado()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!(await reg.pushManager.getSubscription());
    } catch (e) { return false; }
  },

  /** Pide permiso, se suscribe y devuelve la suscripción lista para guardar.
      Tiene que llamarse desde un toque del usuario (lo exige el navegador). */
  async activar() {
    const traba = this.impedimento();
    if (traba) throw new Error(traba);

    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") throw new Error("No diste permiso para los avisos.");

    const reg = await navigator.serviceWorker.ready;
    const existente = await reg.pushManager.getSubscription();
    if (existente) return existente.toJSON();

    const clave = (window.APP_CONFIG || {}).VAPID_PUBLICA;
    if (!clave) throw new Error("Falta configurar la clave de notificaciones.");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ABytes(clave)
    });
    return sub.toJSON();
  },

  /** Corta los avisos en ESTE dispositivo. Devuelve el endpoint dado de baja. */
  async desactivar() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  },

  /** Manda el aviso a los dispositivos indicados. Devuelve los endpoints que
      el servicio reportó como vencidos, para poder limpiarlos del perfil. */
  async enviar({ titulo, cuerpo, url, subs }) {
    const destino = (window.APP_CONFIG || {}).PUSH_URL;
    if (!destino || !subs || !subs.length) return { enviados: 0, vencidos: [] };
    try {
      const r = await fetch(destino, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-key": (window.APP_CONFIG || {}).WEBHOOK_KEY || ""
        },
        body: JSON.stringify({ titulo, cuerpo, url, subs })
      });
      return await r.json();
    } catch (e) {
      console.warn("[PO] No se pudo enviar el push:", e);
      return { enviados: 0, vencidos: [] };
    }
  }
};

/** La clave VAPID viene en base64url y subscribe() pide bytes. */
function base64ABytes(base64url) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = window.atob(base64);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}
