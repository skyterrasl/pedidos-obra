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

  /** ¿Hay una sesión de Gestión que se pueda usar acá? */
  hayGestion() {
    return this.dentroDelErp() && !!this.tokenErp();
  },

  /** ¿Se entra solo? Solo si hay sesión de Gestión y no se salió a propósito. */
  disponible() {
    return this.hayGestion() && !this.salioAProposito();
  },

  /** Entra con usuario y contraseña del ERP. Es el camino normal: no
      necesita que haya una sesión de Gestión abierta de antes. */
  async entrarConClave(usuario, clave) {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, clave })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) {
      const e = new Error(d.error || "No pudimos verificar tu usuario.");
      e.deCredenciales = r.status === 401 || r.status === 403;
      throw e;
    }
    // Queda la misma sesión que usa Gestión: si después abre el ERP, ya está
    // adentro, y al volver acá entra solo.
    try { localStorage.setItem("st-token", d.token); } catch (e) {}
    this.limpiarSalida();

    const paso = await this.entrar();
    if (!paso.ok) {
      const e = new Error(paso.error || "No pudimos entrar.");
      e.sinAcceso = paso.sinAcceso;
      throw e;
    }
    return paso;
  },

  /** Pide el pase y entra. Devuelve:
        { ok: true }                 entró
        { ok: false, sinAcceso }     el usuario del ERP no tiene permiso acá
        { ok: false, error }         no se pudo (sin red, sesión vencida, etc.) */
  async entrar() {
    if (!this.disponible()) return { ok: false, error: "sin sesión del ERP" };

    // Al abrir la app por primera vez, el service worker se está instalando y
    // toma el control a mitad de camino: eso corta el pedido en vuelo con un
    // "Failed to fetch" que no tiene nada que ver con la conexión. Por eso se
    // reintenta un par de veces antes de darse por vencido.
    let ultimo = null;
    for (let intento = 0; intento < 3; intento++) {
      try {
        const r = await fetch("/api/pedidos/pase", {
          headers: { "x-token": this.tokenErp() },
          cache: "no-store"
        });
        const d = await r.json().catch(() => ({}));

        if (r.status === 403) return { ok: false, sinAcceso: true, error: d.error };
        if (!r.ok || !d.token) return { ok: false, error: d.error || ("Error " + r.status) };

        await PO.fb.auth.signInWithCustomToken(d.token);
        return { ok: true, rol: d.rol };
      } catch (e) {
        ultimo = e;
        console.warn("[PO] Intento " + (intento + 1) + " de entrar con Gestión:", e.message);
        await new Promise((r) => setTimeout(r, 400 * (intento + 1)));
      }
    }
    return { ok: false, error: (ultimo && ultimo.message) || "no se pudo conectar" };
  },

  /* --- Salir a propósito -----------------------------------------------
       Sin esto, cerrar sesión no se notaría: la app volvería a entrar sola con
       la sesión de Gestión y parecería que el botón no hizo nada. La marca es
       de este dispositivo y se borra al volver a entrar. */

  MARCA: "po-salio",

  marcarSalida() {
    try { localStorage.setItem(this.MARCA, "1"); } catch (e) {}
  },

  limpiarSalida() {
    try { localStorage.removeItem(this.MARCA); } catch (e) {}
  },

  salioAProposito() {
    try { return localStorage.getItem(this.MARCA) === "1"; } catch (e) { return false; }
  }
};
