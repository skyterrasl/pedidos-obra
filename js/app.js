/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — app.js
   Toda la interfaz: login/registro, dashboard, listado con filtros y export,
   nuevo pedido (con borradores y autoguardado), detalle con recepciones y
   fotos de remito, gestión (obras/rubros/proveedores/usuarios), perfil y
   campana de notificaciones. Tres roles: director / admin / control.
   ============================================================================ */

window.PO = window.PO || {};

(function () {
  "use strict";

  /* ------------------------------------------------------------ helpers --- */

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function haceCuanto(ts) {
    const d = ts && ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
    if (!d) return "recién";
    const min = Math.floor((Date.now() - d.getTime()) / 60000);
    if (min < 1) return "recién";
    if (min < 60) return "hace " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "hace " + h + " h";
    const dias = Math.floor(h / 24);
    return dias === 1 ? "hace 1 día" : "hace " + dias + " días";
  }

  function fmtFecha(iso) {
    if (!iso) return "—";
    const p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function fmtTs(ts) {
    const d = ts && ts.toDate ? ts.toDate() : null;
    if (!d) return "";
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function tsAFechaISO(ts) {
    const d = ts && ts.toDate ? ts.toDate() : null;
    if (!d) return "";
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function fmtCant(n) {
    const v = Math.round(Number(n || 0) * 100) / 100;
    return String(v).replace(".", ",");
  }

  function parseCant(s) {
    const n = Number(String(s == null ? "" : s).trim().replace(",", "."));
    return isNaN(n) ? 0 : n;
  }

  /* --------------------------------------------------------- constantes --- */

  const ESTADOS = {
    borrador:         "Borrador",
    enviado:          "Enviado",
    recibido:         "Recibido",
    pedido_proveedor: "Pedido al proveedor",
    entrega_parcial:  "Entrega parcial",
    entregado:        "Entregado",
    cancelado:        "Cancelado"
  };

  const ABIERTOS = ["enviado", "recibido", "pedido_proveedor", "entrega_parcial"];

  const ACCIONES = {
    creado:           "Pedido creado",
    enviado:          "Pedido enviado",
    recibido:         "Recibido por administración",
    pedido_proveedor: "Pedido al proveedor",
    recepcion:        "Recepción registrada",
    cancelado:        "Pedido cancelado",
    reclamo:          "Reclamo enviado"
  };

  const INCIDENCIAS = [
    "Llegó dañado",
    "Llegó de más",
    "Cantidad/material equivocado",
    "Otro (ver nota)"
  ];

  const MAX_BASE64 = 700 * 1024; // ~700 KB por archivo (límite de doc: 1 MB)
  const AUTOSAVE_KEY = "po-autosave-pedido";

  /* ------------------------------------------------------ estado global --- */

  const estado = {
    usuario: null,           // { uid, nombre, email, rol, activo, whatsapp, avisos }
    usuarios: [],            // solo se suscribe el admin (Gestión)
    obras: [],
    rubros: [],
    proveedores: [],
    pedidos: [],
    notificaciones: [],
    recepcionesPedido: [],
    fotosPedido: [],
    vista: "dashboard",
    tabGestion: "obras",
    pedidoAbiertoId: null,
    filtros: { estado: "todos", obra: "todas", rubro: "todos", prioridad: "todas", desde: "", hasta: "", q: "" },
    dash: { obra: "todas", rubro: "todos" },
    edicionBorradorId: null, // si estamos editando un borrador existente
    duplicarDe: null,        // precarga para "Duplicar pedido"
    fotosRecepcion: [],      // [{base64, tipo}] del modal de recepción
    obraEditandoId: null,
    proveedorEditandoId: null,
    registroPendiente: null,
    subs: {}
  };

  /* -------------------------------------------------------------- toast --- */

  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("oculto");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("oculto"), 3200);
  }

  function mostrarError(id, msg) {
    const el = $(id);
    if (!el) return;
    if (!msg) { el.classList.add("oculto"); el.textContent = ""; return; }
    el.textContent = msg;
    el.classList.remove("oculto");
  }

  function errorAuthES(e) {
    const mapa = {
      "auth/invalid-email": "El email no es válido.",
      "auth/user-not-found": "No existe una cuenta con ese email.",
      "auth/wrong-password": "La contraseña no es correcta.",
      "auth/invalid-credential": "Email o contraseña incorrectos.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
      "auth/weak-password": "La contraseña es muy corta (mínimo 6 caracteres).",
      "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
      "auth/network-request-failed": "Sin conexión. Revisá internet y probá de nuevo."
    };
    return mapa[(e && e.code) || ""] || ("Error: " + ((e && e.message) || e));
  }

  /* --------------------------------------------------------- roles y visi- */

  const esAdmin = () => estado.usuario && estado.usuario.rol === "admin";
  const esControl = () => estado.usuario && estado.usuario.rol === "control";
  const esDirector = () => estado.usuario && estado.usuario.rol === "director";

  function rolEtiqueta(rol) {
    return { director: "Dirección de obra", admin: "Administración", control: "Control (solo lectura)" }[rol] || rol;
  }

  function obrasAsignadas() {
    const uid = estado.usuario.uid;
    return estado.obras.filter((o) => (o.directores || []).includes(uid));
  }

  function directorDeObra(p) {
    const o = estado.obras.find((x) => x.id === p.obraId);
    return !!(o && (o.directores || []).includes(estado.usuario.uid));
  }

  /** Qué pedidos ve cada rol. Los borradores solo los ve su creador. */
  function pedidosVisibles() {
    const u = estado.usuario;
    return estado.pedidos.filter((p) => {
      if (p.estado === "borrador" && p.solicitanteUid !== u.uid) return false;
      if (u.rol === "director") {
        return p.solicitanteUid === u.uid || directorDeObra(p);
      }
      return true; // admin y control ven todo (menos borradores ajenos)
    });
  }

  function esAtrasado(p) {
    return !!(p.proveedor && p.proveedor.fechaEstimada &&
      p.proveedor.fechaEstimada < hoyISO() &&
      ["pedido_proveedor", "entrega_parcial"].includes(p.estado));
  }

  function pctRecibido(p) {
    let total = 0, rec = 0;
    (p.items || []).forEach((it) => {
      total += Number(it.cantidad) || 0;
      rec += Math.min(Number(it.recibido) || 0, Number(it.cantidad) || 0);
    });
    return total ? Math.round((rec / total) * 100) : 0;
  }

  /* -------------------------------------------------- pantallas y rutas --- */

  function mostrarPantalla(cual) {
    $("pantalla-config").classList.toggle("oculto", cual !== "config");
    $("pantalla-auth").classList.toggle("oculto", cual !== "auth");
    $("pantalla-app").classList.toggle("oculto", cual !== "app");
  }

  function ir(vista) {
    if (estado.vista === "detalle" && vista !== "detalle") {
      if (estado.subs.recepciones) { estado.subs.recepciones(); estado.subs.recepciones = null; }
      if (estado.subs.fotos) { estado.subs.fotos(); estado.subs.fotos = null; }
    }
    if (estado.vista === "nuevo" && vista !== "nuevo") {
      estado.edicionBorradorId = null;
    }
    estado.vista = vista;
    ["dashboard", "listado", "nuevo", "detalle", "gestion", "perfil"].forEach((v) =>
      $("vista-" + v).classList.toggle("oculto", v !== vista)
    );

    // Nav inferior + botón flotante
    document.querySelectorAll("#navbar .nav-item").forEach((b) =>
      b.classList.toggle("activo", b.dataset.vista === vista)
    );
    const conFab = ["dashboard", "listado"].includes(vista) && !esControl();
    $("btn-nuevo-pedido").classList.toggle("oculto", !conFab);

    if (vista === "dashboard") renderDashboard();
    if (vista === "listado") renderListado();
    if (vista === "nuevo") prepararFormNuevo();
    if (vista === "detalle") renderDetalle();
    if (vista === "gestion") renderGestion();
    if (vista === "perfil") renderPerfil();
    window.scrollTo(0, 0);
  }

  /* ----------------------------------------------------------- arranque --- */

  document.addEventListener("DOMContentLoaded", () => {
    conectarEventos();
    if (!PO.fb.init()) { mostrarPantalla("config"); return; }
    PO.fb.auth.onAuthStateChanged(onAuth);
  });

  async function onAuth(user) {
    if (!user) { limpiarSesion(); mostrarPantalla("auth"); return; }
    try {
      let perfil = await PO.store.obtenerUsuario(user.uid);
      if (!perfil && estado.registroPendiente) {
        await PO.store.crearUsuario(user.uid, {
          nombre: estado.registroPendiente.nombre,
          email: user.email,
          rol: estado.registroPendiente.rol
        });
        perfil = await PO.store.obtenerUsuario(user.uid);
      }
      if (!perfil) {
        toast("No encontramos tu perfil. Cerrá sesión y creá la cuenta de nuevo.");
        await PO.fb.auth.signOut();
        return;
      }
      if (perfil.activo === false) {
        toast("Tu cuenta está desactivada. Hablá con administración.");
        await PO.fb.auth.signOut();
        return;
      }
      estado.registroPendiente = null;
      iniciarSesion(perfil);
    } catch (e) {
      console.error("[PO] Error cargando el perfil:", e);
      toast("Error cargando tu usuario. Revisá la conexión.");
    }
  }

  function iniciarSesion(perfil) {
    estado.usuario = perfil;
    estado.filtros = { estado: "todos", obra: "todas", rubro: "todos", prioridad: "todas", desde: "", hasta: "", q: "" };
    estado.dash = { obra: "todas", rubro: "todos" };

    $("nav-gestion").classList.toggle("oculto", !esAdmin());

    limpiarSubs();
    estado.subs.obras = PO.store.subObras((obras) => { estado.obras = obras; refrescarVista(); });
    estado.subs.rubros = PO.store.subRubros((r) => { estado.rubros = r; refrescarVista(); });
    estado.subs.proveedores = PO.store.subProveedores((p) => { estado.proveedores = p; });
    estado.subs.pedidos = PO.store.subPedidos((p) => { estado.pedidos = p; refrescarVista(); });
    estado.subs.notifs = PO.store.subNotificaciones(perfil.uid, (n) => {
      estado.notificaciones = n;
      renderBadgeCampana();
      if (!$("modal-notificaciones").classList.contains("oculto")) renderNotificaciones();
    });
    if (esAdmin()) {
      estado.subs.usuarios = PO.store.subUsuarios((u) => {
        estado.usuarios = u;
        if (estado.vista === "gestion") renderGestion();
      });
    }

    mostrarPantalla("app");
    ir("dashboard");
  }

  function refrescarVista() {
    if (estado.vista === "dashboard") renderDashboard();
    if (estado.vista === "listado") renderListado();
    if (estado.vista === "detalle") renderDetalle();
    if (estado.vista === "gestion") renderGestion();
  }

  function limpiarSubs() {
    Object.keys(estado.subs).forEach((k) => {
      if (estado.subs[k]) { estado.subs[k](); estado.subs[k] = null; }
    });
  }

  function limpiarSesion() {
    limpiarSubs();
    estado.usuario = null;
    estado.usuarios = [];
    estado.obras = [];
    estado.rubros = [];
    estado.proveedores = [];
    estado.pedidos = [];
    estado.notificaciones = [];
    estado.pedidoAbiertoId = null;
  }

  /* ------------------------------------------------------------- eventos -- */

  function conectarEventos() {
    // Auth
    $("ir-registro").addEventListener("click", (e) => {
      e.preventDefault();
      $("form-login").classList.add("oculto");
      $("form-registro").classList.remove("oculto");
    });
    $("ir-login").addEventListener("click", (e) => {
      e.preventDefault();
      $("form-registro").classList.add("oculto");
      $("form-login").classList.remove("oculto");
    });
    $("form-login").addEventListener("submit", onLogin);
    $("form-registro").addEventListener("submit", onRegistro);
    $("btn-salir").addEventListener("click", () => PO.fb.auth.signOut());

    // Navegación
    document.querySelectorAll("#navbar .nav-item").forEach((b) =>
      b.addEventListener("click", () => ir(b.dataset.vista))
    );
    $("btn-nuevo-pedido").addEventListener("click", () => {
      estado.edicionBorradorId = null;
      ir("nuevo");
    });

    // Dashboard
    $("dash-obra").addEventListener("change", (e) => { estado.dash.obra = e.target.value; renderDashboard(); });
    $("dash-rubro").addEventListener("change", (e) => { estado.dash.rubro = e.target.value; renderDashboard(); });

    // Listado: filtros
    $("filtro-obra").addEventListener("change", (e) => { estado.filtros.obra = e.target.value; renderListado(); });
    $("filtro-rubro").addEventListener("change", (e) => { estado.filtros.rubro = e.target.value; renderListado(); });
    $("filtro-prioridad").addEventListener("change", (e) => { estado.filtros.prioridad = e.target.value; renderListado(); });
    $("filtro-desde").addEventListener("change", (e) => { estado.filtros.desde = e.target.value; renderListado(); });
    $("filtro-hasta").addEventListener("change", (e) => { estado.filtros.hasta = e.target.value; renderListado(); });
    $("buscador").addEventListener("input", (e) => { estado.filtros.q = e.target.value.trim().toLowerCase(); renderListado(); });
    $("btn-exportar").addEventListener("click", () => {
      const lista = pedidosFiltrados();
      if (!lista.length) { toast("No hay pedidos para exportar con estos filtros."); return; }
      PO.exportarPedidos(lista, { fmtFecha, tsAFechaISO, pctRecibido, ESTADOS });
    });

    // Nuevo pedido
    $("nuevo-volver").addEventListener("click", () => ir(estado.edicionBorradorId ? "detalle" : "listado"));
    $("btn-agregar-item").addEventListener("click", () => { agregarFilaItem(); autoguardar(); });
    $("form-pedido").addEventListener("submit", (e) => { e.preventDefault(); guardarPedido("enviado"); });
    $("btn-guardar-borrador").addEventListener("click", () => guardarPedido("borrador"));
    $("form-pedido").addEventListener("input", autoguardar);
    $("pedido-obra").addEventListener("change", actualizarSugerenciasMateriales);
    $("pedido-rubro").addEventListener("change", actualizarSugerenciasMateriales);
    $("seg-prioridad").querySelectorAll(".seg-btn").forEach((b) =>
      b.addEventListener("click", () => {
        $("seg-prioridad").querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("activo"));
        b.classList.add("activo");
        autoguardar();
      })
    );

    // Detalle
    $("detalle-volver").addEventListener("click", () => ir("listado"));

    // Gestión: tabs
    $("tabs-gestion").querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => {
        estado.tabGestion = t.dataset.tab;
        $("tabs-gestion").querySelectorAll(".tab").forEach((x) =>
          x.classList.toggle("activo", x === t));
        renderGestion();
      })
    );

    // Perfil
    $("form-perfil").addEventListener("submit", onGuardarPerfil);

    // Campana
    $("btn-campana").addEventListener("click", () => {
      renderNotificaciones();
      abrirModal("modal-notificaciones");
    });
    $("notif-cerrar").addEventListener("click", () => cerrarModal("modal-notificaciones"));
    $("btn-todas-leidas").addEventListener("click", async () => {
      try {
        await PO.store.marcarTodasLeidas(estado.usuario.uid, estado.notificaciones);
      } catch (e) { toast("No se pudieron marcar: " + (e.message || e)); }
    });

    // Modal proveedor
    $("proveedor-cancelar").addEventListener("click", () => cerrarModal("modal-proveedor"));
    $("proveedor-confirmar").addEventListener("click", onConfirmarProveedor);
    $("seg-entrega").querySelectorAll(".seg-btn").forEach((b) =>
      b.addEventListener("click", () => {
        $("seg-entrega").querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("activo"));
        b.classList.add("activo");
        $("prov-retira-wrap").classList.toggle("oculto", b.dataset.valor !== "retira");
      })
    );
    $("prov-nombre").addEventListener("input", () => {
      const v = $("prov-nombre").value.trim().toLowerCase();
      const existe = estado.proveedores.some((p) => (p.nombre || "").toLowerCase() === v);
      $("prov-guardar-wrap").classList.toggle("oculto", !v || existe);
    });

    // Modal recepción
    $("recepcion-cancelar").addEventListener("click", () => cerrarModal("modal-recepcion"));
    $("recepcion-confirmar").addEventListener("click", onConfirmarRecepcion);
    $("btn-recepcion-foto").addEventListener("click", () => $("input-foto-recepcion").click());
    $("input-foto-recepcion").addEventListener("change", onFotosRecepcion);

    // Modal cancelar
    $("cancelar-cerrar").addEventListener("click", () => cerrarModal("modal-cancelar"));
    $("cancelar-confirmar").addEventListener("click", onConfirmarCancelacion);

    // Modal foto
    $("modal-foto").addEventListener("click", () => cerrarModal("modal-foto"));

    // Datalist de unidades
    $("lista-unidades").innerHTML = (window.APP_CONFIG.UNIDADES || [])
      .map((u) => '<option value="' + esc(u) + '"></option>').join("");
  }

  function abrirModal(id) { $(id).classList.remove("oculto"); }
  function cerrarModal(id) { $(id).classList.add("oculto"); }

  /* ---------------------------------------------------------------- auth -- */

  async function onLogin(e) {
    e.preventDefault();
    mostrarError("login-error", "");
    const email = $("login-email").value.trim();
    const pass = $("login-pass").value;
    if (!email || !pass) { mostrarError("login-error", "Completá email y contraseña."); return; }
    $("btn-login").disabled = true;
    try {
      await PO.fb.auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      mostrarError("login-error", errorAuthES(err));
    } finally {
      $("btn-login").disabled = false;
    }
  }

  async function onRegistro(e) {
    e.preventDefault();
    mostrarError("registro-error", "");
    const nombre = $("reg-nombre").value.trim();
    const email = $("reg-email").value.trim();
    const pass = $("reg-pass").value;
    const codigo = $("reg-codigo").value.trim().toUpperCase();

    if (!nombre) { mostrarError("registro-error", "Poné tu nombre y apellido."); return; }
    if (!email) { mostrarError("registro-error", "Poné tu email."); return; }
    if (pass.length < 6) { mostrarError("registro-error", "La contraseña necesita al menos 6 caracteres."); return; }

    const rol = (window.APP_CONFIG.CODIGOS_INVITACION || {})[codigo];
    if (!rol) { mostrarError("registro-error", "El código de invitación no es válido. Pedíselo a administración."); return; }

    $("btn-registro").disabled = true;
    estado.registroPendiente = { nombre, rol };
    try {
      await PO.fb.auth.createUserWithEmailAndPassword(email, pass);
      // onAuth crea el doc de usuario y entra.
    } catch (err) {
      estado.registroPendiente = null;
      mostrarError("registro-error", errorAuthES(err));
    } finally {
      $("btn-registro").disabled = false;
    }
  }

  /* ------------------------------------------------------------ dashboard - */

  function opcionesObras(sel, valor, etiquetaTodas) {
    sel.innerHTML = '<option value="todas">' + etiquetaTodas + "</option>" +
      estado.obras.map((o) =>
        '<option value="' + esc(o.id) + '">' + esc(o.nombre) +
        (o.estado && o.estado !== "activa" ? " (" + o.estado + ")" : "") + "</option>"
      ).join("");
    sel.value = valor;
    if (sel.value !== valor) sel.value = "todas";
  }

  function opcionesRubros(sel, valor, etiquetaTodos) {
    sel.innerHTML = '<option value="todos">' + etiquetaTodos + "</option>" +
      estado.rubros.map((r) =>
        '<option value="' + esc(r.nombre) + '">' + esc(r.nombre) + "</option>"
      ).join("");
    sel.value = valor;
    if (sel.value !== valor) sel.value = "todos";
  }

  function renderDashboard() {
    opcionesObras($("dash-obra"), estado.dash.obra, "Todas las obras");
    opcionesRubros($("dash-rubro"), estado.dash.rubro, "Todos los rubros");

    let base = pedidosVisibles();
    if (estado.dash.obra !== "todas") base = base.filter((p) => p.obraId === estado.dash.obra);
    if (estado.dash.rubro !== "todos") base = base.filter((p) => p.rubro === estado.dash.rubro);

    const cont = $("dash-contenido");
    let html = "";

    // Base vacía: seed para el admin
    if (!estado.obras.length && !estado.pedidos.length) {
      if (esAdmin()) {
        html += '<div class="dash-vacio">La base está vacía.<br/><br/>' +
          '<button type="button" class="btn btn-primario" id="btn-seed">Cargar datos de ejemplo</button>' +
          '<p class="nota-suave" style="margin-top:10px">3 obras, 6 rubros, 2 proveedores y 10 pedidos de muestra.<br/>' +
          'O empezá en serio desde la pestaña Gestión.</p></div>';
      } else {
        html += '<div class="dash-vacio">Todavía no hay obras ni pedidos cargados.<br/>' +
          "Administración tiene que cargar las obras primero.</div>";
      }
    }

    // Alertas: atrasados y urgentes
    const atrasados = base.filter(esAtrasado);
    const urgentes = base.filter((p) =>
      p.prioridad === "urgente" && ABIERTOS.includes(p.estado) && !esAtrasado(p));

    if (atrasados.length) {
      html += '<div class="alerta-seccion"><div class="alerta-titulo atrasados">Atrasados (' +
        atrasados.length + ")</div>" +
        atrasados.slice(0, 5).map((p) => alertaCard(p, true)).join("") +
        "</div>";
    }
    if (urgentes.length) {
      html += '<div class="alerta-seccion"><div class="alerta-titulo urgentes">Urgentes (' +
        urgentes.length + ")</div>" +
        urgentes.slice(0, 5).map((p) => alertaCard(p, false)).join("") +
        "</div>";
    }

    // Tarjetas resumen por estado
    html += '<div class="dash-grid">' +
      Object.keys(ESTADOS).map((k) => {
        const n = base.filter((p) => p.estado === k).length;
        return '<button type="button" class="dash-card" data-estado="' + k + '">' +
          '<span class="badge badge-' + k + '">' + ESTADOS[k] + "</span>" +
          '<div class="d-num">' + n + "</div>" +
          '<div class="d-etiqueta">' + (k === "borrador" ? "míos, sin enviar" : "pedidos") + "</div>" +
        "</button>";
      }).join("") +
      "</div>";

    cont.innerHTML = html;

    const bSeed = $("btn-seed");
    if (bSeed) bSeed.addEventListener("click", async () => {
      bSeed.disabled = true;
      bSeed.textContent = "Cargando…";
      try {
        await PO.seed.cargarDatosEjemplo(estado.usuario);
        toast("Datos de ejemplo cargados.");
      } catch (e) {
        console.error(e);
        toast("No se pudieron cargar: " + (e.message || e));
        bSeed.disabled = false;
        bSeed.textContent = "Cargar datos de ejemplo";
      }
    });

    cont.querySelectorAll(".dash-card").forEach((c) =>
      c.addEventListener("click", () => {
        estado.filtros.estado = c.dataset.estado;
        estado.filtros.obra = estado.dash.obra;
        estado.filtros.rubro = estado.dash.rubro;
        ir("listado");
      })
    );
    cont.querySelectorAll(".alerta-card").forEach((c) =>
      c.addEventListener("click", () => abrirDetalle(c.dataset.id))
    );
  }

  function alertaCard(p, atrasado) {
    const fecha = atrasado
      ? "llegaba el " + fmtFecha(p.proveedor.fechaEstimada)
      : "se necesita el " + fmtFecha(p.fechaNecesaria);
    return '<div class="alerta-card' + (atrasado ? " atrasado" : "") + '" data-id="' + esc(p.id) + '">' +
      '<div class="a-linea1"><span>' + esc(p.numero || "Borrador") + " · " + esc(p.obraNombre) + "</span>" +
      '<span class="a-marca">' + (atrasado ? "ATRASADO" : "URGENTE") + "</span></div>" +
      '<div class="a-linea2">' + esc(p.rubro) + " · " + fecha + " · " +
      (ESTADOS[p.estado] || p.estado) + "</div></div>";
  }

  /* -------------------------------------------------------------- listado - */

  function pedidosFiltradosBase() {
    let lista = pedidosVisibles();
    const f = estado.filtros;
    if (f.obra !== "todas") lista = lista.filter((p) => p.obraId === f.obra);
    if (f.rubro !== "todos") lista = lista.filter((p) => p.rubro === f.rubro);
    if (f.prioridad !== "todas") lista = lista.filter((p) => (p.prioridad || "normal") === f.prioridad);
    if (f.desde) lista = lista.filter((p) => tsAFechaISO(p.creado) >= f.desde);
    if (f.hasta) lista = lista.filter((p) => tsAFechaISO(p.creado) <= f.hasta);
    if (f.q) {
      lista = lista.filter((p) => {
        const blob = [
          p.numero, p.obraNombre, p.rubro, p.solicitanteNombre,
          p.proveedor && p.proveedor.nombre,
          (p.items || []).map((i) => i.descripcion).join(" ")
        ].join(" ").toLowerCase();
        return blob.includes(f.q);
      });
    }
    return lista;
  }

  function pedidosFiltrados() {
    let lista = pedidosFiltradosBase();
    if (estado.filtros.estado !== "todos") {
      lista = lista.filter((p) => p.estado === estado.filtros.estado);
    }
    return lista;
  }

  function renderChips() {
    const base = pedidosFiltradosBase();
    const conteo = {};
    base.forEach((p) => { conteo[p.estado] = (conteo[p.estado] || 0) + 1; });

    const chips = [["todos", "Todos", base.length]]
      .concat(Object.keys(ESTADOS).map((k) => [k, ESTADOS[k], conteo[k] || 0]));

    $("chips-estado").innerHTML = chips.map(([clave, etiqueta, num]) =>
      '<button type="button" class="chip' + (estado.filtros.estado === clave ? " activo" : "") +
      '" data-estado="' + clave + '">' + etiqueta +
      ' <span class="chip-num">' + num + "</span></button>"
    ).join("");

    $("chips-estado").querySelectorAll(".chip").forEach((ch) =>
      ch.addEventListener("click", () => {
        estado.filtros.estado = ch.dataset.estado;
        renderListado();
      })
    );
  }

  function resumenItems(items) {
    const arr = (items || []).map((it) => fmtCant(it.cantidad) + " " + esc(it.unidad) + " — " + esc(it.descripcion));
    if (arr.length <= 2) return arr.join(" · ");
    return arr.slice(0, 2).join(" · ") + " · +" + (arr.length - 2) + " más";
  }

  function renderListado() {
    renderChips();
    opcionesObras($("filtro-obra"), estado.filtros.obra, "Todas las obras");
    opcionesRubros($("filtro-rubro"), estado.filtros.rubro, "Todos los rubros");
    $("filtro-prioridad").value = estado.filtros.prioridad;
    $("filtro-desde").value = estado.filtros.desde;
    $("filtro-hasta").value = estado.filtros.hasta;

    const lista = pedidosFiltrados();
    const ul = $("lista-pedidos");

    if (!lista.length) {
      ul.innerHTML = '<li class="lista-vacia">' +
        (estado.pedidos.length ? "No hay pedidos con estos filtros." :
          "Todavía no hay pedidos. Tocá “+ Nuevo pedido” para crear el primero.") +
        "</li>";
      return;
    }

    const hoy = hoyISO();
    ul.innerHTML = lista.map((p) => {
      const vencido = p.fechaNecesaria && p.fechaNecesaria < hoy && ABIERTOS.includes(p.estado);
      const urgente = p.prioridad === "urgente";
      return '<li class="pedido-card' + (urgente ? " urgente" : "") + '" data-id="' + esc(p.id) + '">' +
        '<div class="pedido-card-cab"><div class="cab-izq">' +
          '<span class="pedido-numero">' + esc(p.numero || "Borrador") + "</span>" +
          (urgente ? '<span class="tag-urgente">URGENTE</span>' : "") +
          (esAtrasado(p) ? '<span class="tag-atrasado">ATRASADO</span>' : "") +
        "</div>" +
          '<span class="badge badge-' + esc(p.estado) + '">' + (ESTADOS[p.estado] || esc(p.estado)) + "</span>" +
        "</div>" +
        '<div class="pedido-obra">' + esc(p.obraNombre) + "</div>" +
        '<div class="pedido-rubro">' + esc(p.rubro) + "</div>" +
        '<div class="pedido-meta">' + haceCuanto(p.creado) + " · " + esc(p.solicitanteNombre) +
          (p.fechaNecesaria
            ? ' · <span class="' + (vencido ? "vencido" : "") + '">necesita: ' + fmtFecha(p.fechaNecesaria) + "</span>"
            : "") +
        "</div>" +
        '<div class="pedido-items">' + resumenItems(p.items) + "</div>" +
      "</li>";
    }).join("");

    ul.querySelectorAll(".pedido-card").forEach((card) =>
      card.addEventListener("click", () => abrirDetalle(card.dataset.id))
    );
  }

  /* -------------------------------------------------------- nuevo pedido -- */

  function prepararFormNuevo() {
    const editando = estado.edicionBorradorId
      ? estado.pedidos.find((p) => p.id === estado.edicionBorradorId) : null;

    $("nuevo-titulo").textContent = editando ? "Editar borrador" : "Nuevo pedido";

    // Obras: el director solo ve sus obras asignadas activas; admin, todas las activas.
    const activas = estado.obras.filter((o) => o.estado === "activa");
    const disponibles = esAdmin() ? activas
      : activas.filter((o) => (o.directores || []).includes(estado.usuario.uid));
    $("pedido-obra").innerHTML = '<option value="">Elegí la obra…</option>' +
      disponibles.map((o) =>
        '<option value="' + esc(o.id) + '">' + esc(o.nombre) + "</option>"
      ).join("");
    // Un toque menos en el caso más común: si solo tiene una obra asignada, se precarga.
    if (disponibles.length === 1) $("pedido-obra").value = disponibles[0].id;

    $("pedido-rubro").innerHTML = '<option value="">Elegí el rubro…</option>' +
      estado.rubros.map((r) =>
        '<option value="' + esc(r.nombre) + '">' + esc(r.nombre) + "</option>"
      ).join("");

    // Se precarga hoy: para el pedido normal alcanza tal cual, y para uno con
    // fecha puntual el director solo toca una vez para cambiarla.
    $("pedido-fecha").value = hoyISO();
    $("pedido-fecha").min = hoyISO();
    $("pedido-obs").value = "";
    setPrioridad("normal");
    $("items-editor").innerHTML = "";
    mostrarError("pedido-error", "");

    if (!disponibles.length) {
      mostrarError("pedido-error", esDirector()
        ? "No tenés obras activas asignadas. Pedile a administración que te asigne una desde Gestión → Obras."
        : "No hay obras activas. Cargalas desde Gestión → Obras.");
    } else if (!estado.rubros.length) {
      mostrarError("pedido-error", esAdmin()
        ? "No hay rubros cargados. Cargalos desde Gestión → Rubros."
        : "No hay rubros cargados. Pedile a administración que los cargue.");
    }

    if (editando) {
      $("pedido-obra").value = editando.obraId;
      $("pedido-rubro").value = editando.rubro;
      $("pedido-fecha").value = editando.fechaNecesaria || "";
      $("pedido-obs").value = editando.observaciones || "";
      setPrioridad(editando.prioridad || "normal");
      (editando.items || []).forEach((it) => agregarFilaItem(it));
      $("pedido-autosave").classList.add("oculto");
    } else if (estado.duplicarDe) {
      const d = estado.duplicarDe;
      estado.duplicarDe = null;
      $("pedido-obra").value = d.obraId || "";
      $("pedido-rubro").value = d.rubro || "";
      (d.items || []).forEach((it) => agregarFilaItem(it));
      $("pedido-autosave").classList.remove("oculto");
      toast("Pedido duplicado: revisá cantidades y fecha, y envialo.");
    } else {
      const guardado = restaurarAutosave();
      if (!guardado) agregarFilaItem();
      $("pedido-autosave").classList.remove("oculto");
    }
    if (!$("items-editor").children.length) agregarFilaItem();

    actualizarSugerenciasMateriales();
  }

  function setPrioridad(valor) {
    $("seg-prioridad").querySelectorAll(".seg-btn").forEach((b) =>
      b.classList.toggle("activo", b.dataset.valor === valor));
  }

  function prioridadElegida() {
    const b = $("seg-prioridad").querySelector(".seg-btn.activo");
    return (b && b.dataset.valor) || "normal";
  }

  /** Sugerencias de materiales ya pedidos en la misma obra o rubro
      (autocompletado del datalist; recorta el tipeo en obra). */
  function actualizarSugerenciasMateriales() {
    let dl = $("lista-materiales");
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = "lista-materiales";
      document.body.appendChild(dl);
    }
    const obraSel = $("pedido-obra").value;
    const rubroSel = $("pedido-rubro").value;
    let fuente = pedidosVisibles();
    if (obraSel || rubroSel) {
      fuente = fuente.filter((p) =>
        (rubroSel && p.rubro === rubroSel) || (obraSel && p.obraId === obraSel));
    }
    const set = new Map();
    fuente.forEach((p) => (p.items || []).forEach((it) => {
      const d = (it.descripcion || "").trim();
      if (d) set.set(d.toLowerCase(), d);
    }));
    dl.innerHTML = Array.from(set.values()).sort().slice(0, 80)
      .map((d) => '<option value="' + esc(d) + '"></option>').join("");
  }

  function agregarFilaItem(it) {
    const div = document.createElement("div");
    div.className = "item-fila";
    div.innerHTML =
      '<input class="input it-desc" type="text" list="lista-materiales" ' +
        'placeholder="Material (ej: Cemento CPC40 x 50 kg)" value="' + esc(it ? it.descripcion : "") + '" />' +
      '<div class="item-fila-abajo">' +
        '<input class="input it-cant" type="text" inputmode="decimal" placeholder="Cantidad" value="' +
          (it && it.cantidad ? esc(fmtCant(it.cantidad)) : "") + '" />' +
        '<input class="input it-unidad" type="text" list="lista-unidades" placeholder="Unidad" value="' +
          esc(it ? it.unidad : "un.") + '" />' +
        '<button type="button" class="item-quitar">Quitar</button>' +
      "</div>";
    div.querySelector(".item-quitar").addEventListener("click", () => {
      if ($("items-editor").children.length > 1) { div.remove(); autoguardar(); }
      else toast("El pedido necesita al menos un material.");
    });
    $("items-editor").appendChild(div);
  }

  function leerItems() {
    const filas = Array.from($("items-editor").children);
    const items = [];
    for (const f of filas) {
      const descripcion = f.querySelector(".it-desc").value.trim();
      const cantidad = parseCant(f.querySelector(".it-cant").value);
      const unidad = f.querySelector(".it-unidad").value.trim() || "un.";
      if (!descripcion && !cantidad) continue;
      if (!descripcion) return { error: "Hay un material sin descripción." };
      if (cantidad <= 0) return { error: "La cantidad de “" + descripcion + "” tiene que ser mayor a 0." };
      items.push({ descripcion, cantidad, unidad, recibido: 0 });
    }
    if (!items.length) return { error: "Cargá al menos un material." };
    return { items };
  }

  /* --- Autoguardado en localStorage (resiliencia en obra) --- */

  let autosaveTimer = null;
  function autoguardar() {
    if (estado.vista !== "nuevo" || estado.edicionBorradorId) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        const datos = {
          obraId: $("pedido-obra").value,
          rubro: $("pedido-rubro").value,
          prioridad: prioridadElegida(),
          fechaNecesaria: $("pedido-fecha").value,
          observaciones: $("pedido-obs").value,
          items: Array.from($("items-editor").children).map((f) => ({
            descripcion: f.querySelector(".it-desc").value,
            cantidad: f.querySelector(".it-cant").value,
            unidad: f.querySelector(".it-unidad").value
          }))
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(datos));
      } catch (e) { /* sin espacio: no es crítico */ }
    }, 400);
  }

  function restaurarAutosave() {
    let datos = null;
    try { datos = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null"); } catch (e) {}
    if (!datos) return false;
    const tieneAlgo = (datos.items || []).some((i) => (i.descripcion || "").trim()) ||
      datos.obraId || datos.observaciones;
    if (!tieneAlgo) return false;
    $("pedido-obra").value = datos.obraId || "";
    $("pedido-rubro").value = datos.rubro || "";
    $("pedido-fecha").value = datos.fechaNecesaria || "";
    $("pedido-obs").value = datos.observaciones || "";
    setPrioridad(datos.prioridad || "normal");
    (datos.items || []).forEach((i) => {
      if ((i.descripcion || "").trim() || (i.cantidad || "").trim()) {
        agregarFilaItem({ descripcion: i.descripcion, cantidad: parseCant(i.cantidad), unidad: i.unidad || "un." });
      }
    });
    if ($("items-editor").children.length) {
      toast("Se recuperó un pedido que había quedado sin enviar.");
      return true;
    }
    return false;
  }

  function limpiarAutosave() {
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
  }

  /* --- Guardar (borrador o enviado) --- */

  async function guardarPedido(modo) {
    mostrarError("pedido-error", "");
    const u = estado.usuario;

    const obraId = $("pedido-obra").value;
    const obra = estado.obras.find((o) => o.id === obraId);
    if (!obra) { mostrarError("pedido-error", "Elegí la obra."); return; }

    const rubro = $("pedido-rubro").value;
    if (!rubro) { mostrarError("pedido-error", "Elegí el rubro (un pedido por rubro)."); return; }

    const fechaNecesaria = $("pedido-fecha").value;
    if (modo === "enviado" && !fechaNecesaria) {
      mostrarError("pedido-error", "Indicá para cuándo se necesita."); return;
    }

    const res = leerItems();
    if (res.error) { mostrarError("pedido-error", res.error); return; }

    const ahora = PO.fb.tsAhora();
    const botones = [$("btn-enviar-pedido"), $("btn-guardar-borrador")];
    botones.forEach((b) => b.disabled = true);

    try {
      if (estado.edicionBorradorId) {
        // Editando un borrador existente
        const p = estado.pedidos.find((x) => x.id === estado.edicionBorradorId);
        const campos = {
          obraId, obraNombre: obra.nombre, rubro,
          prioridad: prioridadElegida(),
          fechaNecesaria: fechaNecesaria || null,
          observaciones: $("pedido-obs").value.trim(),
          items: res.items
        };
        if (modo === "borrador") {
          await PO.store.actualizarPedido(p.id, campos);
          toast("Borrador actualizado.");
          ir("detalle");
        } else {
          const historial = (p.historial || []).concat([{
            accion: "enviado", usuarioNombre: u.nombre, ts: ahora, nota: ""
          }]);
          const numero = await PO.store.enviarBorrador(p.id, { ...campos, historial });
          PO.store.notificarTransicion("enviado",
            { ...p, ...campos, id: p.id, numero, estado: "enviado" }, u);
          toast("Pedido " + numero + " enviado.");
          estado.edicionBorradorId = null;
          ir("listado");
        }
        return;
      }

      // Pedido nuevo
      const historial = [{ accion: "creado", usuarioNombre: u.nombre, ts: ahora, nota: "" }];
      if (modo === "enviado") {
        historial.push({ accion: "enviado", usuarioNombre: u.nombre, ts: ahora, nota: "" });
      }
      const datos = {
        obraId,
        obraNombre: obra.nombre,
        rubro,
        solicitanteUid: u.uid,
        solicitanteNombre: u.nombre,
        creado: PO.fb.tsServidor(),
        prioridad: prioridadElegida(),
        fechaNecesaria: fechaNecesaria || null,
        estado: modo,
        observaciones: $("pedido-obs").value.trim(),
        items: res.items,
        proveedor: null,
        historial
      };
      const creado = await PO.store.crearPedido(datos);
      limpiarAutosave();
      if (modo === "enviado") {
        PO.store.notificarTransicion("enviado", { ...datos, id: creado.id, numero: creado.numero }, u);
        toast("Pedido " + creado.numero + " enviado.");
      } else {
        toast("Borrador guardado. Lo podés enviar desde el detalle.");
      }
      ir("listado");
    } catch (err) {
      console.error(err);
      mostrarError("pedido-error", "No se pudo guardar: " + (err.message || err));
    } finally {
      botones.forEach((b) => b.disabled = false);
    }
  }

  /* ------------------------------------------------------------- archivos - */

  function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1000;
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > MAX || h > MAX) {
            const f = MAX / Math.max(w, h);
            w = Math.round(w * f);
            h = Math.round(h * f);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          let data = canvas.toDataURL("image/jpeg", 0.7);
          if (data.length > MAX_BASE64) data = canvas.toDataURL("image/jpeg", 0.5);
          if (data.length > MAX_BASE64) data = canvas.toDataURL("image/jpeg", 0.35);
          URL.revokeObjectURL(url);
          if (data.length > MAX_BASE64) {
            reject(new Error("La foto es demasiado pesada incluso comprimida. Probá con otra."));
          } else {
            resolve({ base64: data, tipo: "imagen" });
          }
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(new Error("No se pudo procesar la imagen."));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen."));
      };
      img.src = url;
    });
  }

  function leerPdf(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        if (fr.result.length > MAX_BASE64) {
          reject(new Error("El PDF es demasiado pesado (" +
            Math.round(fr.result.length / 1024) + " KB). Sacale una foto al remito en su lugar."));
        } else {
          resolve({ base64: fr.result, tipo: "pdf" });
        }
      };
      fr.onerror = () => reject(new Error("No se pudo leer el PDF."));
      fr.readAsDataURL(file);
    });
  }

  function procesarArchivo(file) {
    if (file.type === "application/pdf") return leerPdf(file);
    return comprimirImagen(file);
  }

  function abrirArchivo(f, pie) {
    if (f.tipo === "pdf") {
      // data: no siempre abre en pestaña nueva; lo convertimos a blob
      fetch(f.base64).then((r) => r.blob()).then((b) => {
        window.open(URL.createObjectURL(b), "_blank");
      }).catch(() => toast("No se pudo abrir el PDF."));
      return;
    }
    $("modal-foto-img").src = f.base64;
    $("modal-foto-pie").textContent = pie;
    abrirModal("modal-foto");
  }

  /* ------------------------------------------------------------- detalle -- */

  function pedidoAbierto() {
    return estado.pedidos.find((p) => p.id === estado.pedidoAbiertoId) || null;
  }

  function abrirDetalle(id) {
    estado.pedidoAbiertoId = id;
    estado.recepcionesPedido = [];
    estado.fotosPedido = [];
    if (estado.subs.recepciones) estado.subs.recepciones();
    if (estado.subs.fotos) estado.subs.fotos();
    estado.subs.recepciones = PO.store.subRecepciones(id, (r) => {
      estado.recepcionesPedido = r;
      if (estado.vista === "detalle") renderDetalle();
    });
    estado.subs.fotos = PO.store.subFotos(id, (f) => {
      estado.fotosPedido = f;
      if (estado.vista === "detalle") renderDetalle();
    });
    ir("detalle");
  }

  function dato(etiqueta, valor) {
    return '<div class="dato-fila"><span class="dato-etiqueta">' + etiqueta +
      '</span><span class="dato-valor">' + valor + "</span></div>";
  }

  function renderDetalle() {
    const p = pedidoAbierto();
    const cont = $("detalle-contenido");
    $("detalle-titulo").textContent = "Pedido";
    if (!p) {
      cont.innerHTML = '<p class="nota-suave">Cargando pedido…</p>';
      return;
    }

    const u = estado.usuario;
    const soyAdmin = esAdmin();
    const soySolicitante = p.solicitanteUid === u.uid;
    const soyDirectorObra = esDirector() && directorDeObra(p);
    const abierto = ABIERTOS.includes(p.estado);
    const urgente = p.prioridad === "urgente";
    const atrasado = esAtrasado(p);
    const hoy = hoyISO();
    const vencido = p.fechaNecesaria && p.fechaNecesaria < hoy && abierto;

    let html = "";

    /* Cabecera */
    html += '<div class="detalle-cab"><div class="cab-izq">' +
      '<span class="pedido-numero">' + esc(p.numero || "Borrador") + "</span>" +
      (urgente ? '<span class="tag-urgente">URGENTE</span>' : "") +
      (atrasado ? '<span class="tag-atrasado">ATRASADO</span>' : "") +
      "</div>" +
      '<span class="badge badge-' + esc(p.estado) + '">' + (ESTADOS[p.estado] || esc(p.estado)) + "</span>" +
      "</div>";

    /* Datos generales */
    const obra = estado.obras.find((o) => o.id === p.obraId);
    html += '<div class="bloque"><h4>Datos del pedido</h4>' +
      dato("Obra", esc(p.obraNombre) + (obra && obra.direccion ? " · " + esc(obra.direccion) : "")) +
      dato("Rubro", esc(p.rubro)) +
      dato("Prioridad", p.prioridad === "urgente" ? "<span style='color:var(--alerta)'>Urgente</span>" : "Normal") +
      dato("Solicitó", esc(p.solicitanteNombre)) +
      dato("Creado", fmtTs(p.creado) + " (" + haceCuanto(p.creado) + ")") +
      dato("Se necesita para", (vencido ? "<span style='color:var(--peligro)'>" : "<span>") +
        fmtFecha(p.fechaNecesaria) + "</span>") +
      (p.observaciones ? dato("Observaciones", esc(p.observaciones)) : "") +
      "</div>";

    /* Proveedor */
    if (p.proveedor) {
      html += '<div class="bloque"><h4>Proveedor</h4>' +
        dato("Proveedor", esc(p.proveedor.nombre)) +
        dato("Entrega estimada", (atrasado ? "<span style='color:var(--peligro)'>" : "<span>") +
          fmtFecha(p.proveedor.fechaEstimada) + "</span>") +
        (p.proveedor.oc ? dato("Orden de compra", esc(p.proveedor.oc)) : "") +
        dato("Entrega", p.proveedor.retira
          ? "<span style='color:var(--alerta)'>Retira " + esc(p.proveedor.retira) + "</span>"
          : "En obra") +
        (p.proveedor.observaciones ? dato("Observaciones", esc(p.proveedor.observaciones)) : "") +
        dato("Gestionó", esc(p.proveedor.usuarioNombre)) +
        "</div>";
    }

    /* Materiales */
    html += '<div class="bloque"><h4>Materiales (' + pctRecibido(p) + '% recibido)</h4>' +
      (p.items || []).map((it) => {
        const completo = Number(it.recibido || 0) >= Number(it.cantidad);
        return '<div class="item-linea"><span>' + esc(it.descripcion) + "</span>" +
          '<span class="item-recibido' + (completo ? " completo" : "") + '">' +
          fmtCant(it.recibido || 0) + " / " + fmtCant(it.cantidad) + " " + esc(it.unidad) +
          "</span></div>";
      }).join("") +
      "</div>";

    /* Recepciones (con fotos de remito) */
    if (estado.recepcionesPedido.length) {
      html += '<div class="bloque"><h4>Recepciones</h4>' +
        estado.recepcionesPedido.map((r) => {
          const fotos = estado.fotosPedido.filter((f) => f.recepcionId === r.id);
          return '<div class="recepcion-bloque">' +
            '<div class="rec-cab"><span>' + fmtTs(r.ts) + "</span>" +
            (r.incidencia ? '<span class="tag-atrasado">' + esc(r.incidencia) + "</span>" : "") +
            "</div>" +
            '<div class="rec-meta">Registró: ' + esc(r.usuarioNombre) + "</div>" +
            '<ul class="rec-items">' +
              (r.items || []).map((it) =>
                "<li>+" + fmtCant(it.cantidad) + " — " + esc(it.descripcion) + "</li>").join("") +
            "</ul>" +
            (r.nota ? '<div class="rec-nota">' + esc(r.nota) + "</div>" : "") +
            (fotos.length ? '<div class="fotos-grilla">' +
              fotos.map((f) =>
                f.tipo === "pdf"
                  ? '<button type="button" class="foto-mini es-pdf" data-foto="' + esc(f.id) + '">PDF</button>'
                  : '<button type="button" class="foto-mini" data-foto="' + esc(f.id) + '">' +
                    '<img src="' + f.base64 + '" alt="Remito" /></button>'
              ).join("") + "</div>" : "") +
            "</div>";
        }).join("") +
        "</div>";
    }

    /* Historial */
    html += '<div class="bloque"><h4>Historial</h4><ul class="timeline">' +
      (p.historial || []).slice().reverse().map((h) =>
        "<li><div class='t-accion'>" + (ACCIONES[h.accion] || esc(h.accion)) + "</div>" +
        "<div class='t-meta'>" + esc(h.usuarioNombre) + " · " + fmtTs(h.ts) + "</div>" +
        (h.nota ? "<div class='t-nota'>" + esc(h.nota) + "</div>" : "") +
        "</li>"
      ).join("") +
      "</ul></div>";

    /* Acciones según rol + estado */
    const botones = [];
    if (p.estado === "borrador" && soySolicitante) {
      botones.push('<button type="button" class="btn btn-primario" id="btn-enviar-borrador">Enviar pedido</button>');
      botones.push('<button type="button" class="btn btn-ghost" id="btn-editar-borrador">Editar borrador</button>');
      botones.push('<button type="button" class="btn btn-ghost" id="btn-borrar-borrador" style="color:var(--peligro)">Eliminar borrador</button>');
    }
    if (soyAdmin && p.estado === "enviado") {
      botones.push('<button type="button" class="btn btn-primario" id="btn-marcar-recibido">Marcar recibido</button>');
    }
    if (soyAdmin && p.estado === "recibido") {
      botones.push('<button type="button" class="btn btn-primario" id="btn-pedir-proveedor">Pedir al proveedor</button>');
    }
    if ((soyAdmin || soyDirectorObra) && ["pedido_proveedor", "entrega_parcial"].includes(p.estado)) {
      botones.push('<button type="button" class="btn btn-primario" id="btn-recepcion">Registrar recepción</button>');
      botones.push('<button type="button" class="btn btn-ghost" id="btn-reclamar" style="color:var(--alerta)">Reclamar</button>');
    }
    if (!esControl() && p.estado !== "borrador") {
      botones.push('<button type="button" class="btn btn-ghost" id="btn-duplicar">Duplicar pedido</button>');
    }
    if ((soyAdmin || soySolicitante) && abierto) {
      botones.push('<button type="button" class="btn btn-ghost" id="btn-cancelar-pedido" style="color:var(--peligro)">Cancelar pedido</button>');
    }
    if (botones.length) html += '<div class="detalle-acciones">' + botones.join("") + "</div>";

    cont.innerHTML = html;

    /* Conexión de botones */
    const on = (id, fn) => { const b = $(id); if (b) b.addEventListener("click", fn); };
    on("btn-enviar-borrador", enviarBorradorDesdeDetalle);
    on("btn-editar-borrador", () => { estado.edicionBorradorId = p.id; ir("nuevo"); });
    on("btn-borrar-borrador", async () => {
      if (!confirm("¿Eliminar este borrador? No se puede deshacer.")) return;
      try {
        await PO.store.borrarPedido(p.id);
        toast("Borrador eliminado.");
        ir("listado");
      } catch (e) { toast("No se pudo eliminar: " + (e.message || e)); }
    });
    on("btn-marcar-recibido", marcarRecibido);
    on("btn-pedir-proveedor", abrirModalProveedor);
    on("btn-recepcion", abrirModalRecepcion);
    on("btn-reclamar", async (e) => {
      e.target.disabled = true;
      try {
        await PO.store.reclamarPedido(p, u);
        toast("Reclamo enviado a " + (soyAdmin ? p.solicitanteNombre : "administración") + ".");
      } catch (err) {
        toast("No se pudo reclamar: " + (err.message || err));
        e.target.disabled = false;
      }
    });
    on("btn-duplicar", () => {
      estado.duplicarDe = {
        obraId: p.obraId,
        rubro: p.rubro,
        items: (p.items || []).map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, unidad: it.unidad }))
      };
      estado.edicionBorradorId = null;
      ir("nuevo");
    });
    on("btn-cancelar-pedido", () => {
      $("cancelar-nota").value = "";
      mostrarError("cancelar-error", "");
      abrirModal("modal-cancelar");
    });

    cont.querySelectorAll(".foto-mini[data-foto]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const f = estado.fotosPedido.find((x) => x.id === btn.dataset.foto);
        if (!f) return;
        abrirArchivo(f, "Remito · " + f.usuarioNombre + " · " + fmtTs(f.ts));
      })
    );
  }

  /* ------------------------------------------ acciones de transición ------ */

  async function enviarBorradorDesdeDetalle() {
    const p = pedidoAbierto();
    if (!p) return;
    if (!p.fechaNecesaria) {
      toast("Al borrador le falta la fecha necesaria: editalo antes de enviarlo.");
      return;
    }
    const u = estado.usuario;
    try {
      const historial = (p.historial || []).concat([{
        accion: "enviado", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota: ""
      }]);
      const numero = await PO.store.enviarBorrador(p.id, { historial });
      PO.store.notificarTransicion("enviado", { ...p, numero, estado: "enviado" }, u);
      toast("Pedido " + numero + " enviado.");
    } catch (e) {
      toast("No se pudo enviar: " + (e.message || e));
    }
  }

  async function marcarRecibido() {
    const p = pedidoAbierto();
    if (!p) return;
    const u = estado.usuario;
    try {
      await PO.store.actualizarPedido(p.id, {
        estado: "recibido",
        historial: (p.historial || []).concat([{
          accion: "recibido", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota: ""
        }])
      });
      PO.store.notificarTransicion("recibido", { ...p, estado: "recibido" }, u);
      toast("Pedido " + p.numero + " marcado como recibido.");
    } catch (e) {
      toast("No se pudo actualizar: " + (e.message || e));
    }
  }

  /* --- Pedir al proveedor --- */

  function abrirModalProveedor() {
    const p = pedidoAbierto();
    if (!p) return;
    $("proveedor-subtitulo").textContent = p.numero + " · " + p.obraNombre + " (" + p.rubro + ")";
    $("prov-nombre").value = "";
    $("prov-fecha").value = "";
    $("prov-oc").value = "";
    $("prov-obs").value = "";
    $("prov-retira").value = "";
    $("seg-entrega").querySelectorAll(".seg-btn").forEach((b) =>
      b.classList.toggle("activo", b.dataset.valor === "obra"));
    $("prov-retira-wrap").classList.add("oculto");
    $("prov-guardar-wrap").classList.add("oculto");
    $("prov-guardar").checked = true;
    // Datalist: primero los proveedores del rubro del pedido
    const delRubro = estado.proveedores.filter((x) => (x.rubros || []).includes(p.rubro));
    const resto = estado.proveedores.filter((x) => !(x.rubros || []).includes(p.rubro));
    $("lista-proveedores").innerHTML = delRubro.concat(resto)
      .map((x) => '<option value="' + esc(x.nombre) + '"></option>').join("");
    mostrarError("proveedor-error", "");
    abrirModal("modal-proveedor");
  }

  async function onConfirmarProveedor() {
    const p = pedidoAbierto();
    if (!p) return;
    const nombre = $("prov-nombre").value.trim();
    const fechaEstimada = $("prov-fecha").value;
    if (!nombre) { mostrarError("proveedor-error", "Indicá el proveedor."); return; }
    if (!fechaEstimada) { mostrarError("proveedor-error", "Indicá la fecha estimada de entrega (con eso se detectan los atrasos)."); return; }

    const oc = $("prov-oc").value.trim();
    const obs = $("prov-obs").value.trim();
    const entregaTipo = $("seg-entrega").querySelector(".seg-btn.activo").dataset.valor; // "obra" | "retira"
    const retira = entregaTipo === "retira" ? $("prov-retira").value.trim() : "";
    if (entregaTipo === "retira" && !retira) { mostrarError("proveedor-error", "Indicá quién retira."); return; }
    const u = estado.usuario;

    const existe = estado.proveedores.some((x) => (x.nombre || "").toLowerCase() === nombre.toLowerCase());
    const guardarNuevo = !existe && $("prov-guardar").checked;

    const nota = "Proveedor: " + nombre + " · Llega: " + fmtFecha(fechaEstimada) +
      (oc ? " · OC: " + oc : "") + (retira ? " · Retira: " + retira : "") + (obs ? " · " + obs : "");

    $("proveedor-confirmar").disabled = true;
    try {
      const proveedor = {
        nombre,
        fechaEstimada,
        oc: oc || null,
        retira: retira || null,
        observaciones: obs || null,
        usuarioNombre: u.nombre,
        ts: PO.fb.tsAhora()
      };
      await PO.store.actualizarPedido(p.id, {
        estado: "pedido_proveedor",
        proveedor,
        historial: (p.historial || []).concat([{
          accion: "pedido_proveedor", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      });
      if (guardarNuevo) {
        PO.store.guardarProveedor(null, {
          nombre, rubros: [p.rubro], telefono: "", observaciones: ""
        }).catch(() => {});
      }
      PO.store.notificarTransicion("pedido_proveedor", { ...p, estado: "pedido_proveedor", proveedor }, u);
      cerrarModal("modal-proveedor");
      toast("Pedido " + p.numero + " pedido a " + nombre + (retira ? " (retira " + retira + ")" : "") + ".");
    } catch (e) {
      mostrarError("proveedor-error", "No se pudo guardar: " + (e.message || e));
    } finally {
      $("proveedor-confirmar").disabled = false;
    }
  }

  /* --- Registrar recepción --- */

  function abrirModalRecepcion() {
    const p = pedidoAbierto();
    if (!p) return;
    estado.fotosRecepcion = [];
    renderFotosRecepcion();
    $("recepcion-nota").value = "";
    $("recepcion-items").innerHTML = (p.items || []).map((it, i) => {
      const recibido = Number(it.recibido || 0);
      const completo = recibido >= Number(it.cantidad);
      return '<div class="recepcion-item' + (completo ? " r-completo" : "") + '">' +
        '<div class="r-desc">' + esc(it.descripcion) + "</div>" +
        '<div class="r-estado">Recibido hasta ahora: ' + fmtCant(recibido) + " de " +
          fmtCant(it.cantidad) + " " + esc(it.unidad) + (completo ? " · completo" : "") + "</div>" +
        (completo ? "" :
          '<div class="r-fila"><span>Llegó ahora:</span>' +
          '<input class="input input-chico" type="text" inputmode="decimal" placeholder="0" data-i="' + i + '" />' +
          "<span>" + esc(it.unidad) + "</span></div>") +
        "</div>";
    }).join("") +
    // Incidencia predefinida (los capataces tildan, no escriben)
    '<label class="campo"><span>Incidencia (si hubo un problema)</span>' +
    '<select class="input" id="recepcion-incidencia">' +
      '<option value="">Sin incidencia</option>' +
      INCIDENCIAS.map((x) => '<option value="' + esc(x) + '">' + esc(x) + "</option>").join("") +
    "</select></label>";
    mostrarError("recepcion-error", "");
    abrirModal("modal-recepcion");
  }

  function renderFotosRecepcion() {
    $("recepcion-fotos-previa").innerHTML = estado.fotosRecepcion.map((f, i) =>
      '<div class="foto-mini' + (f.tipo === "pdf" ? " es-pdf" : "") + '">' +
      (f.tipo === "pdf" ? "PDF" : '<img src="' + f.base64 + '" alt="Remito" />') +
      '<button type="button" class="foto-quitar" data-i="' + i + '">×</button></div>'
    ).join("");
    $("recepcion-fotos-previa").querySelectorAll(".foto-quitar").forEach((b) =>
      b.addEventListener("click", () => {
        estado.fotosRecepcion.splice(Number(b.dataset.i), 1);
        renderFotosRecepcion();
      })
    );
  }

  async function onFotosRecepcion(e) {
    const archivos = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of archivos) {
      try {
        estado.fotosRecepcion.push(await procesarArchivo(f));
      } catch (err) {
        toast(err.message || "No se pudo procesar el archivo.");
      }
    }
    renderFotosRecepcion();
  }

  async function onConfirmarRecepcion() {
    const p = pedidoAbierto();
    if (!p) return;
    const u = estado.usuario;

    const inputs = Array.from($("recepcion-items").querySelectorAll("input[data-i]"));
    const items = (p.items || []).map((it) => ({ ...it }));
    const recibidosAhora = [];
    const lineasNota = [];

    for (const inp of inputs) {
      const val = parseCant(inp.value);
      if (val < 0) { mostrarError("recepcion-error", "Las cantidades no pueden ser negativas."); return; }
      if (!val) continue;
      const i = Number(inp.dataset.i);
      items[i].recibido = Math.round((Number(items[i].recibido || 0) + val) * 100) / 100;
      recibidosAhora.push({ idx: i, descripcion: items[i].descripcion, cantidad: val });
      lineasNota.push(items[i].descripcion + ": +" + fmtCant(val) + " " + items[i].unidad +
        " (va " + fmtCant(items[i].recibido) + " de " + fmtCant(items[i].cantidad) + ")");
    }

    if (!recibidosAhora.length) {
      mostrarError("recepcion-error", "Cargá al menos una cantidad recibida.");
      return;
    }

    const incidencia = $("recepcion-incidencia") ? $("recepcion-incidencia").value : "";
    const notaLibre = $("recepcion-nota").value.trim();
    if (incidencia === "Otro (ver nota)" && !notaLibre) {
      mostrarError("recepcion-error", "Elegiste “Otro”: contá en la nota qué pasó.");
      return;
    }

    const completo = items.every((it) => Number(it.recibido || 0) >= Number(it.cantidad));
    const nuevoEstado = completo ? "entregado" : "entrega_parcial";
    const nota = (completo ? "Recepción completa.\n" : "Recepción parcial.\n") +
      lineasNota.join("\n") +
      (incidencia ? "\nIncidencia: " + incidencia : "") +
      (notaLibre ? "\nNota: " + notaLibre : "");

    $("recepcion-confirmar").disabled = true;
    try {
      const recepcion = {
        items: recibidosAhora,
        usuarioNombre: u.nombre,
        ts: PO.fb.tsAhora(),
        nota: notaLibre,
        incidencia: incidencia || null
      };
      const cambios = {
        estado: nuevoEstado,
        items,
        historial: (p.historial || []).concat([{
          accion: "recepcion", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      };
      await PO.store.agregarRecepcion(p.id, recepcion, estado.fotosRecepcion, cambios);
      PO.store.notificarTransicion(nuevoEstado, { ...p, estado: nuevoEstado, items }, u);
      cerrarModal("modal-recepcion");
      toast(completo ? "Pedido " + p.numero + " entregado completo." : "Recepción parcial registrada.");
    } catch (e) {
      mostrarError("recepcion-error", "No se pudo guardar: " + (e.message || e));
    } finally {
      $("recepcion-confirmar").disabled = false;
    }
  }

  /* --- Cancelar --- */

  async function onConfirmarCancelacion() {
    const p = pedidoAbierto();
    if (!p) return;
    const nota = $("cancelar-nota").value.trim();
    if (!nota) { mostrarError("cancelar-error", "El motivo es obligatorio."); return; }
    const u = estado.usuario;

    $("cancelar-confirmar").disabled = true;
    try {
      await PO.store.actualizarPedido(p.id, {
        estado: "cancelado",
        historial: (p.historial || []).concat([{
          accion: "cancelado", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      });
      PO.store.notificarTransicion("cancelado", { ...p, estado: "cancelado" }, u);
      cerrarModal("modal-cancelar");
      toast("Pedido " + p.numero + " cancelado.");
    } catch (e) {
      mostrarError("cancelar-error", "No se pudo cancelar: " + (e.message || e));
    } finally {
      $("cancelar-confirmar").disabled = false;
    }
  }

  /* ------------------------------------------------------- notificaciones - */

  function renderBadgeCampana() {
    const n = estado.notificaciones.filter((x) => !x.leida).length;
    $("campana-badge").textContent = n > 99 ? "99+" : String(n);
    $("campana-badge").classList.toggle("oculto", !n);
  }

  function renderNotificaciones() {
    const ul = $("lista-notif");
    if (!estado.notificaciones.length) {
      ul.innerHTML = '<li class="lista-vacia" style="padding:20px">Sin notificaciones por ahora.</li>';
      return;
    }
    ul.innerHTML = estado.notificaciones.map((n) =>
      '<li class="notif-item' + (n.leida ? "" : " no-leida") + '" data-id="' + esc(n.id) + '">' +
      '<div class="n-texto">' + esc(n.texto) + "</div>" +
      '<div class="n-hace">' + haceCuanto(n.ts) + "</div></li>"
    ).join("");
    ul.querySelectorAll(".notif-item").forEach((li) =>
      li.addEventListener("click", async () => {
        const n = estado.notificaciones.find((x) => x.id === li.dataset.id);
        if (!n) return;
        if (!n.leida) PO.store.marcarLeida(estado.usuario.uid, n.id).catch(() => {});
        cerrarModal("modal-notificaciones");
        if (n.pedidoId && estado.pedidos.some((p) => p.id === n.pedidoId)) {
          abrirDetalle(n.pedidoId);
        } else if (n.pedidoId) {
          toast("Ese pedido ya no está entre los recientes.");
        }
      })
    );
  }

  /* --------------------------------------------------------------- gestión - */

  function renderGestion() {
    if (!esAdmin()) {
      $("gestion-contenido").innerHTML = '<p class="nota-suave">Solo administración puede entrar acá.</p>';
      return;
    }
    const tab = estado.tabGestion;
    if (tab === "obras") renderTabObras();
    if (tab === "rubros") renderTabRubros();
    if (tab === "proveedores") renderTabProveedores();
    if (tab === "usuarios") renderTabUsuarios();
  }

  /* --- Obras --- */

  function renderTabObras() {
    const cont = $("gestion-contenido");
    const directores = estado.usuarios.filter((x) => x.rol === "director" && x.activo !== false);
    const editando = estado.obraEditandoId
      ? estado.obras.find((o) => o.id === estado.obraEditandoId) : null;

    cont.innerHTML =
      '<div class="gestion-form"><h4>' + (editando ? "Editar obra" : "Nueva obra") + "</h4>" +
      '<label class="campo"><span>Nombre (ej: MOL-1047 · Casa Molina)</span>' +
      '<input class="input" id="obra-nombre" value="' + esc(editando ? editando.nombre : "") + '" /></label>' +
      '<label class="campo"><span>Dirección</span>' +
      '<input class="input" id="obra-direccion" value="' + esc(editando ? editando.direccion : "") + '" /></label>' +
      '<label class="campo"><span>Cliente</span>' +
      '<input class="input" id="obra-cliente" value="' + esc(editando ? editando.cliente : "") + '" /></label>' +
      '<label class="campo"><span>Estado</span>' +
      '<select class="input" id="obra-estado">' +
        ["activa", "pausada", "finalizada"].map((s) =>
          '<option value="' + s + '"' + (editando && editando.estado === s ? " selected" : "") + ">" +
          s.charAt(0).toUpperCase() + s.slice(1) + "</option>").join("") +
      "</select></label>" +
      '<div class="campo"><span class="campo-titulo">Directores asignados</span>' +
      (directores.length
        ? directores.map((d) =>
            '<label class="check-fila"><input type="checkbox" class="obra-director" value="' + esc(d.uid) + '"' +
            (editando && (editando.directores || []).includes(d.uid) ? " checked" : "") + " />" +
            "<span>" + esc(d.nombre) + "</span></label>").join("")
        : '<p class="nota-suave">Todavía no hay usuarios con rol director. Se registran con el código de invitación de director.</p>') +
      "</div>" +
      '<p class="form-error oculto" id="obra-error"></p>' +
      '<div class="acciones-doble">' +
        (editando ? '<button type="button" class="btn btn-ghost" id="obra-cancelar-edicion">Cancelar</button>' : "") +
        '<button type="button" class="btn btn-primario" id="btn-guardar-obra">' +
          (editando ? "Actualizar obra" : "Agregar obra") + "</button>" +
      "</div>" +
      '<p class="nota-suave" style="margin-top:8px">Una obra finalizada no aparece para pedidos nuevos, pero conserva todo su historial.</p>' +
      "</div>" +
      '<ul class="lista-gestion">' +
      (estado.obras.length ? estado.obras.map((o) => {
        const nombres = (o.directores || [])
          .map((uid) => { const u = estado.usuarios.find((x) => x.uid === uid); return u ? u.nombre : null; })
          .filter(Boolean).join(", ");
        return '<li class="gestion-item' + (o.estado !== "activa" ? " apagado" : "") + '">' +
          "<div><div class='g-titulo'>" + esc(o.nombre) + "</div>" +
          "<div class='g-sub'>" + esc(o.direccion || "—") + " · " + esc(o.cliente || "—") +
          " · " + esc(o.estado) + (nombres ? " · Dir.: " + esc(nombres) : "") + "</div></div>" +
          '<div class="g-acciones"><button type="button" class="btn btn-ghost btn-chico" data-editar="' +
          esc(o.id) + '">Editar</button></div></li>';
      }).join("") : '<li class="lista-vacia">Sin obras cargadas.</li>') +
      "</ul>";

    $("btn-guardar-obra").addEventListener("click", async () => {
      mostrarError("obra-error", "");
      const nombre = $("obra-nombre").value.trim();
      if (!nombre) { mostrarError("obra-error", "Poné el nombre de la obra."); return; }
      const datos = {
        nombre,
        direccion: $("obra-direccion").value.trim(),
        cliente: $("obra-cliente").value.trim(),
        estado: $("obra-estado").value,
        directores: Array.from(cont.querySelectorAll(".obra-director:checked")).map((c) => c.value)
      };
      try {
        await PO.store.guardarObra(estado.obraEditandoId, datos);
        toast(estado.obraEditandoId ? "Obra actualizada." : "Obra " + nombre + " agregada.");
        estado.obraEditandoId = null;
        renderTabObras();
      } catch (e) {
        mostrarError("obra-error", "No se pudo guardar: " + (e.message || e));
      }
    });
    const bCanc = $("obra-cancelar-edicion");
    if (bCanc) bCanc.addEventListener("click", () => { estado.obraEditandoId = null; renderTabObras(); });
    cont.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => { estado.obraEditandoId = b.dataset.editar; renderTabObras(); })
    );
  }

  /* --- Rubros --- */

  function renderTabRubros() {
    const cont = $("gestion-contenido");
    cont.innerHTML =
      '<p class="nota-suave" style="margin-bottom:10px">Un pedido pertenece a UN solo rubro: si una obra necesita electricidad y corralón, van dos pedidos.</p>' +
      '<div class="fila-alta">' +
        '<input class="input" id="rubro-nuevo" placeholder="Nuevo rubro…" />' +
        '<button type="button" class="btn btn-primario" id="btn-agregar-rubro">Agregar</button>' +
      "</div>" +
      (!estado.rubros.length
        ? '<div class="lista-vacia" style="margin-bottom:10px">Sin rubros.<br/><br/>' +
          '<button type="button" class="btn btn-ghost" id="btn-rubros-default">Cargar rubros por defecto</button></div>'
        : "") +
      '<ul class="lista-gestion">' +
      estado.rubros.map((r) =>
        '<li class="gestion-item" data-id="' + esc(r.id) + '">' +
        "<div class='g-titulo rubro-nombre'>" + esc(r.nombre) + "</div>" +
        '<div class="g-acciones">' +
          '<button type="button" class="btn btn-ghost btn-chico" data-editar="' + esc(r.id) + '">Editar</button>' +
          '<button type="button" class="btn btn-ghost btn-chico" style="color:var(--peligro)" data-borrar="' + esc(r.id) + '">Borrar</button>' +
        "</div></li>"
      ).join("") +
      "</ul>";

    $("btn-agregar-rubro").addEventListener("click", async () => {
      const nombre = $("rubro-nuevo").value.trim();
      if (!nombre) return;
      if (estado.rubros.some((r) => r.nombre.toLowerCase() === nombre.toLowerCase())) {
        toast("Ese rubro ya existe."); return;
      }
      try { await PO.store.guardarRubro(null, nombre); $("rubro-nuevo").value = ""; }
      catch (e) { toast("No se pudo agregar: " + (e.message || e)); }
    });
    const bDef = $("btn-rubros-default");
    if (bDef) bDef.addEventListener("click", async () => {
      bDef.disabled = true;
      try {
        for (const nombre of (window.APP_CONFIG.RUBROS_DEFAULT || [])) {
          await PO.store.guardarRubro(null, nombre);
        }
        toast("Rubros por defecto cargados.");
      } catch (e) { toast("No se pudieron cargar: " + (e.message || e)); }
    });
    cont.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => {
        const li = b.closest(".gestion-item");
        const r = estado.rubros.find((x) => x.id === b.dataset.editar);
        li.innerHTML =
          '<input class="input input-chico" style="flex:1" id="rubro-editar" value="' + esc(r.nombre) + '" />' +
          '<div class="g-acciones"><button type="button" class="btn btn-primario btn-chico" id="rubro-guardar">Guardar</button></div>';
        li.querySelector("#rubro-guardar").addEventListener("click", async () => {
          const nombre = li.querySelector("#rubro-editar").value.trim();
          if (!nombre) return;
          try { await PO.store.guardarRubro(r.id, nombre); toast("Rubro actualizado."); }
          catch (e) { toast("No se pudo actualizar: " + (e.message || e)); }
        });
      })
    );
    cont.querySelectorAll("[data-borrar]").forEach((b) =>
      b.addEventListener("click", async () => {
        const r = estado.rubros.find((x) => x.id === b.dataset.borrar);
        const enUso = estado.pedidos.some((p) => p.rubro === r.nombre);
        if (!confirm("¿Borrar el rubro “" + r.nombre + "”?" +
          (enUso ? "\nHay pedidos con este rubro: conservan el nombre en su historial." : ""))) return;
        try { await PO.store.borrarRubro(r.id); toast("Rubro borrado."); }
        catch (e) { toast("No se pudo borrar: " + (e.message || e)); }
      })
    );
  }

  /* --- Proveedores --- */

  function renderTabProveedores() {
    const cont = $("gestion-contenido");
    const editando = estado.proveedorEditandoId
      ? estado.proveedores.find((x) => x.id === estado.proveedorEditandoId) : null;

    cont.innerHTML =
      '<div class="gestion-form"><h4>' + (editando ? "Editar proveedor" : "Nuevo proveedor") + "</h4>" +
      '<label class="campo"><span>Nombre</span>' +
      '<input class="input" id="prov-form-nombre" value="' + esc(editando ? editando.nombre : "") + '" /></label>' +
      '<label class="campo"><span>Rubros (separados por coma)</span>' +
      '<input class="input" id="prov-form-rubros" placeholder="' +
        esc((estado.rubros[0] && estado.rubros[0].nombre) || "Electricidad") + ', …" value="' +
        esc(editando ? (editando.rubros || []).join(", ") : "") + '" /></label>' +
      '<label class="campo"><span>Teléfono (opcional)</span>' +
      '<input class="input" id="prov-form-telefono" value="' + esc(editando ? editando.telefono : "") + '" /></label>' +
      '<label class="campo"><span>Observaciones (opcional)</span>' +
      '<input class="input" id="prov-form-obs" value="' + esc(editando ? editando.observaciones : "") + '" /></label>' +
      '<p class="form-error oculto" id="prov-form-error"></p>' +
      '<div class="acciones-doble">' +
        (editando ? '<button type="button" class="btn btn-ghost" id="prov-cancelar-edicion">Cancelar</button>' : "") +
        '<button type="button" class="btn btn-primario" id="btn-guardar-proveedor">' +
          (editando ? "Actualizar" : "Agregar proveedor") + "</button>" +
      "</div></div>" +
      '<ul class="lista-gestion">' +
      (estado.proveedores.length ? estado.proveedores.map((x) =>
        '<li class="gestion-item">' +
        "<div><div class='g-titulo'>" + esc(x.nombre) + "</div>" +
        "<div class='g-sub'>" + esc((x.rubros || []).join(", ") || "—") +
        (x.telefono ? " · " + esc(x.telefono) : "") +
        (x.observaciones ? " · " + esc(x.observaciones) : "") + "</div></div>" +
        '<div class="g-acciones">' +
          '<button type="button" class="btn btn-ghost btn-chico" data-editar="' + esc(x.id) + '">Editar</button>' +
          '<button type="button" class="btn btn-ghost btn-chico" style="color:var(--peligro)" data-borrar="' + esc(x.id) + '">Borrar</button>' +
        "</div></li>"
      ).join("") : '<li class="lista-vacia">Sin proveedores. También se agregan solos al pedirle a un proveedor nuevo desde un pedido.</li>') +
      "</ul>";

    $("btn-guardar-proveedor").addEventListener("click", async () => {
      mostrarError("prov-form-error", "");
      const nombre = $("prov-form-nombre").value.trim();
      if (!nombre) { mostrarError("prov-form-error", "Poné el nombre del proveedor."); return; }
      const datos = {
        nombre,
        rubros: $("prov-form-rubros").value.split(",").map((s) => s.trim()).filter(Boolean),
        telefono: $("prov-form-telefono").value.trim(),
        observaciones: $("prov-form-obs").value.trim()
      };
      try {
        await PO.store.guardarProveedor(estado.proveedorEditandoId, datos);
        toast(estado.proveedorEditandoId ? "Proveedor actualizado." : "Proveedor agregado.");
        estado.proveedorEditandoId = null;
        renderTabProveedores();
      } catch (e) {
        mostrarError("prov-form-error", "No se pudo guardar: " + (e.message || e));
      }
    });
    const bCanc = $("prov-cancelar-edicion");
    if (bCanc) bCanc.addEventListener("click", () => { estado.proveedorEditandoId = null; renderTabProveedores(); });
    cont.querySelectorAll("[data-editar]").forEach((b) =>
      b.addEventListener("click", () => { estado.proveedorEditandoId = b.dataset.editar; renderTabProveedores(); })
    );
    cont.querySelectorAll("[data-borrar]").forEach((b) =>
      b.addEventListener("click", async () => {
        const x = estado.proveedores.find((y) => y.id === b.dataset.borrar);
        if (!confirm("¿Borrar el proveedor “" + x.nombre + "”? Los pedidos ya hechos conservan su nombre.")) return;
        try { await PO.store.borrarProveedor(x.id); toast("Proveedor borrado."); }
        catch (e) { toast("No se pudo borrar: " + (e.message || e)); }
      })
    );
  }

  /* --- Usuarios --- */

  function renderTabUsuarios() {
    const cont = $("gestion-contenido");
    cont.innerHTML =
      '<p class="nota-suave" style="margin-bottom:10px">Los usuarios se registran solos con los códigos de invitación ' +
      "(director / admin / control). Acá les cambiás el rol o los desactivás. " +
      "La asignación de obras a cada director se hace en la pestaña Obras.</p>" +
      '<ul class="lista-gestion">' +
      (estado.usuarios.length ? estado.usuarios.map((x) => {
        const soyYo = x.uid === estado.usuario.uid;
        return '<li class="gestion-item' + (x.activo === false ? " apagado" : "") + '">' +
          "<div><div class='g-titulo'>" + esc(x.nombre) + (soyYo ? " (vos)" : "") + "</div>" +
          "<div class='g-sub'>" + esc(x.email) + " · " + rolEtiqueta(x.rol) +
          (x.activo === false ? " · desactivado" : "") + "</div></div>" +
          '<div class="g-acciones">' +
            '<select class="input input-chico usuario-rol" data-uid="' + esc(x.uid) + '"' + (soyYo ? " disabled" : "") + ">" +
              ["director", "admin", "control"].map((r) =>
                '<option value="' + r + '"' + (x.rol === r ? " selected" : "") + ">" + r + "</option>").join("") +
            "</select>" +
            '<button type="button" class="btn btn-ghost btn-chico usuario-activo" data-uid="' + esc(x.uid) +
            '" data-activo="' + (x.activo === false ? "0" : "1") + '"' + (soyYo ? " disabled" : "") + ">" +
            (x.activo === false ? "Activar" : "Desactivar") + "</button>" +
          "</div></li>";
      }).join("") : '<li class="lista-vacia">Cargando usuarios…</li>') +
      "</ul>";

    cont.querySelectorAll(".usuario-rol").forEach((sel) =>
      sel.addEventListener("change", async () => {
        const x = estado.usuarios.find((y) => y.uid === sel.dataset.uid);
        if (!confirm("¿Cambiar el rol de " + x.nombre + " a “" + sel.value + "”?")) {
          sel.value = x.rol; return;
        }
        try { await PO.store.actualizarUsuario(x.uid, { rol: sel.value }); toast("Rol actualizado."); }
        catch (e) { toast("No se pudo cambiar: " + (e.message || e)); sel.value = x.rol; }
      })
    );
    cont.querySelectorAll(".usuario-activo").forEach((b) =>
      b.addEventListener("click", async () => {
        const x = estado.usuarios.find((y) => y.uid === b.dataset.uid);
        const activar = b.dataset.activo === "0";
        try {
          await PO.store.actualizarUsuario(x.uid, { activo: activar });
          toast(activar ? "Usuario activado." : "Usuario desactivado.");
        } catch (e) { toast("No se pudo actualizar: " + (e.message || e)); }
      })
    );
  }

  /* ---------------------------------------------------------------- perfil - */

  function renderPerfil() {
    const u = estado.usuario;
    $("perfil-nombre").value = u.nombre || "";
    $("perfil-email").value = u.email || "";
    $("perfil-whatsapp").value = u.whatsapp || "";
    const avisos = u.avisos || {};
    ["pedido_nuevo", "recibido", "pedido_proveedor", "recepcion"].forEach((k) => {
      $("aviso-" + k).checked = avisos[k] !== false;
    });
    $("perfil-rol").textContent = "Rol: " + rolEtiqueta(u.rol) +
      ". El rol lo administra administración.";
    mostrarError("perfil-error", "");
  }

  async function onGuardarPerfil(e) {
    e.preventDefault();
    mostrarError("perfil-error", "");
    const nombre = $("perfil-nombre").value.trim();
    if (!nombre) { mostrarError("perfil-error", "El nombre no puede quedar vacío."); return; }
    const whatsapp = $("perfil-whatsapp").value.replace(/[^\d]/g, "");
    const avisos = {};
    ["pedido_nuevo", "recibido", "pedido_proveedor", "recepcion"].forEach((k) => {
      avisos[k] = $("aviso-" + k).checked;
    });
    $("btn-guardar-perfil").disabled = true;
    try {
      await PO.store.actualizarUsuario(estado.usuario.uid, { nombre, whatsapp, avisos });
      estado.usuario = { ...estado.usuario, nombre, whatsapp, avisos };
      toast("Perfil guardado.");
    } catch (err) {
      mostrarError("perfil-error", "No se pudo guardar: " + (err.message || err));
    } finally {
      $("btn-guardar-perfil").disabled = false;
    }
  }

  /* ------------------------------------- expuesto para pruebas / debug ---- */

  PO.ui = {
    estado,
    ir,
    mostrarPantalla,
    abrirDetalle,
    renderDashboard,
    renderListado,
    renderDetalle,
    renderGestion,
    renderPerfil,
    renderNotificaciones,
    renderBadgeCampana,
    prepararFormNuevo,
    abrirModalRecepcion,
    abrirModalProveedor,
    abrirModal,
    cerrarModal
  };

})();
