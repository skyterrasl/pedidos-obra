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

      // Mails de Firebase (reset de contraseña, etc.) en español.
      this.auth.languageCode = "es";

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

  /** Da de alta a otro usuario SIN cerrar la sesión de quien lo está creando.
      Firebase, al crear una cuenta, loguea automáticamente a esa cuenta en la
      app: por eso el alta se hace en una segunda instancia descartable, y el
      perfil se escribe desde ahí (así el uid coincide y las reglas lo aceptan
      sin darle a nadie permiso para escribir perfiles ajenos).
      Devuelve el uid del usuario nuevo. */
  async crearOtroUsuario({ email, password, nombre, rol }) {
    const cfg = window.FIREBASE_CONFIG;
    const nombreApp = "alta-usuario";
    const previa = firebase.apps.find((a) => a.name === nombreApp);
    const app2 = previa || firebase.initializeApp(cfg, nombreApp);

    try {
      const cred = await app2.auth().createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      await app2.firestore().collection("usuarios").doc(uid).set({
        nombre, email, rol, activo: true,
        whatsapp: "",
        avisos: { pedido_nuevo: true, pedido_proveedor: true, recepcion: true },
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      return uid;
    } finally {
      // Pase lo que pase, la instancia se cierra: no puede quedar una sesión
      // paralela viva con la cuenta recién creada.
      try { await app2.auth().signOut(); } catch (e) { /* ya estaba cerrada */ }
      try { await app2.delete(); } catch (e) { /* ya estaba borrada */ }
    }
  },

  /** Manda el mail de "restablecer contraseña" a la dirección indicada. */
  resetearPassword(email) { return this.auth.sendPasswordResetEmail(email); },

  /** Marca de tiempo del servidor (solo para campos de primer nivel). */
  tsServidor() { return firebase.firestore.FieldValue.serverTimestamp(); },

  /** Marca de tiempo local (Firestore no permite serverTimestamp dentro de
      arrays, así que el historial usa esta). */
  tsAhora() { return firebase.firestore.Timestamp.now(); }
};
