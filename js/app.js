/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — app.js
   Toda la interfaz: login/registro, lista de pedidos, nuevo pedido, detalle
   con acciones por rol, gestión de obras, fotos y notificaciones.
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

  /** "hace 3 días" a partir de un Timestamp de Firestore. */
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

  /** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
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

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /** Número con coma decimal, sin ceros de más. */
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
    solicitado:      "Solicitado",
    en_compra:       "En compra",
    entrega_parcial: "Entrega parcial",
    entregado:       "Entregado",
    cancelado:       "Cancelado"
  };

  const ACCIONES = {
    creado:    "Pedido creado",
    en_compra: "Pasado a compra",
    recepcion: "Recepción registrada",
    cancelado: "Pedido cancelado"
  };

  const ETAPAS_FOTO = { pedido: "Al pedir", compra: "En compra", entrega: "En entrega" };

  const MAX_BASE64 = 700 * 1024; // ~700 KB por foto (Firestore admite 1 MB por doc)

  /* ------------------------------------------------------ estado global --- */

  const estado = {
    usuario: null,          // { uid, nombre, email, rol }
    obras: [],
    pedidos: [],
    fotosPedido: [],
    filtroEstado: "todos",
    filtroObra: "todas",
    soloMios: false,
    vista: "lista",
    pedidoAbiertoId: null,
    fotosNuevo: [],         // base64 del form de nuevo pedido
    registroPendiente: null, // { nombre, rol } mientras se crea la cuenta
    subs: { obras: null, pedidos: null, fotos: null }
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

  /* -------------------------------------------------- pantallas y rutas --- */

  function mostrarPantalla(cual) {
    $("pantalla-config").classList.toggle("oculto", cual !== "config");
    $("pantalla-auth").classList.toggle("oculto", cual !== "auth");
    $("pantalla-app").classList.toggle("oculto", cual !== "app");
  }

  function ir(vista) {
    if (estado.vista === "detalle" && vista !== "detalle" && estado.subs.fotos) {
      estado.subs.fotos();
      estado.subs.fotos = null;
    }
    estado.vista = vista;
    ["lista", "nuevo", "detalle", "obras"].forEach((v) =>
      $("vista-" + v).classList.toggle("oculto", v !== vista)
    );
    if (vista === "lista") renderLista();
    if (vista === "nuevo") prepararFormNuevo();
    if (vista === "detalle") renderDetalle();
    if (vista === "obras") renderObras();
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

      // Registro recién hecho: el doc de usuario lo creamos acá.
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

      estado.registroPendiente = null;
      iniciarSesion(perfil);
    } catch (e) {
      console.error("[PO] Error cargando el perfil:", e);
      toast("Error cargando tu usuario. Revisá la conexión.");
    }
  }

  function iniciarSesion(perfil) {
    estado.usuario = perfil;

    // Cada rol arranca mirando lo que le importa:
    // obra → sus pedidos; admin → la bandeja de "solicitado".
    if (perfil.rol === "admin") {
      estado.filtroEstado = "solicitado";
      estado.soloMios = false;
    } else {
      estado.filtroEstado = "todos";
      estado.soloMios = true;
    }
    estado.filtroObra = "todas";

    renderHeaderUsuario();
    $("wrap-mios").classList.toggle("oculto", perfil.rol !== "obra");
    $("check-mios").checked = estado.soloMios;
    $("btn-ver-obras").classList.toggle("oculto", perfil.rol !== "admin");

    if (estado.subs.obras) estado.subs.obras();
    if (estado.subs.pedidos) estado.subs.pedidos();
    estado.subs.obras = PO.store.subObras((obras) => {
      estado.obras = obras;
      renderFiltroObra();
      if (estado.vista === "lista") renderLista();
      if (estado.vista === "obras") renderObras();
    });
    estado.subs.pedidos = PO.store.subPedidos((pedidos) => {
      estado.pedidos = pedidos;
      if (estado.vista === "lista") renderLista();
      if (estado.vista === "detalle") renderDetalle();
    });

    mostrarPantalla("app");
    ir("lista");
  }

  function limpiarSesion() {
    Object.keys(estado.subs).forEach((k) => {
      if (estado.subs[k]) { estado.subs[k](); estado.subs[k] = null; }
    });
    estado.usuario = null;
    estado.obras = [];
    estado.pedidos = [];
    estado.fotosPedido = [];
    estado.pedidoAbiertoId = null;
  }

  function renderHeaderUsuario() {
    const u = estado.usuario || {};
    $("usuario-nombre").textContent = u.nombre || "";
    $("usuario-rol").textContent = u.rol === "admin" ? "Administración" : "Dirección de obra";
  }

  /* ------------------------------------------------------------- eventos -- */

  function conectarEventos() {
    // Auth: alternar login/registro
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

    // Lista
    $("btn-nuevo-pedido").addEventListener("click", () => ir("nuevo"));
    $("btn-ver-obras").addEventListener("click", () => ir("obras"));
    $("filtro-obra").addEventListener("change", (e) => {
      estado.filtroObra = e.target.value;
      renderLista();
    });
    $("check-mios").addEventListener("change", (e) => {
      estado.soloMios = e.target.checked;
      renderLista();
    });

    // Nuevo pedido
    $("nuevo-volver").addEventListener("click", () => ir("lista"));
    $("btn-agregar-item").addEventListener("click", () => agregarFilaItem());
    $("btn-agregar-foto").addEventListener("click", () => $("input-foto-nuevo").click());
    $("input-foto-nuevo").addEventListener("change", onFotosNuevo);
    $("form-pedido").addEventListener("submit", onGuardarPedido);

    // Detalle
    $("detalle-volver").addEventListener("click", () => ir("lista"));
    $("input-foto-detalle").addEventListener("change", onFotoDetalle);

    // Obras
    $("obras-volver").addEventListener("click", () => ir("lista"));
    $("form-obra").addEventListener("submit", onGuardarObra);

    // Modales
    $("compra-cancelar").addEventListener("click", () => cerrarModal("modal-compra"));
    $("compra-confirmar").addEventListener("click", onConfirmarCompra);
    $("recepcion-cancelar").addEventListener("click", () => cerrarModal("modal-recepcion"));
    $("recepcion-confirmar").addEventListener("click", onConfirmarRecepcion);
    $("cancelar-cerrar").addEventListener("click", () => cerrarModal("modal-cancelar"));
    $("cancelar-confirmar").addEventListener("click", onConfirmarCancelacion);
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
      // onAuth se encarga de crear el doc de usuario y entrar.
    } catch (err) {
      estado.registroPendiente = null;
      mostrarError("registro-error", errorAuthES(err));
    } finally {
      $("btn-registro").disabled = false;
    }
  }

  /* --------------------------------------------------------------- lista -- */

  function pedidosFiltradosBase() {
    let lista = estado.pedidos;
    if (estado.usuario && estado.usuario.rol === "obra" && estado.soloMios) {
      lista = lista.filter((p) => p.solicitanteUid === estado.usuario.uid);
    }
    if (estado.filtroObra !== "todas") {
      lista = lista.filter((p) => p.obraId === estado.filtroObra);
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
      '<button type="button" class="chip' + (estado.filtroEstado === clave ? " activo" : "") +
      '" data-estado="' + clave + '">' + etiqueta +
      ' <span class="chip-num">' + num + "</span></button>"
    ).join("");

    $("chips-estado").querySelectorAll(".chip").forEach((ch) =>
      ch.addEventListener("click", () => {
        estado.filtroEstado = ch.dataset.estado;
        renderLista();
      })
    );
  }

  function renderFiltroObra() {
    const sel = $("filtro-obra");
    sel.innerHTML = '<option value="todas">Todas las obras</option>' +
      estado.obras.map((o) =>
        '<option value="' + esc(o.id) + '">' + esc(o.codigo) +
        (o.activa === false ? " (archivada)" : "") + "</option>"
      ).join("");
    sel.value = estado.filtroObra;
    if (sel.value !== estado.filtroObra) { estado.filtroObra = "todas"; sel.value = "todas"; }
  }

  function resumenItems(items) {
    const arr = (items || []).map((it) => fmtCant(it.cantidad) + " " + esc(it.unidad) + " — " + esc(it.descripcion));
    if (arr.length <= 2) return arr.join(" · ");
    return arr.slice(0, 2).join(" · ") + " · +" + (arr.length - 2) + " más";
  }

  function renderLista() {
    renderChips();

    let lista = pedidosFiltradosBase();
    if (estado.filtroEstado !== "todos") {
      lista = lista.filter((p) => p.estado === estado.filtroEstado);
    }

    const ul = $("lista-pedidos");

    if (!estado.obras.length && estado.usuario && estado.usuario.rol === "admin") {
      ul.innerHTML = '<li class="lista-vacia">Todavía no hay obras cargadas.<br/><br/>' +
        '<button type="button" class="btn btn-primario" id="btn-primera-obra">Cargar la primera obra</button></li>';
      const b = $("btn-primera-obra");
      if (b) b.addEventListener("click", () => ir("obras"));
      return;
    }

    if (!lista.length) {
      const msj = !estado.obras.length
        ? "Todavía no hay obras cargadas. Pedile a administración que cargue la primera."
        : (estado.pedidos.length
          ? "No hay pedidos con estos filtros."
          : "Todavía no hay pedidos. Tocá “+ Nuevo pedido” para crear el primero.");
      ul.innerHTML = '<li class="lista-vacia">' + msj + "</li>";
      return;
    }

    const hoy = hoyISO();
    ul.innerHTML = lista.map((p) => {
      const vencido = p.necesitaPara && p.necesitaPara < hoy &&
        ["solicitado", "en_compra", "entrega_parcial"].includes(p.estado);
      return '<li class="pedido-card" data-id="' + esc(p.id) + '">' +
        '<div class="pedido-card-cab">' +
          '<span class="pedido-numero">' + esc(p.numero) + "</span>" +
          '<span class="badge badge-' + esc(p.estado) + '">' + (ESTADOS[p.estado] || esc(p.estado)) + "</span>" +
        "</div>" +
        '<div class="pedido-obra">' + esc(p.obraCodigo) + "</div>" +
        '<div class="pedido-meta">' + haceCuanto(p.creado) + " · " + esc(p.solicitanteNombre) +
          (p.necesitaPara
            ? ' · <span class="' + (vencido ? "vencido" : "") + '">necesita: ' + fmtFecha(p.necesitaPara) + "</span>"
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
    const obrasActivas = estado.obras.filter((o) => o.activa !== false);
    $("pedido-obra").innerHTML = '<option value="">Elegí la obra…</option>' +
      obrasActivas.map((o) =>
        '<option value="' + esc(o.id) + '">' + esc(o.codigo) + " — " + esc(o.nombre) + "</option>"
      ).join("");
    $("pedido-fecha").value = "";
    $("pedido-fecha").min = hoyISO();
    $("pedido-obs").value = "";
    $("items-editor").innerHTML = "";
    agregarFilaItem();
    estado.fotosNuevo = [];
    renderFotosNuevo();
    mostrarError("pedido-error", "");
  }

  function agregarFilaItem() {
    const div = document.createElement("div");
    div.className = "item-fila";
    div.innerHTML =
      '<input class="input it-desc" type="text" placeholder="Material (ej: Cemento CPC40 x 50 kg)" />' +
      '<div class="item-fila-abajo">' +
        '<input class="input it-cant" type="text" inputmode="decimal" placeholder="Cantidad" />' +
        '<input class="input it-unidad" type="text" list="lista-unidades" placeholder="Unidad" value="un." />' +
        '<button type="button" class="item-quitar">Quitar</button>' +
      "</div>";
    div.querySelector(".item-quitar").addEventListener("click", () => {
      if ($("items-editor").children.length > 1) div.remove();
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
      if (!descripcion && !cantidad) continue; // fila vacía: se ignora
      if (!descripcion) return { error: "Hay un material sin descripción." };
      if (cantidad <= 0) return { error: "La cantidad de “" + descripcion + "” tiene que ser mayor a 0." };
      items.push({ descripcion, cantidad, unidad, recibido: 0 });
    }
    if (!items.length) return { error: "Cargá al menos un material." };
    return { items };
  }

  function renderFotosNuevo() {
    $("fotos-previa").innerHTML = estado.fotosNuevo.map((b64, i) =>
      '<div class="foto-mini"><img src="' + b64 + '" alt="Foto ' + (i + 1) + '" />' +
      '<button type="button" class="foto-quitar" data-i="' + i + '">×</button></div>'
    ).join("");
    $("fotos-previa").querySelectorAll(".foto-quitar").forEach((b) =>
      b.addEventListener("click", () => {
        estado.fotosNuevo.splice(Number(b.dataset.i), 1);
        renderFotosNuevo();
      })
    );
  }

  async function onFotosNuevo(e) {
    const archivos = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of archivos) {
      try {
        estado.fotosNuevo.push(await comprimirImagen(f));
      } catch (err) {
        toast(err.message || "No se pudo procesar la foto.");
      }
    }
    renderFotosNuevo();
  }

  async function onGuardarPedido(e) {
    e.preventDefault();
    mostrarError("pedido-error", "");

    const obraId = $("pedido-obra").value;
    const obra = estado.obras.find((o) => o.id === obraId);
    if (!obra) { mostrarError("pedido-error", "Elegí la obra."); return; }

    const necesitaPara = $("pedido-fecha").value;
    if (!necesitaPara) { mostrarError("pedido-error", "Indicá para cuándo se necesita."); return; }

    const res = leerItems();
    if (res.error) { mostrarError("pedido-error", res.error); return; }

    const u = estado.usuario;
    const datos = {
      obraId,
      obraCodigo: obra.codigo,
      solicitanteUid: u.uid,
      solicitanteNombre: u.nombre,
      creado: PO.fb.tsServidor(),
      necesitaPara,
      estado: "solicitado",
      observaciones: $("pedido-obs").value.trim(),
      items: res.items,
      compra: null,
      historial: [{ accion: "creado", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota: "" }]
    };

    $("btn-guardar-pedido").disabled = true;
    try {
      const creado = await PO.store.crearPedido(datos, estado.fotosNuevo, u.nombre);
      PO.store.notificar("pedido_creado", { ...datos, numero: creado.numero }, u.nombre);
      toast("Pedido " + creado.numero + " enviado.");
      ir("lista");
    } catch (err) {
      console.error(err);
      mostrarError("pedido-error", "No se pudo guardar el pedido: " + (err.message || err));
    } finally {
      $("btn-guardar-pedido").disabled = false;
    }
  }

  /* -------------------------------------------------------------- fotos --- */

  /** Comprime una imagen con canvas: lado máximo 1000 px, JPEG calidad 0.7.
      Si aun así queda pesada, baja la calidad; si no alcanza, la rechaza. */
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
            resolve(data);
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

  function etapaFotoSegunEstado(p) {
    if (p.estado === "solicitado") return "pedido";
    if (p.estado === "en_compra") return "compra";
    return "entrega";
  }

  async function onFotoDetalle(e) {
    const archivo = (e.target.files || [])[0];
    e.target.value = "";
    if (!archivo) return;
    const p = pedidoAbierto();
    if (!p) return;
    try {
      const b64 = await comprimirImagen(archivo);
      await PO.store.agregarFoto(p.id, b64, etapaFotoSegunEstado(p), estado.usuario.nombre);
      toast("Foto agregada.");
    } catch (err) {
      toast(err.message || "No se pudo subir la foto.");
    }
  }

  /* ------------------------------------------------------------- detalle -- */

  function pedidoAbierto() {
    return estado.pedidos.find((p) => p.id === estado.pedidoAbiertoId) || null;
  }

  function abrirDetalle(id) {
    estado.pedidoAbiertoId = id;
    estado.fotosPedido = [];
    if (estado.subs.fotos) estado.subs.fotos();
    estado.subs.fotos = PO.store.subFotos(id, (fotos) => {
      estado.fotosPedido = fotos;
      if (estado.vista === "detalle") renderDetalle();
    });
    ir("detalle");
  }

  function renderDetalle() {
    const p = pedidoAbierto();
    const cont = $("detalle-contenido");
    if (!p) {
      $("detalle-titulo").textContent = "Pedido";
      cont.innerHTML = '<p class="nota-suave">Cargando pedido…</p>';
      return;
    }

    $("detalle-titulo").textContent = p.numero;
    const u = estado.usuario;
    const esAdmin = u.rol === "admin";
    const abiertoEstado = ["solicitado", "en_compra", "entrega_parcial"].includes(p.estado);

    const puedeCompra = esAdmin && p.estado === "solicitado";
    const puedeRecepcion = ["en_compra", "entrega_parcial"].includes(p.estado);
    const puedeCancelar = (esAdmin || p.solicitanteUid === u.uid) && abiertoEstado;
    const puedeFoto = p.estado !== "cancelado";

    const obra = estado.obras.find((o) => o.id === p.obraId);
    const hoy = hoyISO();
    const vencido = p.necesitaPara && p.necesitaPara < hoy && abiertoEstado;

    let html = "";

    /* Cabecera */
    html += '<div class="detalle-cab">' +
      '<span class="pedido-numero">' + esc(p.numero) + "</span>" +
      '<span class="badge badge-' + esc(p.estado) + '">' + (ESTADOS[p.estado] || esc(p.estado)) + "</span>" +
      "</div>";

    /* Datos generales */
    html += '<div class="bloque"><h4>Datos del pedido</h4>' +
      dato("Obra", esc(p.obraCodigo) + (obra ? " — " + esc(obra.nombre) : "")) +
      dato("Solicitó", esc(p.solicitanteNombre)) +
      dato("Creado", fmtTs(p.creado) + " (" + haceCuanto(p.creado) + ")") +
      dato("Se necesita para", (vencido ? '<span class="vencido" style="color:var(--peligro)">' : "<span>") +
        fmtFecha(p.necesitaPara) + "</span>") +
      (p.observaciones ? dato("Observaciones", esc(p.observaciones)) : "") +
      "</div>";

    /* Datos de compra */
    if (p.compra) {
      html += '<div class="bloque"><h4>Compra</h4>' +
        dato("Proveedor", esc(p.compra.proveedor)) +
        (p.compra.oc ? dato("Orden de compra", esc(p.compra.oc)) : "") +
        (p.compra.fechaEstimada ? dato("Entrega estimada", fmtFecha(p.compra.fechaEstimada)) : "") +
        dato("Gestionó", esc(p.compra.compradorNombre)) +
        "</div>";
    }

    /* Materiales */
    html += '<div class="bloque"><h4>Materiales</h4>' +
      (p.items || []).map((it) => {
        const completo = Number(it.recibido || 0) >= Number(it.cantidad);
        return '<div class="item-linea"><span>' + esc(it.descripcion) + "</span>" +
          '<span class="item-recibido' + (completo ? " completo" : "") + '">' +
          fmtCant(it.recibido || 0) + " / " + fmtCant(it.cantidad) + " " + esc(it.unidad) +
          "</span></div>";
      }).join("") +
      "</div>";

    /* Fotos */
    html += '<div class="bloque"><h4>Fotos</h4>';
    if (!estado.fotosPedido.length) {
      html += '<p class="nota-suave">Sin fotos por ahora.</p>';
    } else {
      ["pedido", "compra", "entrega"].forEach((etapa) => {
        const fotos = estado.fotosPedido.filter((f) => f.etapa === etapa);
        if (!fotos.length) return;
        html += '<p class="fotos-etapa-titulo">' + ETAPAS_FOTO[etapa] + "</p>" +
          '<div class="fotos-grilla">' +
          fotos.map((f) =>
            '<button type="button" class="foto-mini" data-foto="' + esc(f.id) + '">' +
            '<img src="' + f.base64 + '" alt="Foto" /></button>'
          ).join("") +
          "</div>";
      });
    }
    if (puedeFoto) {
      html += '<button type="button" class="btn btn-ghost btn-bloque" id="btn-foto-detalle">+ Agregar foto</button>';
    }
    html += "</div>";

    /* Historial */
    html += '<div class="bloque"><h4>Historial</h4><ul class="timeline">' +
      (p.historial || []).slice().reverse().map((h) =>
        "<li><div class='t-accion'>" + (ACCIONES[h.accion] || esc(h.accion)) + "</div>" +
        "<div class='t-meta'>" + esc(h.usuarioNombre) + " · " + fmtTs(h.ts) + "</div>" +
        (h.nota ? "<div class='t-nota'>" + esc(h.nota) + "</div>" : "") +
        "</li>"
      ).join("") +
      "</ul></div>";

    /* Acciones */
    const botones = [];
    if (puedeCompra) botones.push('<button type="button" class="btn btn-primario" id="btn-a-compra">Pasar a compra</button>');
    if (puedeRecepcion) botones.push('<button type="button" class="btn btn-primario" id="btn-recepcion">Registrar recepción</button>');
    if (puedeCancelar) botones.push('<button type="button" class="btn btn-ghost" id="btn-cancelar-pedido" style="color:var(--peligro)">Cancelar pedido</button>');
    if (botones.length) html += '<div class="detalle-acciones">' + botones.join("") + "</div>";

    cont.innerHTML = html;

    /* Conexión de los botones recién creados */
    const bCompra = $("btn-a-compra");
    if (bCompra) bCompra.addEventListener("click", abrirModalCompra);
    const bRec = $("btn-recepcion");
    if (bRec) bRec.addEventListener("click", abrirModalRecepcion);
    const bCanc = $("btn-cancelar-pedido");
    if (bCanc) bCanc.addEventListener("click", () => {
      $("cancelar-nota").value = "";
      mostrarError("cancelar-error", "");
      abrirModal("modal-cancelar");
    });
    const bFoto = $("btn-foto-detalle");
    if (bFoto) bFoto.addEventListener("click", () => $("input-foto-detalle").click());

    cont.querySelectorAll(".foto-mini[data-foto]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const f = estado.fotosPedido.find((x) => x.id === btn.dataset.foto);
        if (!f) return;
        $("modal-foto-img").src = f.base64;
        $("modal-foto-pie").textContent = (ETAPAS_FOTO[f.etapa] || f.etapa) + " · " +
          f.usuarioNombre + " · " + fmtTs(f.ts);
        abrirModal("modal-foto");
      })
    );

    function dato(etiqueta, valor) {
      return '<div class="dato-fila"><span class="dato-etiqueta">' + etiqueta +
        '</span><span class="dato-valor">' + valor + "</span></div>";
    }
  }

  /* -------------------------------------------------- acción: a compra ---- */

  function abrirModalCompra() {
    const p = pedidoAbierto();
    if (!p) return;
    $("compra-subtitulo").textContent = p.numero + " · " + p.obraCodigo;
    $("compra-proveedor").value = "";
    $("compra-oc").value = "";
    $("compra-fecha").value = "";
    mostrarError("compra-error", "");
    abrirModal("modal-compra");
  }

  async function onConfirmarCompra() {
    const p = pedidoAbierto();
    if (!p) return;
    const proveedor = $("compra-proveedor").value.trim();
    if (!proveedor) { mostrarError("compra-error", "El proveedor es obligatorio."); return; }

    const oc = $("compra-oc").value.trim();
    const fechaEstimada = $("compra-fecha").value;
    const u = estado.usuario;

    const nota = "Proveedor: " + proveedor +
      (oc ? " · OC: " + oc : "") +
      (fechaEstimada ? " · Entrega estimada: " + fmtFecha(fechaEstimada) : "");

    $("compra-confirmar").disabled = true;
    try {
      await PO.store.actualizarPedido(p.id, {
        estado: "en_compra",
        compra: {
          proveedor,
          oc: oc || null,
          fechaEstimada: fechaEstimada || null,
          compradorNombre: u.nombre,
          ts: PO.fb.tsAhora()
        },
        historial: (p.historial || []).concat([{
          accion: "en_compra", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      });
      PO.store.notificar("en_compra", { ...p, estado: "en_compra" }, u.nombre);
      cerrarModal("modal-compra");
      toast("Pedido " + p.numero + " pasado a compra.");
    } catch (err) {
      mostrarError("compra-error", "No se pudo guardar: " + (err.message || err));
    } finally {
      $("compra-confirmar").disabled = false;
    }
  }

  /* ------------------------------------------------ acción: recepción ----- */

  function abrirModalRecepcion() {
    const p = pedidoAbierto();
    if (!p) return;
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
    }).join("");
    mostrarError("recepcion-error", "");
    abrirModal("modal-recepcion");
  }

  async function onConfirmarRecepcion() {
    const p = pedidoAbierto();
    if (!p) return;
    const u = estado.usuario;

    const inputs = Array.from($("recepcion-items").querySelectorAll("input[data-i]"));
    const items = (p.items || []).map((it) => ({ ...it }));
    const lineasNota = [];
    let algo = false;

    for (const inp of inputs) {
      const val = parseCant(inp.value);
      if (val < 0) { mostrarError("recepcion-error", "Las cantidades no pueden ser negativas."); return; }
      if (!val) continue;
      const i = Number(inp.dataset.i);
      items[i].recibido = Math.round((Number(items[i].recibido || 0) + val) * 100) / 100;
      lineasNota.push(items[i].descripcion + ": +" + fmtCant(val) + " " + items[i].unidad +
        " (va " + fmtCant(items[i].recibido) + " de " + fmtCant(items[i].cantidad) + ")");
      algo = true;
    }

    if (!algo) { mostrarError("recepcion-error", "Cargá al menos una cantidad recibida."); return; }

    const completo = items.every((it) => Number(it.recibido || 0) >= Number(it.cantidad));
    const nuevoEstado = completo ? "entregado" : "entrega_parcial";
    const nota = (completo ? "Recepción completa.\n" : "Recepción parcial.\n") + lineasNota.join("\n");

    $("recepcion-confirmar").disabled = true;
    try {
      await PO.store.actualizarPedido(p.id, {
        estado: nuevoEstado,
        items,
        historial: (p.historial || []).concat([{
          accion: "recepcion", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      });
      PO.store.notificar(nuevoEstado, { ...p, estado: nuevoEstado, items }, u.nombre);
      cerrarModal("modal-recepcion");
      toast(completo ? "Pedido " + p.numero + " entregado completo." : "Recepción parcial registrada.");
    } catch (err) {
      mostrarError("recepcion-error", "No se pudo guardar: " + (err.message || err));
    } finally {
      $("recepcion-confirmar").disabled = false;
    }
  }

  /* ----------------------------------------------- acción: cancelar ------- */

  async function onConfirmarCancelacion() {
    const p = pedidoAbierto();
    if (!p) return;
    const nota = $("cancelar-nota").value.trim();
    if (!nota) { mostrarError("cancelar-error", "Contá brevemente por qué se cancela."); return; }
    const u = estado.usuario;

    $("cancelar-confirmar").disabled = true;
    try {
      await PO.store.actualizarPedido(p.id, {
        estado: "cancelado",
        historial: (p.historial || []).concat([{
          accion: "cancelado", usuarioNombre: u.nombre, ts: PO.fb.tsAhora(), nota
        }])
      });
      PO.store.notificar("cancelado", { ...p, estado: "cancelado" }, u.nombre);
      cerrarModal("modal-cancelar");
      toast("Pedido " + p.numero + " cancelado.");
    } catch (err) {
      mostrarError("cancelar-error", "No se pudo cancelar: " + (err.message || err));
    } finally {
      $("cancelar-confirmar").disabled = false;
    }
  }

  /* ---------------------------------------------------------------- obras - */

  function renderObras() {
    const ul = $("lista-obras");
    if (!estado.obras.length) {
      ul.innerHTML = '<li class="lista-vacia">Sin obras cargadas. Agregá la primera con el formulario de arriba.</li>';
      return;
    }
    ul.innerHTML = estado.obras.map((o) => {
      const archivada = o.activa === false;
      return '<li class="obra-item' + (archivada ? " archivada" : "") + '">' +
        "<div><div class='obra-codigo'>" + esc(o.codigo) + "</div>" +
        "<div class='obra-nombre'>" + esc(o.nombre) + (archivada ? " · archivada" : "") + "</div></div>" +
        '<button type="button" class="btn btn-ghost btn-chico" data-id="' + esc(o.id) +
        '" data-activa="' + (archivada ? "1" : "0") + '">' +
        (archivada ? "Reactivar" : "Archivar") + "</button></li>";
    }).join("");

    ul.querySelectorAll("button[data-id]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await PO.store.setObraActiva(b.dataset.id, b.dataset.activa === "1");
          toast(b.dataset.activa === "1" ? "Obra reactivada." : "Obra archivada.");
        } catch (err) {
          toast("No se pudo actualizar la obra: " + (err.message || err));
        }
      })
    );
  }

  async function onGuardarObra(e) {
    e.preventDefault();
    mostrarError("obra-error", "");
    const codigo = $("obra-codigo").value.trim().toUpperCase();
    const nombre = $("obra-nombre").value.trim();
    if (!codigo) { mostrarError("obra-error", "Poné el código de la obra (ej: MOL-1047)."); return; }
    if (!nombre) { mostrarError("obra-error", "Poné un nombre o referencia."); return; }
    if (estado.obras.some((o) => o.codigo === codigo)) {
      mostrarError("obra-error", "Ya existe una obra con el código " + codigo + ".");
      return;
    }
    $("btn-guardar-obra").disabled = true;
    try {
      await PO.store.crearObra(codigo, nombre);
      $("obra-codigo").value = "";
      $("obra-nombre").value = "";
      toast("Obra " + codigo + " agregada.");
    } catch (err) {
      mostrarError("obra-error", "No se pudo guardar: " + (err.message || err));
    } finally {
      $("btn-guardar-obra").disabled = false;
    }
  }

  /* ------------------------------------- expuesto para pruebas / debug ---- */

  PO.ui = {
    estado,
    ir,
    mostrarPantalla,
    renderLista,
    renderDetalle,
    renderObras,
    renderFiltroObra,
    renderHeaderUsuario,
    prepararFormNuevo,
    abrirModalRecepcion,
    abrirModalCompra
  };

})();
