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

**Commit:** pendiente de push al cierre de este ciclo.

---
