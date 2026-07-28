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
