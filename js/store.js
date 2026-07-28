/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — store.js
   Capa de datos: todo lo que lee y escribe en Firestore pasa por acá.

   Colecciones (el "modelo relacional" mapeado a documentos):
     usuarios/{uid}        → { nombre, email, rol, activo, whatsapp, avisos, creado }
     usuarios/{uid}/notificaciones/{nid} → { texto, pedidoId, leida, ts }
     obras/{id}            → { nombre, direccion, cliente, estado, directores[uid] }
     rubros/{id}           → { nombre }
     proveedores/{id}      → { nombre, rubros[], telefono, observaciones }
     pedidos/{id}          → { numero, obraId, obraNombre, rubro, solicitante...,
                               prioridad, fechaNecesaria, estado, items[],
                               proveedor{} | null, historial[] }
     pedidos/{id}/recepciones/{rid} → { items[{idx,descripcion,cantidad}],
                                        usuarioNombre, ts, nota }
     pedidos/{id}/fotos/{fid}       → { base64, tipo, recepcionId,
                                        usuarioNombre, ts }
     contadores/pedidos    → { ultimo }  (numeración P-0001)
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
      activo: true,
      whatsapp: "",
      avisos: { pedido_nuevo: true, pedido_proveedor: true, recepcion: true },
      creado: PO.fb.tsServidor()
    });
  },

  subUsuarios(cb) {
    return PO.fb.db.collection("usuarios").orderBy("nombre")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando usuarios:", err)
      );
  },

  async actualizarUsuario(uid, cambios) {
    await PO.fb.db.collection("usuarios").doc(uid).update(cambios);
  },

  /* ------------------------------------------------------------------- obras */

  subObras(cb) {
    return PO.fb.db.collection("obras").orderBy("nombre")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando obras:", err)
      );
  },

  /** Alta o edición de obra (id null → alta). */
  async guardarObra(id, datos) {
    const col = PO.fb.db.collection("obras");
    if (id) await col.doc(id).update(datos);
    else await col.add(datos);
  },

  /** Borra una obra (solo admin, ver firestore.rules). Los pedidos que la
      referenciaban conservan su obraNombre, así que el historial se sigue
      leyendo. Para una obra que ya trabajó, preferir estado "finalizada". */
  async borrarObra(id) {
    await PO.fb.db.collection("obras").doc(id).delete();
  },

  /* ------------------------------------------------------------------ rubros */

  subRubros(cb) {
    return PO.fb.db.collection("rubros").orderBy("nombre")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando rubros:", err)
      );
  },

  async guardarRubro(id, nombre) {
    const col = PO.fb.db.collection("rubros");
    if (id) await col.doc(id).update({ nombre });
    else await col.add({ nombre });
  },

  async borrarRubro(id) {
    await PO.fb.db.collection("rubros").doc(id).delete();
  },

  /* ------------------------------------------------------------- proveedores */

  subProveedores(cb) {
    return PO.fb.db.collection("proveedores").orderBy("nombre")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando proveedores:", err)
      );
  },

  async guardarProveedor(id, datos) {
    const col = PO.fb.db.collection("proveedores");
    if (id) await col.doc(id).update(datos);
    else await col.add(datos);
  },

  async borrarProveedor(id) {
    await PO.fb.db.collection("proveedores").doc(id).delete();
  },

  /* ----------------------------------------------------------------- pedidos */

  subPedidos(cb) {
    return PO.fb.db.collection("pedidos").orderBy("creado", "desc").limit(500)
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando pedidos:", err)
      );
  },

  /** Crea un pedido. Si nace "enviado" recibe número secuencial (P-0001)
      vía transacción; un borrador queda sin número hasta que se envía. */
  async crearPedido(datos) {
    const db = PO.fb.db;
    const pedidoRef = db.collection("pedidos").doc();

    if (datos.estado === "borrador") {
      await pedidoRef.set({ ...datos, numero: null });
      return { id: pedidoRef.id, numero: null };
    }

    const contadorRef = db.collection("contadores").doc("pedidos");
    const numero = await db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      const n = ((snap.exists && snap.data().ultimo) || 0) + 1;
      const num = "P-" + String(n).padStart(4, "0");
      tx.set(contadorRef, { ultimo: n });
      tx.set(pedidoRef, { ...datos, numero: num });
      return num;
    });
    return { id: pedidoRef.id, numero };
  },

  /** Envía un borrador: le asigna número y lo pasa a "enviado". */
  async enviarBorrador(pedidoId, cambios) {
    const db = PO.fb.db;
    const contadorRef = db.collection("contadores").doc("pedidos");
    const pedidoRef = db.collection("pedidos").doc(pedidoId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      const n = ((snap.exists && snap.data().ultimo) || 0) + 1;
      const num = "P-" + String(n).padStart(4, "0");
      tx.set(contadorRef, { ultimo: n });
      tx.update(pedidoRef, { ...cambios, numero: num, estado: "enviado" });
      return num;
    });
  },

  async actualizarPedido(pedidoId, cambios) {
    await PO.fb.db.collection("pedidos").doc(pedidoId).update(cambios);
  },

  /** Reclamo rápido (1 toque, sin nota): no cambia el estado, solo deja
      constancia en el historial y avisa YA a la contraparte — para el patrón
      real de "se atrasó, avisale" en vez de esperar la alerta diaria. */
  async reclamarPedido(pedido, actor) {
    const entry = { accion: "reclamo", usuarioNombre: actor.nombre, ts: PO.fb.tsAhora(), nota: "" };
    await this.actualizarPedido(pedido.id, { historial: (pedido.historial || []).concat([entry]) });
    this.notificarTransicion("reclamo", pedido, actor);
  },

  async borrarPedido(pedidoId) {
    await PO.fb.db.collection("pedidos").doc(pedidoId).delete();
  },

  /* ------------------------------------------------------------- recepciones */

  subRecepciones(pedidoId, cb) {
    return PO.fb.db.collection("pedidos").doc(pedidoId)
      .collection("recepciones").orderBy("ts", "desc")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando recepciones:", err)
      );
  },

  /** Registra una recepción: crea el doc de recepción, sus fotos de remito
      (cada foto es un doc aparte por el límite de 1 MB) y actualiza el
      pedido (items con lo recibido, estado nuevo, historial). */
  async agregarRecepcion(pedidoId, recepcion, fotos, cambiosPedido) {
    const pedidoRef = PO.fb.db.collection("pedidos").doc(pedidoId);
    const recRef = await pedidoRef.collection("recepciones").add(recepcion);
    for (const f of (fotos || [])) {
      await pedidoRef.collection("fotos").add({
        base64: f.base64,
        tipo: f.tipo || "imagen",
        recepcionId: recRef.id,
        usuarioNombre: recepcion.usuarioNombre,
        ts: PO.fb.tsAhora()
      });
    }
    await pedidoRef.update(cambiosPedido);
    return recRef.id;
  },

  subFotos(pedidoId, cb) {
    return PO.fb.db.collection("pedidos").doc(pedidoId)
      .collection("fotos").orderBy("ts")
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando fotos:", err)
      );
  },

  /* ---------------------------------------------------------- notificaciones */

  subNotificaciones(uid, cb) {
    return PO.fb.db.collection("usuarios").doc(uid)
      .collection("notificaciones").orderBy("ts", "desc").limit(50)
      .onSnapshot(
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.error("[PO] Error escuchando notificaciones:", err)
      );
  },

  async marcarLeida(uid, nid) {
    await PO.fb.db.collection("usuarios").doc(uid)
      .collection("notificaciones").doc(nid).update({ leida: true });
  },

  async marcarTodasLeidas(uid, notificaciones) {
    const batch = PO.fb.db.batch();
    notificaciones.filter((n) => !n.leida).forEach((n) => {
      batch.update(
        PO.fb.db.collection("usuarios").doc(uid).collection("notificaciones").doc(n.id),
        { leida: true }
      );
    });
    await batch.commit();
  },

  /** Texto humano de cada evento (campana y base del mensaje de WhatsApp). */
  textoEvento(evento, pedido, actor) {
    const num = pedido.numero || "un pedido";
    const obra = pedido.obraNombre || "";
    switch (evento) {
      case "enviado":
        return (pedido.prioridad === "urgente" ? "URGENTE · " : "") +
          "Nuevo pedido " + num + " · " + obra + " (" + pedido.rubro + ") de " + pedido.solicitanteNombre;
      case "pedido_proveedor":
        return num + " pedido a " + ((pedido.proveedor && pedido.proveedor.nombre) || "proveedor") +
          ((pedido.proveedor && pedido.proveedor.fechaEstimada) ? " · llega " + pedido.proveedor.fechaEstimada : "");
      case "entrega_parcial":
        return "Recepción parcial en " + num + " · " + obra + " (" + actor.nombre + ")";
      case "entregado":
        return num + " entregado completo · " + obra;
      case "cancelado":
        return num + " cancelado por " + actor.nombre + " · " + obra;
      case "reclamo":
        return "RECLAMO de " + actor.nombre + " · " + num + " · " + obra;
      default:
        return num + ": " + evento;
    }
  },

  /** Notifica una transición de estado:
      1) campana in-app (subcolección notificaciones de cada destinatario) y
      2) webhook de n8n (WhatsApp vía Evolution API) con los destinatarios ya
         filtrados por número cargado + preferencia activada.
      Audiencia:
        enviado / entrega_parcial / entregado → todos los admins
        pedido_proveedor                      → el director del pedido
        cancelado / reclamo                   → la contraparte del que actuó
      Fire-and-forget: no bloquea la UI, los errores solo se loguean. */
  async notificarTransicion(evento, pedido, actor) {
    try {
      const notificaContraparte = ["cancelado", "reclamo"]; // avisa al "otro lado" de quien actuó
      const haciaAdmins =
        ["enviado", "entrega_parcial", "entregado"].includes(evento) ||
        (notificaContraparte.includes(evento) && actor.rol !== "admin");

      let destinatarios = [];
      if (haciaAdmins) {
        const snap = await PO.fb.db.collection("usuarios").where("rol", "==", "admin").get();
        destinatarios = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      } else {
        const u = await this.obtenerUsuario(pedido.solicitanteUid);
        if (u) destinatarios = [u];
      }
      destinatarios = destinatarios.filter((u) => u.activo !== false && u.uid !== actor.uid);

      const texto = this.textoEvento(evento, pedido, actor);

      // 1) Campana in-app
      for (const u of destinatarios) {
        PO.fb.db.collection("usuarios").doc(u.uid).collection("notificaciones").add({
          texto, pedidoId: pedido.id, leida: false, ts: PO.fb.tsAhora()
        }).catch(() => {});
      }

      // 2) Webhook (n8n → WhatsApp). Toggle de preferencia por tipo de aviso.
      const url = (window.APP_CONFIG || {}).WEBHOOK_URL;
      if (!url) return;
      const toggle = {
        enviado: "pedido_nuevo",
        pedido_proveedor: "pedido_proveedor",
        entrega_parcial: "recepcion",
        entregado: "recepcion"
      }[evento] || null; // cancelado y reclamo: sin toggle, avisan siempre

      const dest = destinatarios
        .filter((u) => u.whatsapp && (!toggle || !u.avisos || u.avisos[toggle] !== false))
        .map((u) => ({ whatsapp: u.whatsapp, nombre: u.nombre }));

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-key": (window.APP_CONFIG || {}).WEBHOOK_KEY || ""
        },
        body: JSON.stringify({
          evento,
          pedido: {
            numero: pedido.numero,
            obraNombre: pedido.obraNombre,
            rubro: pedido.rubro,
            prioridad: pedido.prioridad,
            estado: pedido.estado,
            fechaEstimada: (pedido.proveedor && pedido.proveedor.fechaEstimada) || null
          },
          destinatarios: dest,
          usuario: actor.nombre,
          ts: new Date().toISOString()
        })
      }).catch(() => {});
    } catch (e) {
      console.warn("[PO] No se pudo notificar la transición:", e);
    }
  }
};
