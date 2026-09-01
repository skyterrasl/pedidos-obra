/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — sso-erp.js
   Entrar una sola vez.

   Cuando la app se sirve como módulo del ERP (gestion.skyterra.com.ar/pedidos/)
   comparte origen con él, así que puede leer su sesión: si el ERP ya tiene un
   usuario adentro, le pide al servidor un "pase" de Firebase a su nombre y
   entra sola. Nadie escribe dos contraseñas.

   Fuera del ERP (GitHub Pages, o el ERP sin sesión) esto no hace nada y el
   login normal sigue como siempre.

   El pase lo firma el ERP con la clave privada de Firebase, que vive en el
   VPS: desde acá no se puede fabricar uno.
   ============================================================================ */

window.PO = window.PO || {};

PO.sso = {
  /** El token de sesión del ERP, si estamos dentro de él. */
  tokenErp() {
    try { return localStorage.getItem("st-token"); } catch (e) { return null; }
  },

  /** ¿Estamos servidos por el ERP? (mismo origen que su API) */
  dentroDelErp() {
    return location.pathname.indexOf("/pedidos/") === 0 || location.hostname.startsWith("pedidos.");
  },

  /** ¿Se puede intentar la entrada automática? */
  disponible() {
    return this.dentroDelErp() && !!this.tokenErp();
  },

  /** Pide el pase y entra. Devuelve:
        { ok: true }                 entró
        { ok: false, sinAcceso }     el usuario del ERP no tiene permiso acá
        { ok: false, error }         no se pudo (sin red, sesión vencida, etc.) */
  async entrar() {
    if (!this.disponible()) return { ok: false, error: "sin sesión del ERP" };
    try {
      const r = await fetch("/api/pedidos/pase", {
        headers: { "x-token": this.tokenErp() }
      });
      const d = await r.json().catch(() => ({}));

      if (r.status === 403) return { ok: false, sinAcceso: true, error: d.error };
      if (!r.ok || !d.token) return { ok: false, error: d.error || ("Error " + r.status) };

      await PO.fb.auth.signInWithCustomToken(d.token);
      return { ok: true, rol: d.rol };
    } catch (e) {
      console.warn("[PO] No se pudo entrar con la sesión del ERP:", e);
      return { ok: false, error: e.message };
    }
  },

  /** Al salir de Pedidos estando dentro del ERP, se vuelve al ERP en vez de
      quedarse en una pantalla de login que no corresponde. */
  volverAlErp() {
    location.href = "/";
  }
};
