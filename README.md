# Pedidos de Obra · Sky Terra

PWA mobile-first para el seguimiento de pedidos de materiales de obra:
el director de obra pide materiales desde el celular, administración gestiona
la compra y se registra la entrega en obra. Cada usuario se loguea con su
cuenta y ve lo suyo según su rol.

**Stack:** HTML/CSS/JS vanilla (sin build), Firebase Auth (email y contraseña)
y Firestore. Instalable como app en el celular (PWA).

---

## Cómo dejarla funcionando (una sola vez)

### 1. Crear el proyecto de Firebase

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com) y creá un proyecto (ej: `pedidos-obra-skyterra`). Google Analytics no hace falta.
2. **Authentication** → Comenzar → pestaña *Sign-in method* → habilitá **Correo electrónico/contraseña**.
3. **Firestore Database** → Crear base de datos → modo **producción** → región `southamerica-east1` (San Pablo) o la que prefieras.
4. En la portada del proyecto tocá el ícono **web `</>`** para registrar una app web (no hace falta Hosting). Copiá el bloque `firebaseConfig` que te muestra.

### 2. Pegar la configuración

Abrí `js/firebase-config.js` y reemplazá cada valor `REEMPLAZAR-...` por el
del bloque que copiaste (dejá las comillas). Mientras no lo hagas, la app
muestra la pantalla "Falta configurar Firebase".

### 3. Pegar las reglas de seguridad

En la consola: **Firestore Database → Reglas**, borrá lo que haya, pegá el
contenido completo del archivo `firestore.rules` y tocá **Publicar**.

### 4. Probar

Serví la carpeta con cualquier server estático, por ejemplo:

```
npx serve .
```

y abrí la URL que te da (o directamente el deploy cuando lo publiques).
La primera cuenta conviene crearla con el código de admin (ver abajo) para
poder cargar las obras.

---

## Cuentas y roles

Para crear cuenta se pide un **código de invitación** que define el rol:

| Código     | Rol                | Qué puede hacer |
|------------|--------------------|-----------------|
| `OBRA-ST`  | Dirección de obra  | Crear pedidos, registrar recepción, cancelar los suyos |
| `ADMIN-ST` | Administración     | Todo lo anterior + pasar pedidos a compra + crear/archivar obras |

Los códigos se cambian en `js/config.js`. El login queda persistente:
cada uno se loguea una vez en su celular y listo.

## Flujo de un pedido

```
solicitado ──(admin carga proveedor/OC)──► en_compra ──(llega todo)──► entregado
                                              │
                                              └──(llega una parte)──► entrega_parcial ──► entregado
cualquier estado abierto ──(solicitante o admin, con motivo)──► cancelado
```

- Los pedidos se numeran solos: P-0001, P-0002…
- Cada cambio queda en el historial del pedido (quién, cuándo, nota).
- Fotos por etapa (al pedir / en compra / en entrega), comprimidas en el
  dispositivo y guardadas en Firestore (no usa Firebase Storage).

## Notificaciones (opcional, para más adelante)

En `js/config.js` hay un campo `WEBHOOK_URL`. Cuando esté armado el workflow
de n8n (aviso por WhatsApp/mail), pegá ahí la URL del webhook: la app hace un
POST con JSON en cada cambio de estado, con este formato:

```json
{
  "evento": "en_compra",
  "pedido": { "numero": "P-0001", "obraCodigo": "MOL-1047", "estado": "en_compra",
              "solicitanteNombre": "…", "items": [ … ] },
  "usuario": "…",
  "ts": "2026-07-16T12:00:00.000Z"
}
```

Eventos posibles: `pedido_creado`, `en_compra`, `entrega_parcial`, `entregado`, `cancelado`.

## Estructura del proyecto

```
pedidos-obra/
├── index.html              Pantallas y modales (una sola página)
├── manifest.webmanifest    Manifiesto PWA (instalable)
├── service-worker.js       Cache offline (app shell)
├── firestore.rules         Reglas de seguridad (pegar en la consola)
├── css/estilos.css
├── js/
│   ├── config.js           Códigos de invitación, webhook, unidades  ← editable
│   ├── firebase-config.js  Claves de TU Firebase                     ← editable
│   ├── firebase.js         Conexión (Auth + Firestore)
│   ├── store.js            Lecturas/escrituras en Firestore
│   └── app.js              Toda la interfaz
└── assets/icons/           Iconos 192 y 512
```

## Deploy (cuando se decida)

La app usa rutas relativas en todo, así que funciona tal cual en un subpath
tipo `https://usuario.github.io/pedidos-obra/`. Basta con subir la carpeta.
Recordá sumar el dominio del deploy en Firebase: **Authentication →
Settings → Dominios autorizados**.
