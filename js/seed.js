/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — seed.js
   Datos de ejemplo para probar la app con la base recién creada.
   Solo lo ve el admin cuando no hay obras ni pedidos (botón en el Dashboard).
   Carga: 3 obras, los rubros, 2 proveedores y 10 pedidos en distintos estados
   (incluido uno con dos recepciones parciales, incidencia y fotos de remito).

   NOTA: los usuarios de prueba NO se pueden crear desde acá (Firebase Auth
   no permite crear otras cuentas sin desloguearse): se crean entrando a la
   app con los códigos de invitación (ver README).
   ============================================================================ */

window.PO = window.PO || {};

PO.seed = {

  /** Genera una "foto de remito" de mentira con canvas (JPEG chico). */
  fotoRemito(proveedor, numero) {
    const c = document.createElement("canvas");
    c.width = 800; c.height = 560;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 800, 560);
    g.strokeStyle = "#333"; g.lineWidth = 3; g.strokeRect(14, 14, 772, 532);
    g.fillStyle = "#111";
    g.font = "bold 34px Arial"; g.fillText(proveedor.toUpperCase(), 40, 70);
    g.font = "bold 26px Arial"; g.fillText("REMITO N° " + numero, 40, 115);
    g.font = "18px Arial"; g.fillStyle = "#444";
    g.fillText("Fecha: " + new Date().toLocaleDateString("es-AR"), 40, 150);
    g.fillText("(Comprobante de ejemplo generado por la app)", 40, 178);
    g.strokeStyle = "#bbb"; g.lineWidth = 1;
    for (let y = 220; y <= 480; y += 44) {
      g.beginPath(); g.moveTo(40, y); g.lineTo(760, y); g.stroke();
    }
    return c.toDataURL("image/jpeg", 0.8);
  },

  async cargarDatosEjemplo(usuario) {
    const db = PO.fb.db;
    const T = firebase.firestore.Timestamp;
    const ts = (diasAtras) => T.fromDate(new Date(Date.now() - diasAtras * 86400000));
    const fecha = (dias) => {
      const d = new Date(Date.now() + dias * 86400000);
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    };
    const h = (dias, accion, quien, nota) =>
      ({ accion, usuarioNombre: quien, ts: ts(dias), nota: nota || "" });

    const RUBROS = window.APP_CONFIG.RUBROS_DEFAULT || [];
    const CORRALON = "HORMIGONES";
    const yo = usuario.nombre;
    const demo1 = { uid: "demo-jorge", nombre: "Jorge Paz (demo)" };
    const demo2 = { uid: "demo-luis", nombre: "Luis Ferreyra (demo)" };

    const batch = db.batch();

    /* Rubros */
    RUBROS.forEach((nombre) => batch.set(db.collection("rubros").doc(), { nombre }));

    /* Obras (los tres quedan asignados al admin que carga el seed,
       para poder probar recepciones; después se asignan los directores reales) */
    const oMol = db.collection("obras").doc();
    const oCar = db.collection("obras").doc();
    const oSan = db.collection("obras").doc();
    batch.set(oMol, {
      nombre: "MOL-1047 · Casa Molina", direccion: "Los Teros 1047, Manzanares",
      cliente: "Familia Molteni", estado: "activa", directores: [usuario.uid]
    });
    batch.set(oCar, {
      nombre: "CAR-233 · Cardales Village", direccion: "Ruta 4 km 5, Los Cardales",
      cliente: "Inversores CV", estado: "activa", directores: [usuario.uid]
    });
    batch.set(oSan, {
      nombre: "SAN-118 · Santa Elena", direccion: "Santa Elena lote 118, Pilar",
      cliente: "Familia Duarte", estado: "pausada", directores: [usuario.uid]
    });

    /* Proveedores */
    batch.set(db.collection("proveedores").doc(), {
      nombre: "Corralón Norte", rubros: [CORRALON, "HERRERIA"],
      telefono: "011 4444-5555", observaciones: "Entrega en obra los martes y jueves"
    });
    batch.set(db.collection("proveedores").doc(), {
      nombre: "Electro Pilar SRL", rubros: ["ELECTRICIDAD"],
      telefono: "0230 466-7788", observaciones: ""
    });

    /* Pedidos */
    const P = (n) => "P-" + String(n).padStart(4, "0");
    const nuevoRef = () => db.collection("pedidos").doc();

    // Las reglas solo permiten CREAR pedidos como borrador/enviado (los
    // estados avanzados se alcanzan por transición): acá se crean como
    // "enviado" y un segundo batch los lleva a su estado final.
    const estadosFinales = [];
    const setPedido = (ref, data) => {
      if (data.estado !== "borrador" && data.estado !== "enviado") {
        estadosFinales.push({ ref, estado: data.estado });
        data = Object.assign({}, data, { estado: "enviado" });
      }
      batch.set(ref, data);
    };

    // P-0001 · entregado (con recepción completa + foto)
    const p1 = nuevoRef();
    setPedido(p1, {
      numero: P(1), obraId: oCar.id, obraNombre: "CAR-233 · Cardales Village",
      rubro: "HERRERIA", solicitanteUid: demo1.uid, solicitanteNombre: demo1.nombre,
      creado: ts(20), prioridad: "normal", fechaNecesaria: fecha(-16), estado: "entregado",
      observaciones: "",
      items: [{ descripcion: "Hierro del 8", cantidad: 200, unidad: "kg", recibido: 200 },
              { descripcion: "Hierro del 6", cantidad: 120, unidad: "kg", recibido: 120 }],
      proveedor: { nombre: "Corralón Norte", fechaEstimada: fecha(-16), oc: "OC-1101",
        observaciones: null, usuarioNombre: yo, ts: ts(19) },
      historial: [h(20, "creado", demo1.nombre), h(20, "enviado", demo1.nombre),
        h(19, "recibido", yo), h(19, "pedido_proveedor", yo, "Proveedor: Corralón Norte · OC: OC-1101"),
        h(16, "recepcion", demo1.nombre, "Recepción completa.\nHierro del 8: +200 kg\nHierro del 6: +120 kg")]
    });

    // P-0002 · entregado
    const p2 = nuevoRef();
    setPedido(p2, {
      numero: P(2), obraId: oMol.id, obraNombre: "MOL-1047 · Casa Molina",
      rubro: "PINTURA", solicitanteUid: demo2.uid, solicitanteNombre: demo2.nombre,
      creado: ts(15), prioridad: "normal", fechaNecesaria: fecha(-10), estado: "entregado",
      observaciones: "Color según muestra aprobada por el cliente.",
      items: [{ descripcion: "Látex interior blanco x 20 lts", cantidad: 6, unidad: "un.", recibido: 6 }],
      proveedor: { nombre: "Pinturería Central", fechaEstimada: fecha(-11), oc: null,
        observaciones: null, usuarioNombre: yo, ts: ts(14) },
      historial: [h(15, "creado", demo2.nombre), h(15, "enviado", demo2.nombre),
        h(14, "recibido", yo), h(14, "pedido_proveedor", yo, "Proveedor: Pinturería Central"),
        h(11, "recepcion", demo2.nombre, "Recepción completa.\nLátex interior blanco x 20 lts: +6 un.")]
    });

    // P-0003 · cancelado
    const p3 = nuevoRef();
    setPedido(p3, {
      numero: P(3), obraId: oSan.id, obraNombre: "SAN-118 · Santa Elena",
      rubro: "SANITARIOS", solicitanteUid: demo1.uid, solicitanteNombre: demo1.nombre,
      creado: ts(12), prioridad: "normal", fechaNecesaria: fecha(-5), estado: "cancelado",
      observaciones: "",
      items: [{ descripcion: "Caño PPR 25 mm x 4 m", cantidad: 30, unidad: "un.", recibido: 0 }],
      proveedor: null,
      historial: [h(12, "creado", demo1.nombre), h(12, "enviado", demo1.nombre),
        h(10, "cancelado", yo, "La obra queda pausada hasta que el cliente confirme la ampliación.")]
    });

    // P-0004 · entrega_parcial (DOS recepciones, una con incidencia + fotos)
    const p4 = nuevoRef();
    setPedido(p4, {
      numero: P(4), obraId: oMol.id, obraNombre: "MOL-1047 · Casa Molina",
      rubro: CORRALON, solicitanteUid: demo2.uid, solicitanteNombre: demo2.nombre,
      creado: ts(8), prioridad: "normal", fechaNecesaria: fecha(1), estado: "entrega_parcial",
      observaciones: "Descargar al fondo del lote, al lado del obrador.",
      items: [
        { descripcion: "Placa de yeso 12,5 mm", cantidad: 60, unidad: "un.", recibido: 20 },
        { descripcion: "Masilla para juntas x 32 kg", cantidad: 4, unidad: "un.", recibido: 4 },
        { descripcion: "Cemento CPC40 x 50 kg", cantidad: 40, unidad: "bolsa", recibido: 0 }
      ],
      proveedor: { nombre: "Corralón Norte", fechaEstimada: fecha(2), oc: "OC-1188",
        observaciones: "Entrega en dos tandas", usuarioNombre: yo, ts: ts(7) },
      historial: [h(8, "creado", demo2.nombre), h(8, "enviado", demo2.nombre),
        h(7, "recibido", yo),
        h(7, "pedido_proveedor", yo, "Proveedor: Corralón Norte · OC: OC-1188 · Entrega en dos tandas"),
        h(3, "recepcion", demo2.nombre, "Recepción parcial.\nPlaca de yeso 12,5 mm: +20 un. (va 20 de 60)\nIncidencia: Llegó dañado\nNota: 5 placas marcadas, las cambia el corralón"),
        h(1, "recepcion", demo2.nombre, "Recepción parcial.\nMasilla para juntas x 32 kg: +4 un. (va 4 de 4)")]
    });

    // P-0005 · pedido_proveedor ATRASADO (fecha estimada vencida)
    const p5 = nuevoRef();
    setPedido(p5, {
      numero: P(5), obraId: oCar.id, obraNombre: "CAR-233 · Cardales Village",
      rubro: "HERRERIA", solicitanteUid: demo1.uid, solicitanteNombre: demo1.nombre,
      creado: ts(7), prioridad: "normal", fechaNecesaria: fecha(-1), estado: "pedido_proveedor",
      observaciones: "",
      items: [{ descripcion: "Malla sima 15x15 6 mm", cantidad: 25, unidad: "un.", recibido: 0 }],
      proveedor: { nombre: "Corralón Norte", fechaEstimada: fecha(-1), oc: null,
        observaciones: null, usuarioNombre: yo, ts: ts(6) },
      historial: [h(7, "creado", demo1.nombre), h(7, "enviado", demo1.nombre),
        h(6, "recibido", yo), h(6, "pedido_proveedor", yo, "Proveedor: Corralón Norte")]
    });

    // P-0006 · pedido_proveedor en fecha
    const p6 = nuevoRef();
    setPedido(p6, {
      numero: P(6), obraId: oSan.id, obraNombre: "SAN-118 · Santa Elena",
      rubro: "ELECTRICIDAD", solicitanteUid: demo1.uid, solicitanteNombre: demo1.nombre,
      creado: ts(4), prioridad: "normal", fechaNecesaria: fecha(6), estado: "pedido_proveedor",
      observaciones: "",
      items: [{ descripcion: "Cable unipolar 2,5 mm² (rollo 100 m)", cantidad: 8, unidad: "un.", recibido: 0 },
              { descripcion: "Caño corrugado 3/4", cantidad: 300, unidad: "ml", recibido: 0 }],
      proveedor: { nombre: "Electro Pilar SRL", fechaEstimada: fecha(3), oc: "OC-1204",
        observaciones: null, usuarioNombre: yo, ts: ts(3) },
      historial: [h(4, "creado", demo1.nombre), h(4, "enviado", demo1.nombre),
        h(3, "recibido", yo), h(3, "pedido_proveedor", yo, "Proveedor: Electro Pilar SRL · OC: OC-1204")]
    });

    // P-0007 · recibido
    const p7 = nuevoRef();
    setPedido(p7, {
      numero: P(7), obraId: oMol.id, obraNombre: "MOL-1047 · Casa Molina",
      rubro: "SANITARIOS", solicitanteUid: demo2.uid, solicitanteNombre: demo2.nombre,
      creado: ts(2), prioridad: "normal", fechaNecesaria: fecha(7), estado: "recibido",
      observaciones: "",
      items: [{ descripcion: "Inodoro con mochila línea Bari", cantidad: 3, unidad: "un.", recibido: 0 },
              { descripcion: "Grifería monocomando cocina", cantidad: 1, unidad: "un.", recibido: 0 }],
      proveedor: null,
      historial: [h(2, "creado", demo2.nombre), h(2, "enviado", demo2.nombre), h(1, "recibido", yo)]
    });

    // P-0008 · enviado
    const p8 = nuevoRef();
    setPedido(p8, {
      numero: P(8), obraId: oCar.id, obraNombre: "CAR-233 · Cardales Village",
      rubro: "PINTURA", solicitanteUid: demo1.uid, solicitanteNombre: demo1.nombre,
      creado: ts(1), prioridad: "normal", fechaNecesaria: fecha(10), estado: "enviado",
      observaciones: "",
      items: [{ descripcion: "Enduido plástico x 20 kg", cantidad: 5, unidad: "un.", recibido: 0 }],
      proveedor: null,
      historial: [h(1, "creado", demo1.nombre), h(1, "enviado", demo1.nombre)]
    });

    // P-0009 · enviado URGENTE
    const p9 = nuevoRef();
    setPedido(p9, {
      numero: P(9), obraId: oMol.id, obraNombre: "MOL-1047 · Casa Molina",
      rubro: CORRALON, solicitanteUid: demo2.uid, solicitanteNombre: demo2.nombre,
      creado: ts(0.2), prioridad: "urgente", fechaNecesaria: fecha(1), estado: "enviado",
      observaciones: "Se paró el hormigonado del contrapiso: falta cemento.",
      items: [{ descripcion: "Cemento CPC40 x 50 kg", cantidad: 20, unidad: "bolsa", recibido: 0 },
              { descripcion: "Arena fina", cantidad: 3, unidad: "m³", recibido: 0 }],
      proveedor: null,
      historial: [h(0.2, "creado", demo2.nombre), h(0.2, "enviado", demo2.nombre)]
    });

    // Borrador propio del admin que carga el seed (sin número)
    const p10 = nuevoRef();
    setPedido(p10, {
      numero: null, obraId: oMol.id, obraNombre: "MOL-1047 · Casa Molina",
      rubro: "HERRERIA", solicitanteUid: usuario.uid, solicitanteNombre: yo,
      creado: ts(0.1), prioridad: "normal", fechaNecesaria: fecha(14), estado: "borrador",
      observaciones: "Confirmar medidas con el herrero antes de enviar.",
      items: [{ descripcion: "Baranda de escalera (según plano H-02)", cantidad: 1, unidad: "un.", recibido: 0 }],
      proveedor: null,
      historial: [h(0.1, "creado", yo)]
    });

    /* Contador: quedaron usados P-0001 a P-0009 */
    batch.set(db.collection("contadores").doc("pedidos"), { ultimo: 9 });

    await batch.commit();

    /* Segundo paso: transiciones a los estados finales (permitidas al admin) */
    if (estadosFinales.length) {
      const batch2 = db.batch();
      estadosFinales.forEach(({ ref, estado }) => batch2.update(ref, { estado }));
      await batch2.commit();
    }

    /* Recepciones + fotos de remito (después del batch: van en subcolecciones) */
    const fotoA = this.fotoRemito("Corralón Norte", "0001-00023410");
    const fotoB = this.fotoRemito("Corralón Norte", "0001-00023488");

    // P-0001: recepción completa con foto
    const r1 = await p1.collection("recepciones").add({
      items: [{ idx: 0, descripcion: "Hierro del 8", cantidad: 200 },
              { idx: 1, descripcion: "Hierro del 6", cantidad: 120 }],
      usuarioNombre: demo1.nombre, ts: ts(16), nota: "", incidencia: null
    });
    await p1.collection("fotos").add({
      base64: fotoA, tipo: "imagen", recepcionId: r1.id,
      usuarioNombre: demo1.nombre, ts: ts(16)
    });

    // P-0004: dos recepciones parciales, la primera con incidencia y foto
    const r2 = await p4.collection("recepciones").add({
      items: [{ idx: 0, descripcion: "Placa de yeso 12,5 mm", cantidad: 20 }],
      usuarioNombre: demo2.nombre, ts: ts(3),
      nota: "5 placas marcadas, las cambia el corralón", incidencia: "Llegó dañado"
    });
    await p4.collection("fotos").add({
      base64: fotoB, tipo: "imagen", recepcionId: r2.id,
      usuarioNombre: demo2.nombre, ts: ts(3)
    });
    await p4.collection("recepciones").add({
      items: [{ idx: 1, descripcion: "Masilla para juntas x 32 kg", cantidad: 4 }],
      usuarioNombre: demo2.nombre, ts: ts(1), nota: "", incidencia: null
    });
  }
};
