/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — service-worker.js
   Hace la app instalable (PWA) y rápida:
   - App shell (los archivos propios listados abajo): cache-first, se precachean
     al instalar.
   - Todo lo demás del mismo origen: network-first con respaldo en cache.
   - Firebase y otros orígenes: red directa (no se intercepta).

   Rutas RELATIVAS a propósito: la app puede vivir en un subpath tipo
   /pedidos-obra/ (GitHub Pages) sin tocar nada.

   ¿Cambiaste archivos y no ves la novedad? Subí la versión (v1 → v2).
   ============================================================================ */

const CACHE = "pedidos-obra-v37";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  // Tipografía de marca: precacheada para que en obra sin señal la app se
  // siga viendo con Poppins y no salte a la fuente del sistema.
  "./assets/fuentes/poppins-200.woff2",
  "./assets/fuentes/poppins-300.woff2",
  "./assets/fuentes/poppins-400.woff2",
  "./assets/fuentes/poppins-500.woff2",
  "./assets/fuentes/poppins-600.woff2",
  "./js/config.js",
  "./js/firebase-config.js",
  "./js/firebase.js",
  "./js/store.js",
  "./js/export.js",
  "./js/seed.js",
  "./js/materiales.js",
  "./js/push.js",
  "./js/sso-erp.js",
  "./js/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* --------------------------------------------------------------- push ----
   Llega aunque la app esté cerrada. En iPhone solo si está agregada a la
   pantalla de inicio (lo exige iOS). El cuerpo lo arma el servidor. */

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data ? e.data.text() : "" }; }

  e.waitUntil(
    self.registration.showNotification(d.titulo || "Pedidos de Obra", {
      body: d.cuerpo || "",
      icon: "./assets/icons/icon-192.png",
      badge: "./assets/icons/icon-192.png",
      // Mismo tag: si llegan varios avisos del mismo pedido, se reemplazan
      // en vez de apilarse.
      tag: d.url || "pedidos-obra",
      renotify: true,
      data: { url: d.url || "./" }
    })
  );
});

/* Al tocar la notificación: si la app ya está abierta se la trae al frente
   (y se le avisa a dónde ir); si no, se abre. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || "./";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.includes(self.registration.scope)) {
          c.postMessage({ tipo: "abrir", url: destino });
          return c.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase / CDN: red directa

  // La API del ERP (el pase de entrada) nunca se cachea: un pase vencido
  // servido desde el cache haría fallar el login sin motivo.
  if (url.pathname.indexOf("/api/") === 0) return;

  // ¿Es parte del app shell? → cache-first (carga instantánea y offline).
  const base = new URL("./", self.location.href).pathname;
  const relativa = "." + url.pathname.slice(base.length - 1);
  const esShell = APP_SHELL.includes(relativa) || url.pathname === base;

  if (esShell) {
    e.respondWith(
      caches.match(req).then((cacheado) =>
        cacheado ||
        fetch(req).then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return resp;
        })
      )
    );
    return;
  }

  // Resto del mismo origen: network-first con respaldo en cache.
  e.respondWith(
    fetch(req).then((resp) => {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      return resp;
    }).catch(() =>
      caches.match(req).then((cacheado) =>
        cacheado || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
      )
    )
  );
});
