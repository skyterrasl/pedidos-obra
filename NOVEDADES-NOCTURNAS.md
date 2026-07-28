# Novedades nocturnas — loop autónomo

Trabajo hecho en autónomo mientras dormías, en ciclos: investigar → auditar el código
con la lente "gente de obra" → mejorar algo concreto y chico → verificar (sintaxis +
captura visual mobile) → commitear y pushear → anotar acá. Nada se hizo sin verificar
antes de subirlo.

**No toqué**: `firestore.rules` (cambios de seguridad quedan para que los apruebes vos),
el dominio propio (sigue apagado esperando el certificado de GitHub, lo reintento solo
si veo que ya está listo), ni la base de Firebase real (nada de datos de producción).

---

## Resumen ejecutivo (léelo primero)

_Se va completando a medida que avanza la noche — el resumen final queda acá arriba._

---

## Ciclo 1 — Dashboard: "Pendientes por obra"

**Qué se investigó:** Fieldwire y Buildertrend confirman el patrón mobile-first de
campo (drawings, tareas, fotos, tiempo real), pero lo más relevante salió de otra
búsqueda: Projul y Costryx (software de compras/PO de EE.UU.) muestran "qué entregas
faltan y de qué obra son" en una sola pantalla al abrir la app a la mañana — exactamente
lo que pediste vos mismo ("un dashboard de los pedidos que quedan, de qué obras son").

**Qué se hizo:** En el Dashboard (pantalla Inicio), debajo de los avisos de Atrasados/
Urgentes y arriba de las tarjetas por estado, se agregó un bloque **"Pendientes por
obra"**: una fila por cada obra con algo abierto (enviado/recibido/pedido al proveedor/
entrega parcial), mostrando cuántos pedidos tiene pendientes y, si corresponde, cuántos
atrasados en rojo. Se ordena primero por atrasados, después por cantidad — así lo más
urgente queda arriba sin tener que interpretar nada. Tocar una fila lleva directo al
listado de esa obra (mismo patrón que ya usaban las tarjetas de estado).

Solo aparece cuando el filtro está en "Todas las obras" y hay más de una obra con algo
pendiente — si no, sería la misma información repetida.

**Verificación:** sintaxis (`node --check`) ok. Captura visual en mobile (390×844) con
datos simulados — buen contraste, número de atrasados legible en rojo, filas con altura
cómoda para tocar con guantes, no rompe el resto del dashboard. Screenshot en
`_capturas/dashboard-por-obra.png`.

**Commit:** `b6c2eb6` — pusheado.

---

## Ciclo 2 — Instalación como app real en iPhone/Android

**Qué se auditó:** el manifest y el `<head>` de `index.html` contra los requisitos reales
de instalación de iOS Safari (que es lo que usás vos) y Android Chrome.

**Qué se encontró:** el ícono maskable ya estaba bien hecho de entrada (fondo sólido a
sangre completa, sin riesgo de que se recorte mal en ningún launcher) — eso no hacía
falta tocarlo. Pero **faltaban las etiquetas que iOS Safari necesita para instalar la
app "de verdad"**: sin ellas, al agregarla a la pantalla de inicio de un iPhone, se abre
igual pero *adentro de Safari* (con la barra de direcciones arriba), no a pantalla
completa como una app instalada. Android/Chrome sí lo resuelve solo con el manifest, pero
iOS necesita sus propias meta-etiquetas aparte.

**Qué se hizo:**
- Agregadas las 4 etiquetas de iOS (`apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`,
  `mobile-web-app-capable`) — con esto, la próxima vez que alguien agregue la app a la
  pantalla de inicio (o la saque y la vuelva a agregar si ya la tenía), abre a pantalla
  completa, sin la barra de Safari.
- Antes de agregarlas confirmé que el `topbar` ya tiene `padding-top` con
  `env(safe-area-inset-top)` — es decir, el header no se va a esconder atrás del notch/
  Dynamic Island del iPhone al pasar a pantalla completa. Si no lo hubiera tenido, agregar
  estas etiquetas sin ese padding hubiera tapado el header — no era el caso, ya estaba
  bien resuelto.
- Sumado el campo `"id"` al manifest (buena práctica para que el navegador identifique la
  instalación de forma estable entre actualizaciones).

**Ojo con esto (importante):** este cambio **solo se nota si desinstalás/reinstalás el
ícono** de la pantalla de inicio (o lo instalás por primera vez) — un ícono que ya
tenías agregado de antes no cambia de golpe solo. Cuando quieras probarlo: borrá el
ícono actual de "Pedidos de Obra" de tu pantalla de inicio, entrá de nuevo por Safari a
la app, y volvé a agregarla ("Compartir" → "Agregar a inicio").

**Verificación:** manifest válido (JSON parseado ok), `index.html` carga sin errores de
consola (0 errores). Lo que no se puede verificar con Playwright (es Chromium, no Safari
real) es el comportamiento de pantalla completa en iOS — eso solo se ve reinstalando el
ícono en un iPhone de verdad.

**Commit:** `09e8ff6` — pusheado.

---

## Ciclo 3 — Aviso de "sin conexión"

**Qué se investigó:** patrones de offline-first 2026 para apps de campo. El hallazgo
clave: *"un indicador sutil funciona mejor que un banner de alarma — un ícono chico de
'sincronizando' o una etiqueta discreta de 'pendientes'; el estado de sincronización
escondido es lo que rompe la confianza en la app"*. O sea: no hay que asustar, hay que
avisar tranquilo que el trabajo está guardado.

**Qué se encontró auditando:** la app ya tenía resuelta la parte difícil (persistencia
offline de Firestore + autoguardado del formulario en localStorage), pero **no había
ningún indicador visual** de que no hay señal. Si a un director se le corta la conexión
en medio de un pedido, la app se veía exactamente igual que con señal — nada le avisaba
que su pedido todavía no había salido, lo cual invita a mandarlo de nuevo por WhatsApp
"por las dudas" (justo el problema que esta app viene a resolver).

**Qué se hizo:** un banner angosto y calmo (color ámbar, no rojo de alarma) arriba de
toda la pantalla que dice *"Sin conexión — lo que cargues se guarda y sincroniza solo
apenas vuelva la señal"*, que aparece y desaparece solo escuchando los eventos
`online`/`offline` del navegador. Es independiente de Firebase (se ve incluso en la
pantalla de login), y no depende de tocar la base de datos para nada.

**Verificación:** corté la señal de verdad con Playwright (`context.setOffline(true)`)
sobre el `index.html` real — el banner aparece, capturas antes/durante/después
confirman que no tapa ni desplaza mal ningún otro elemento (el header y las tarjetas se
corren prolijo hacia abajo mientras está el aviso, y vuelven a su lugar solo al
reconectar). Cero errores de consola en los tres estados.

**Nota de seguridad para mí mismo (dejo constancia):** el `js/firebase-config.js` local
de este proyecto tiene las credenciales REALES de producción pegadas (las cargó Iván
hace unos días) — no es un placeholder. Para probar esto tuve cuidado de solo mirar/
interactuar con el DOM sin tocar ningún botón que dispare login, registro o escritura;
sigo con ese cuidado el resto de la noche.

**Commit:** `4bb6c9b` — pusheado.

---

## Ciclo 4 — Auditoría sistemática de tamaños táctiles

**Qué se investigó:** el estándar real de tamaño mínimo táctil — iOS pide 44pt, Android
(Material Design) pide 48dp. Para cubrir los dos sistemas (la app la usan celulares
mixtos) conviene apuntar a 48px como piso.

**Qué se encontró auditando:** ya se habían corregido casos puntuales en ciclos
anteriores de la sesión (auto-selección de obra, fecha por defecto, botón "Quitar"
material a 44px), pero al revisar el CSS completo aparecieron **varios elementos de uso
frecuente por debajo del estándar**, algunos bastante:
- **La campana de notificaciones**: 40×36px — la más grave, porque está en el header de
  TODAS las pantallas y la usa cualquier rol.
- **"‹ Volver"**: ~33px de alto — se toca todo el tiempo al salir de un detalle.
- **Los chips de filtro** (estado en el listado, y los que se agregaron esta sesión para
  cargar obras/proveedores sugeridos): ~34px de alto — se tocan seguido al filtrar.

Quedaron **documentados pero sin tocar todavía** (por priorizar 1-3 cambios de bajo
riesgo por ciclo, no un rediseño grande): los botones "Editar/Borrar" de Gestión
(~34px), las pestañas de Gestión (Obras/Rubros/Proveedores/Usuarios, ~38px), los
selects chicos de filtros (~37px) y el segmentado Normal/Urgente (~41px, muy cerca ya).
Ninguno es gravísimo y todos son de pantallas más de oficina que de campo — quedan para
un ciclo futuro si hace falta.

**Qué se hizo:** campana → 48×48px; "Volver" y chips → `min-height: 44px` con
`display: inline-flex; align-items: center` para que el contenido quede bien
centrado con el alto nuevo.

**Verificación:** medí el tamaño REAL renderizado con Playwright (no solo cálculo a
ojo): campana 48×48px, Volver 44px de alto, chip 44px de alto — los tres dentro del
estándar. Capturé también una vista conjunta para chequear que no se vea desproporcionado
(`_capturas/touch-targets-ciclo4.png`) — se ve prolijo. De paso confirmé que un detalle
que pareció un bug (número pegado al texto en el chip) era solo de mi HTML de prueba,
no del código real (que sí tiene el espacio).

**Commit:** `d6bd08f` — pusheado.

---

## A pedido directo de Iván (fuera del loop, en vivo) — obras reales + estado "por comenzar" + materiales de ejemplo

Iván estaba despierto chequeando el progreso y pidió esto directamente, no fue una
mejora que se me ocurrió sola. Quedó documentado igual porque es un cambio real.

**Obras reales:** pidió que el desplegable de obra muestre las obras "activas y por
comenzar" de su planilla ("Caja y operación" / Ingresos SKY, columna CENTRO). El link
que tenía guardado de esa planilla ya no resolvía (conector de Drive en otra cuenta que
la que tiene acceso); en vez de adivinar, le pregunté y me pasó la lista real a mano (30
obras, código CENTRO + activa/por comenzar). Reemplacé la lista de sugerencias vieja
(la que había sacado del chat de WhatsApp, mucho menos precisa) por esta.
**Instrucción explícita de Iván: los códigos van tal cual, sin agregarles nombre de
barrio ni nada** — así quedó.

**Estado "por comenzar":** el modelo de obras solo tenía activa/pausada/finalizada.
Sumé un cuarto estado `por_comenzar` (con su propia etiqueta, sin verse "apagado" como
pausada/finalizada) y actualicé el desplegable de "Nuevo pedido" para que muestre
obras activas Y por comenzar — así se puede ir cargando pedidos antes de que arranque
la obra, que era el pedido concreto.

**Materiales de ejemplo por rubro:** pidió lo mismo que con las obras pero para
materiales — nomenclatura real del chat de WhatsApp, uno de cada rubro. Fui al chat y
saqué un ejemplo genuino por rubro (12 de 13 — Revestimiento no tiene un ejemplo propio
en el chat, solo aparece mezclado con Porcelanatos, así que lo dejé afuera en vez de
inventar uno). Se usan como base del autocompletado de materiales en Nuevo pedido
cuando todavía no hay historial propio de esa obra/rubro.

**Verificación:** sintaxis ok, capturas visuales del formulario de obra con los 4
estados y la lista con "Por comenzar" sin apagar. Todo queda como sugerencia — no se
escribió nada en la base de Firebase real, Iván lo carga con el botón cuando quiera.

**Commit:** `65354dd` — pusheado.

---
