/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — store.js
   Capa de datos: todo lo que lee y escribe en Firestore pasa por acá.
   Colecciones:
     usuarios/{uid}                 → { nombre, email, rol, creado }
     obras/{id}                     → { codigo, nombre, activa }
     pedidos/{id}                   → ver README (numero, estado, items, ...)
     pedidos/{id}/fotos/{fotoId}    → { base64, etapa, usuarioNombre, ts }
     contadores/pedidos             → { ultimo } (para el número P-0001)
   ============================================================================ */

window.PO = window.PO || {};

PO.store = {

  /* ---------------------------------------------------------------- usuarios */

  async obtenerUsuario(uid) {
    const snap = await PO.fb.db.collection("usuarios").doc(uid).get();
    return snap.exists ? { uid, ...snap.data() } : null;
  },

  async crearUsuario(uid, datos) {
    await PO.fb.db.collection("usuarios").doc(uid).set({
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      creado: PO.fb.tsServidor()
    });
  },

  /* ------------------------------------------------------------------- obras */

  subObras(cb) {
    return PO.fb.db.collection("obras").orderBy("codigo")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando obras:", err)
      );
  },

  async crearObra(codigo, nombre) {
    await PO.fb.db.collection("obras").add({
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      activa: true
    });
  },

  async setObraActiva(obraId, activa) {
    await PO.fb.db.collection("obras").doc(obraId).update({ activa });
  },

  /* ----------------------------------------------------------------- pedidos */

  subPedidos(cb) {
    return PO.fb.db.collection("pedidos").orderBy("creado", "desc").limit(300)
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando pedidos:", err)
      );
  },

  /** Crea el pedido con número secuencial legible (P-0001) usando una
      transacción sobre contadores/pedidos, y sube las fotos iniciales. */
  async crearPedido(datos, fotosBase64, usuarioNombre) {
    const db = PO.fb.db;
    const contadorRef = db.collection("contadores").doc("pedidos");
    const pedidoRef = db.collection("pedidos").doc();

    const numero = await db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      const n = ((snap.exists && snap.data().ultimo) || 0) + 1;
      const num = "P-" + String(n).padStart(4, "0");
      tx.set(contadorRef, { ultimo: n });
      tx.set(pedidoRef, { ...datos, numero: num });
      return num;
    });

    for (const b64 of (fotosBase64 || [])) {
      await pedidoRef.collection("fotos").add({
        base64: b64,
        etapa: "pedido",
        usuarioNombre,
        ts: PO.fb.tsAhora()
      });
    }

    return { id: pedidoRef.id, numero };
  },

  async actualizarPedido(pedidoId, cambios) {
    await PO.fb.db.collection("pedidos").doc(pedidoId).update(cambios);
  },

  /* ------------------------------------------------------------------- fotos */

  subFotos(pedidoId, cb) {
    return PO.fb.db.collection("pedidos").doc(pedidoId)
      .collection("fotos").orderBy("ts")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando fotos:", err)
      );
  },

  async agregarFoto(pedidoId, base64, etapa, usuarioNombre) {
    await PO.fb.db.collection("pedidos").doc(pedidoId).collection("fotos").add({
      base64, etapa, usuarioNombre, ts: PO.fb.tsAhora()
    });
  },

  /* ---------------------------------------------------------- notificaciones */

  /** POST al webhook (n8n) en cada cambio de estado. Fire-and-forget:
      nunca bloquea la UI y los errores se ignoran en silencio. */
  notificar(evento, pedido, usuarioNombre) {
    const url = (window.APP_CONFIG || {}).WEBHOOK_URL;
    if (!url) return;
    try {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento,
          pedido: {
            numero: pedido.numero,
            obraCodigo: pedido.obraCodigo,
            estado: pedido.estado,
            solicitanteNombre: pedido.solicitanteNombre,
            items: pedido.items
          },
          usuario: usuarioNombre,
          ts: new Date().toISOString()
        })
      }).catch(() => {});
    } catch (e) { /* silencio */ }
  }
};
