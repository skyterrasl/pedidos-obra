# Pedidos de Obra · Sky Terra

PWA mobile-first para el seguimiento de pedidos de materiales de obra:
el director de obra pide materiales desde el celular, administración los
recibe, los pide al proveedor, y en obra se registran las recepciones
(parciales o completas) con fotos de remito. Cada usuario entra con su
cuenta y ve/hace lo que su rol le permite.

**Stack:** HTML/CSS/JS vanilla (sin build), Firebase Auth (email y contraseña)
y Firestore. Instalable como app en el celular (PWA), funciona con mala señal.

---

## Cómo dejarla funcionando (una sola vez)

1. **Crear el proyecto de Firebase**: [console.firebase.google.com](https://console.firebase.google.com)
   → nuevo proyecto (ej: `pedidos-obra-skyterra`), sin Analytics.
2. **Authentication** → Comenzar → *Sign-in method* → habilitar
   **Correo electrónico/contraseña**.
3. **Firestore Database** → Crear base de datos → modo **producción** →
   región `southamerica-east1` (San Pablo).
4. En la portada del proyecto, ícono **web `</>`** → registrar app web
   (sin Hosting) → copiar el bloque `firebaseConfig`.
5. Pegar esos valores en `js/firebase-config.js` (reemplazar cada
   `REEMPLAZAR-...`). Mientras no se haga, la app muestra la pantalla
   "Falta configurar Firebase".
6. **Firestore → Reglas**: pegar el contenido completo de `firestore.rules`
   y **Publicar**. Sin este paso los permisos por rol no existen.
7. Servir la carpeta con cualquier server estático (`npx serve .`) o subirla
   al hosting que se decida. Rutas relativas: funciona en un subpath tipo
   `https://usuario.github.io/pedidos-obra/`. Al deployar, sumar el dominio en
   **Authentication → Settings → Dominios autorizados**.

### Primeros pasos dentro de la app

1. Crear la primera cuenta con el código `ADMIN-ST` (rol administración).
2. En el Dashboard vacío aparece **"Cargar datos de ejemplo"** (3 obras,
   6 rubros, 2 proveedores y 10 pedidos de muestra) para probar todo.
   Para arrancar en serio: **Gestión** → cargar Obras, Rubros (hay botón de
   rubros por defecto) y Proveedores.
3. Los demás se registran solos con su código (ver tabla) y el admin les
   asigna obras desde **Gestión → Obras**.

> **Usuarios de prueba:** no se pueden crear desde el seed — Firebase Auth
> (lado cliente) no permite crear otras cuentas sin desloguearse. Se crean
> a mano registrándose con cada código de invitación.

## Roles y códigos de invitación

| Código        | Rol       | Qué puede hacer |
|---------------|-----------|-----------------|
| `DIRECTOR-ST` | director  | Crear pedidos **solo en sus obras asignadas**, guardar borradores, registrar recepciones con fotos de remito, cancelar sus pedidos |
| `ADMIN-ST`    | admin     | Ver todo; marcar **recibido** y **pedido al proveedor**; ABM de obras, rubros, proveedores y usuarios (rol, activo, asignación de directores) |
| `CONTROL-ST`  | control   | **Solo lectura** de todo (pedidos, historial, remitos). No crea ni modifica nada — reforzado en las reglas del servidor |

Los códigos se cambian en `js/config.js`. El rol posterior lo administra el
admin (Gestión → Usuarios); nadie puede cambiarse su propio rol, ni siquiera
el admin (regla del servidor). El login queda persistente en el dispositivo.

## Flujo de un pedido

```
borrador ──(director lo envía)──► enviado ──(admin)──► recibido ──(admin +
   proveedor/fecha/OC)──► pedido_proveedor ──(recepciones en obra)──►
   entrega_parcial (una o varias) ──► entregado

enviado / recibido / pedido_proveedor / entrega_parcial
   ──(admin o el director del pedido, con motivo)──► cancelado
```

- Numeración automática P-0001, P-0002… (el borrador recibe número al enviarse).
- **Un pedido = un rubro** (electricidad y corralón → dos pedidos).
- Prioridad normal/urgente; el Dashboard resalta urgentes y **atrasados**
  (fecha estimada del proveedor vencida sin recepción completa).
- Cada transición queda en el historial (fecha, hora, usuario, nota).
- Recepciones: varias por pedido, con fotos de remito (JPG/PNG comprimidos en
  el dispositivo; PDF aceptado si pesa < 700 KB) y una **incidencia**
  predefinida opcional (llegó dañado / de más / equivocado / otro).
- Atajos de carga: el material se autocompleta con lo ya pedido en la misma
  obra/rubro, y todo pedido se puede **duplicar** desde su detalle.
- El formulario de nuevo pedido se autoguarda en el dispositivo: si se corta
  la señal o se cierra la app, no se pierde lo cargado.

## Notificaciones

- **Campana in-app** (todos los roles): contador de no leídas; tocar una abre
  el pedido. Matriz: pedido enviado / recepciones → avisan a administración;
  recibido / pedido al proveedor → avisan al director del pedido; cancelado →
  avisa a la contraparte.
- **WhatsApp** (vía la Evolution API que ya corre en el VPS): la app NO habla
  con WhatsApp directo. Hace un POST (fire-and-forget) al `WEBHOOK_URL` de
  `js/config.js` — un workflow de n8n rutea el mensaje. La app ya manda los
  destinatarios calculados según el Perfil de cada usuario (número de
  WhatsApp + toggles por tipo de aviso). Payload:

```json
{
  "evento": "pedido_proveedor",
  "pedido": { "numero": "P-0006", "obraNombre": "SAN-118 · Santa Elena",
              "rubro": "Electricidad", "prioridad": "normal",
              "estado": "pedido_proveedor", "fechaEstimada": "2026-07-19" },
  "destinatarios": [ { "whatsapp": "5491122334455", "nombre": "Jorge Paz" } ],
  "usuario": "Macarena Diaz",
  "ts": "2026-07-16T15:00:00.000Z"
}
```

Eventos: `enviado`, `recibido`, `pedido_proveedor`, `entrega_parcial`,
`entregado`, `cancelado`.

## Export

En el listado, el botón **Exportar** baja lo filtrado a `.xlsx` (SheetJS por
CDN; si no carga, cae a CSV que Excel abre igual). Columnas: número, obra,
rubro, estado, prioridad, solicitante, creado, fecha necesaria, proveedor,
fecha estimada, ítems y % recibido.

## Modelo de datos (el "relacional" mapeado a Firestore)

La spec pedía una base relacional con permisos del lado del servidor. Se
cumple así: cada tabla es una colección, las FK son ids de documento +
campos denormalizados para listar rápido, y el enforcement server-side son
las **reglas de Firestore** (`firestore.rules`), que Firebase aplica en su
servidor en cada operación — el cliente no puede saltearlas.

| Tabla relacional  | En Firestore |
|-------------------|--------------|
| usuarios          | `usuarios/{uid}` → nombre, email, rol, activo, whatsapp, avisos{4 toggles} |
| notificaciones    | `usuarios/{uid}/notificaciones/{id}` → texto, pedidoId, leida, ts |
| obras             | `obras/{id}` → nombre, direccion, cliente, estado (activa/pausada/finalizada), directores[uid] |
| rubros            | `rubros/{id}` → nombre |
| proveedores       | `proveedores/{id}` → nombre, rubros[], telefono, observaciones |
| pedidos           | `pedidos/{id}` → numero, obraId (FK) + obraNombre, rubro, solicitanteUid (FK) + solicitanteNombre, creado, prioridad, fechaNecesaria, estado, observaciones, items[{descripcion, cantidad, unidad, recibido}], proveedor{nombre, fechaEstimada, oc, observaciones, usuarioNombre, ts}, historial[{accion, usuarioNombre, ts, nota}] |
| recepciones       | `pedidos/{id}/recepciones/{rid}` → items[{idx, descripcion, cantidad}], usuarioNombre, ts, nota, incidencia |
| fotos de remito   | `pedidos/{id}/fotos/{fid}` → base64, tipo (imagen/pdf), recepcionId (FK), usuarioNombre, ts |
| secuencia números | `contadores/pedidos` → ultimo (transacción al enviar) |

Las fotos van como base64 dentro de Firestore (comprimidas a < 700 KB) para
no depender de Firebase Storage, que exige plan pago en proyectos nuevos.

## Desviaciones respecto de la spec original (ya decididas)

1. **Firestore en lugar de base relacional**: mapeo de arriba; las reglas de
   Firestore son el enforcement server-side de los permisos por rol.
2. **WhatsApp por Evolution API + n8n en lugar de Twilio/Meta**: ya está paga
   y andando en el VPS; la app solo dispara el webhook con los destinatarios
   calculados.
3. **Alta de usuarios por código de invitación** + gestión posterior del
   admin (rol, activo, obras), en lugar de alta directa por el admin: el SDK
   web de Firebase no permite crear cuentas de terceros sin desloguear al
   admin.

## Estructura del proyecto

```
pedidos-obra/
├── index.html              Pantallas y modales (una sola página)
├── manifest.webmanifest    Manifiesto PWA (instalable)
├── service-worker.js       Cache offline del app shell
├── firestore.rules         Reglas de seguridad (pegar en la consola)
├── css/estilos.css
├── js/
│   ├── config.js           Códigos de invitación, webhook, unidades, rubros ← editable
│   ├── firebase-config.js  Claves de TU Firebase                            ← editable
│   ├── firebase.js         Conexión (Auth + Firestore, offline)
│   ├── store.js            Lecturas/escrituras + notificaciones
│   ├── export.js           Export a xlsx/CSV
│   ├── seed.js             Datos de ejemplo
│   └── app.js              Toda la interfaz
└── assets/icons/           Iconos 192 y 512
```
