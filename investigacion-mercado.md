# Investigación de mercado — Software de pedidos de materiales para construcción

**Fecha:** 2026-07-16 · **Para:** app interna "Pedidos de Obra" de Sky Terra
**Método:** deep-research con 24 fuentes (documentación oficial de producto, reviews verificadas de Capterra/G2, guías del rubro). Las afirmaciones de páginas de producto son auto-reportadas por los vendors; las 3 marcadas ✓ pasaron verificación adversaria completa.

---

## 1. El flujo canónico de la industria

Todos los líderes (Kojo, Trimble Materials ex-StructShare, Field Materials, Iconstruye, Odoo) modelan el mismo circuito de punta a punta:

```
Requisición desde obra → [Cotización/RFQ comparativa — opcional] → Aprobación
→ Orden de compra → Envío al proveedor → [Acuse del proveedor]
→ Entrega(s) parcial(es) → Recepción con foto del remito ✓
→ Matching de factura (2 o 3 vías: OC / remito / factura) ✓ → Cierre
```

- **Recepción con foto del remito es el estándar absoluto** (Kojo lo documenta textual: "Receive material at jobsite by marking as received and uploading packing slip" ✓). Nuestra spec ya lo cumple.
- **Las entregas parciales son caso de primera clase** en todos: Iconstruye "registra en línea la recepción parcial o total", Odoo genera facturas por cantidades efectivamente recibidas, Field Materials trackea múltiples tipos de remito por OC. Nuestra spec ya lo cumple.
- **El circuito no termina en la entrega**: los líderes cierran con matching OC ↔ remito ↔ factura ✓ (control de pago: no pagar lo que no llegó). Odoo usa un flag de excepción de 3 estados ("Should Be Paid": Yes/Exception/No). **Nuestra spec corta en la entrega — es la extensión natural futura**, conectable con el tabulador de facturas ya construido en 04-administracion.
- **Roles por tramo** ✓: Kojo separa Field (pide y recibe), Purchasing (compra), Approver, AP (facturas). Nuestro esquema director/admin/control es una versión reducida y correcta para el tamaño de Sky Terra.
- Iconstruye agrega **cuadros comparativos de cotizaciones** entre proveedores y **flujos de aprobación configurables** antes de la OC; también documenta **rechazos de material** en la recepción.

## 2. Qué valoran los usuarios reales (reviews verificadas)

- **Que el campo realmente la use**: "It groups everything together easily and the field actually uses it" (StructShare, G2). Es el elogio más repetido y el factor decisivo.
- **Vista única del ciclo contra presupuesto**: "track material planning, procurement, receiving, invoicing in one view... against budget" (StructShare, G2).
- **Velocidad de carga**: Field Materials reporta OCs de 30 min → 2 min; ciclo de compra de 1 semana → 1 día (casos del vendor).
- **Simplicidad que reemplaza planillas**: lo mejor de LiveCosts según su único reviewer es que "elimina las planillas complicadas y organiza todo en un solo lugar por obra".
- **Fotos con fecha/hora/ubicación automáticas** (Buildertrend, Capterra 4.5/5 con 2.486 reviews).
- **Historial consultable de cada pedido** y **notificaciones push de cambio de estado** (Kojo).

## 3. Quejas y errores conocidos a evitar

| Queja real | Fuente | Lección para nuestra app |
|---|---|---|
| UI tosca en mobile, "confusa y abrumadora al principio" | Buildertrend (Capterra) | Menos features visibles, no más |
| Reportes/exportación débiles, requiere workarounds | LiveCosts (G2) | Nuestra export xlsx del listado filtrado ya lo cubre |
| Lock-in: imposible descargar años de fotos y datos al irse | Buildertrend (Capterra) | Datos nuestros en Firestore + export = ventaja del build propio |
| Bugs de consistencia al pasar de estado en estado | StructShare (G2, 3.5/5) | El historial + transiciones validadas en rules son críticos |
| IA inconsistente leyendo fotos (vs PDF) | Field Materials (Capterra) | Si sumamos IA de remitos, siempre con confirmación humana |
| Onboarding de usuarios de campo difícil | Field Materials (Capterra) | Ver reglas de adopción abajo |

## 4. Reglas de adopción en obra (el punto más crítico)

El patrón WhatsApp que queremos reemplazar falla de formas documentadas: pedidos duplicados (pedido del lunes sin respuesta → segunda orden el miércoles), aprobaciones en hilos de chat sin registro, y todo con el mismo peso visual (una foto cualquiera tapa un pedido urgente). Pero las apps también fracasan si generan más fricción que el chat:

1. **Regla de los 60 segundos**: si cargar un pedido tarda más de 60 s, la app pierde contra WhatsApp. Siempre.
2. **Regla de los 3 taps**: cualquier función central a ≤3 taps de abrir la app; botones operables con guantes; legible a pleno sol.
3. **Offline obligatorio** con sincronización automática, sin botón "sincronizar" (ya lo tenemos con Firestore).
4. **Capacitación mínima**: mostrar solo las 2–3 funciones de uso diario; si hacen falta varias sesiones de capacitación, el problema es el diseño.
5. **Rollout por fases con campeón**: piloto en UNA obra con el director más canchero con la tecnología, que después entrena a los demás (los de campo le creen más a otro de campo que a la oficina). Papel/WhatsApp en paralelo las primeras 2 semanas. Meta: 90% de uso diario a las 6 semanas.
6. Barreras típicas (encuesta Deloitte): 48% costo de capacitación, 45% costos operativos. Una app interna gratis y de 3 pantallas esquiva ambas.

## 5. Patrones UX probados para copiar (priorizados valor/esfuerzo)

| # | Feature | Evidencia | Valor | Esfuerzo | Cuándo |
|---|---|---|---|---|---|
| 1 | **Materiales frecuentes + repetir pedido** (sugerencias desde el historial, botón "duplicar pedido") | Trade Hounds "Frequently Purchased Materials"; Kojo arma pedidos desde listas predefinidas, no texto libre | Alto — ataca la regla de los 60 s | Bajo | v1 |
| 2 | **Incidencias predefinidas en recepción** (dañado / llegó de más / cantidad errónea / otro) en vez de texto libre | Field Materials | Alto | Bajo | v1 |
| 3 | **Alerta automática de pedido atrasado** (fecha estimada vencida sin recepción → aviso push/WhatsApp, no solo dashboard) | StructShare "past-due alerts" | Alto | Bajo (cron n8n) | junto con WhatsApp |
| 4 | **Plantillas de pedido** por tipo de trabajo (guardar pedido como plantilla) | Home Depot "starter templates" | Medio | Bajo | v1.1 |
| 5 | **Pedido por voz o foto de lista manuscrita → IA lo estructura, humano confirma** | Trade Hounds (4 vías de carga), Field Materials, Home Depot Material List Builder AI (ene-2026) | Alto | Medio (Gemini vía n8n, gratis) | v2 |
| 6 | **Matching remito ↔ factura** (3 vías) | Kojo ✓, Odoo, Field Materials, Trimble | Medio | Medio (conectar tabulador-facturas) | v2 |
| 7 | Foto de remito → IA lee y precarga cantidades recibidas | Field Materials | Medio | Medio | v2 |
| 8 | Cotización/comparativa entre proveedores | Iconstruye, Trimble RFQ | Medio | Alto | v3 (si crece el volumen) |
| 9 | Control contra presupuesto de obra | StructShare (lo más valorado del reviewer) | Medio | Alto | v3 (conectar con planillas) |
| 10 | Aprobaciones con umbral por monto (ej. >USD 1.000 aprueba otro rol) | Field Materials | Bajo (equipo chico) | Medio | no por ahora |

## 6. Precios de referencia (validación del build propio)

| Herramienta | Precio | Nota |
|---|---|---|
| Edify (Argentina) | Gratis básico; ARS 7.999–9.999/mes pago | Enfocada en cotizaciones/marketplace, no en el circuito interno completo |
| BrickControl | USD 128–388/mes por plan (+USD 64–90 por usuario extra); las OC recién desde el plan medio | Para ~5 usuarios: cientos de USD/mes |
| Field Materials | USD 599/mes | Sólo EE.UU. en la práctica |
| Buildertrend | ~USD 2.400/año (referencias de reviews) | Quejas de precio y lock-in |
| Iconstruye, Kojo, Trimble Materials | Sin precio público (cotización/demo) | Iconstruye: referencia ~8 UF/mes (~USD 300+); dominante en Chile (+70% de constructoras según el vendor) |
| **Nuestra app (Firebase + GitHub Pages)** | **USD 0/mes** | Sin lock-in, datos propios, exportables |

**Conclusión copiar vs contratar:** para un equipo de 4–6 usuarios, las opciones contratables serias arrancan en USD 100–600/mes, están sobredimensionadas (RFQ, inventario, AP) y las locales (Edify) no cubren el circuito interno pedido→compra→recepción. El build propio se paga solo; lo que hay que copiarles no es el software sino los **patrones** de la tabla del punto 5 y las **reglas de adopción** del punto 4.

---

## Fuentes principales

- [Kojo Procurement Process Workflow Map](https://support.usekojo.com/hc/en-us/articles/40532006481427-Kojo-Procurement-Process-Workflow-Map) (oficial) · [Kojo Jobsite](https://usekojo.com/solutions/jobsite)
- [Trimble Materials](https://www.trimble.com/en/products/trimble-materials) · [StructShare en G2](https://www.g2.com/products/structshare/reviews) y [Capterra](https://www.capterra.com/p/204232/StructShare/)
- [Field Materials — PO Software](https://www.fieldmaterials.com/platform/construction-purchase-order-software) · [Material Tracking](https://www.fieldmaterials.com/platform/construction-material-tracking-software) · [Field Materials en Capterra](https://www.capterra.com/p/10015611/Field-Materials/)
- [Iconstruye — Gestión de compras](https://www.iconstruye.com/abastecimiento-y-logistica/gestion-de-compras/)
- [Odoo — 3-way matching](https://www.odoo.com/documentation/16.0/purchase/purchases/rfq/3_way_matching.html)
- [Edify](https://edify.la/) · [BrickControl — precios](https://www.brickcontrol.com/prices/)
- [Buildertrend en Capterra](https://www.capterra.com/p/70092/Buildertrend/reviews/) · [LiveCosts en G2](https://www.g2.com/products/livecosts/reviews)
- [Onsite Teams — WhatsApp construction management](https://onsiteteams.com/whatsapp-construction-management/) · [Projul — field guide](https://projul.com/blog/construction-mobile-app-field-guide/) · [Fieldwire blog](https://www.fieldwire.com/blog/construction-task-management-software/) · [TrueLook — adopción](https://www.truelook.com/blog/construction-technology-slow-in-adoption-how-do-we-bridge-the-gap) · [Home Depot — Material List Builder AI](https://corporate.homedepot.com/news/company/home-depot-launches-ai-powered-material-lists-help-pros-save-time-building-complete) · [Trade Hounds — AI material ordering](https://www.tradehounds.com/free-ai-material-ordering)
