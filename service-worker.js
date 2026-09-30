/* La app de Pedidos se cerró el 30-sep-2026 (los pedidos se hacen desde Obra).
 *
 * Este service worker REEMPLAZA al de la app (pedidos-obra-v73). Los celulares con la app
 * instalada lo reciben solos: la app vieja busca versión nueva al abrirse y al volver al
 * frente, y se recarga cuando cambia (ver el index.html de la v73). Al activarse:
 *   · borra lo que la app guardó (solo sus cachés, «pedidos-obra-*»),
 *   · toma el control, y con eso la app vieja se recarga desde la red: ahora es la
 *     página que avisa del cierre y lleva a Obra,
 *   · se da de baja: ya no hay nada que atender sin conexión.
 * Sin manejador de fetch: todo va a la red.
 */
self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    const claves = await caches.keys();
    await Promise.all(claves.filter(function (k) { return k.indexOf("pedidos-obra") === 0; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
    const ventanas = await self.clients.matchAll({ type: "window" });
    for (const v of ventanas) { try { await v.navigate(self.registration.scope); } catch (err) {} }
    await self.registration.unregister();
  })());
});
