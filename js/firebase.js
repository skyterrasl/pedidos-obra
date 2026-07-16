/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — firebase.js
   Inicializa Firebase (Auth + Firestore) y detecta si falta la configuración.
   Crea el espacio de nombres global PO (Pedidos de Obra) que usan los demás
   archivos. Activa persistencia offline de Firestore y login persistente.
   ============================================================================ */

window.PO = window.PO || {};

PO.fb = {
  app: null,
  db: null,
  auth: null,
  configurado: false,

  /** Arranca Firebase. Devuelve true si quedó listo, false si faltan claves. */
  init() {
    const cfg = window.FIREBASE_CONFIG || {};
    const valores = Object.values(cfg).join(" ");

    // ¿Todavía no se pegaron las claves? Avisamos con una pantalla amable
    // en vez de romper.
    const sinConfigurar = !cfg.apiKey || !cfg.projectId || valores.includes("REEMPLAZAR");
    if (sinConfigurar) {
      this.configurado = false;
      console.warn("[PO] Firebase no está configurado. Editá js/firebase-config.js (ver README.md).");
      return false;
    }

    try {
      this.app = firebase.initializeApp(cfg);
      this.auth = firebase.auth();
      this.db = firebase.firestore();

      // Login persistente: se loguea una vez y queda en el dispositivo.
      this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

      // Cache offline de Firestore: si en la obra hay mala señal, la app sigue
      // mostrando lo último que vio y sincroniza al volver la conexión.
      this.db.enablePersistence({ synchronizeTabs: true }).catch(() => { /* no crítico */ });

      this.configurado = true;
      return true;
    } catch (e) {
      console.error("[PO] Error inicializando Firebase:", e);
      this.configurado = false;
      return false;
    }
  },

  /** Marca de tiempo del servidor (solo para campos de primer nivel). */
  tsServidor() { return firebase.firestore.FieldValue.serverTimestamp(); },

  /** Marca de tiempo local (Firestore no permite serverTimestamp dentro de
      arrays, así que el historial usa esta). */
  tsAhora() { return firebase.firestore.Timestamp.now(); }
};
