/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — config.js
   Configuración editable de la app (no requiere tocar el resto del código).
   ============================================================================ */

window.APP_CONFIG = {

  /* Versión visible en Perfil. Sirve para saber si un celular está corriendo
     la última versión o quedó con una cacheada. Subirla en cada deploy que
     toque HTML/CSS/JS, igual que el CACHE del service-worker.js. */
  VERSION: "v31",

  /* Códigos de invitación para crear cuenta. El código define el rol inicial:
     - "director" → director de obra: crea pedidos para SUS obras asignadas,
                    registra recepciones y sube fotos de remitos.
     - "admin"    → administración: ve todo, gestiona compras, obras, rubros,
                    proveedores y usuarios.
     - "control"  → solo lectura: ve todo, no modifica nada.
     Cambialos cuando quieras; el rol de cada usuario ya registrado lo
     administra el admin desde Gestión → Usuarios. */
  CODIGOS_INVITACION: {
    "DIRECTOR-ST": "director",
    "ADMIN-ST": "admin",
    "CONTROL-ST": "control"
  },

  /* Webhook de notificaciones (n8n → Evolution API / WhatsApp).
     Si está vacío no se envía nada. Cuando esté armado el workflow de n8n,
     pegá acá la URL del webhook: la app hace un POST fire-and-forget con
     JSON en cada transición de estado, con los destinatarios ya calculados
     según las preferencias de cada usuario (número de WhatsApp y avisos
     activados en su Perfil). */
  WEBHOOK_URL: "https://n8n.skyterra.com.ar/webhook/pedidos-obra-aviso",

  /* Clave compartida que viaja en el header x-app-key de cada aviso al
     webhook. La app es pública (GitHub Pages), así que esto NO es un
     secreto real — solo evita que un bot de internet dispare avisos por
     WhatsApp probando la URL a ciegas. El workflow de n8n valida esta
     misma clave antes de mandar cualquier mensaje. */
  WEBHOOK_KEY: "5c6c1988aee952715b4fc1c49ff83d52",

  /* Notificaciones push (las del celular, sin depender de WhatsApp).
     El envío lo hace un servicio propio en el VPS porque el navegador solo
     puede suscribirse: firmar y entregar requiere la clave privada VAPID,
     que vive allá. Esta de acá es la PÚBLICA — va en el cliente por diseño,
     no sirve para mandar nada por sí sola.
     En iPhone solo funciona con la app agregada a la pantalla de inicio
     (requisito de iOS, no nuestro). */
  PUSH_URL: "https://srv1795124.hstgr.cloud/push/enviar",
  VAPID_PUBLICA: "BH0jQwn6fVsAs2cSf8s_XrBU3q3RkAn73nRLCXwf3PEj48d8WPxRhdwY5REeOEhFgJmzcSzdvm-ev1E068l9EwI",

  /* Unidades sugeridas al cargar ítems (se puede escribir cualquier otra). */
  UNIDADES: ["un.", "m²", "m³", "kg", "bolsa", "pallet", "ml", "lts"],

  /* Rubros de Sky Terra, tal cual los definió Iván (2026-07-28). Son EXACTAMENTE
     estos: se sacaron "Materiales gruesos (corralón)" e "Hierros" que estaban
     antes. Los carga el botón de Gestión → Rubros; después se editan desde ahí. */
  RUBROS_DEFAULT: [
    "MATERIALES GRUESOS",
    "MADERAS",
    "ELECTRICIDAD",
    "HERRERIA",
    "SANITARIOS",
    "HORMIGONES",
    "VOLQUETES",
    "PINTURA",
    "REVESTIMIENTO",
    "PORCELANATOS",
    "ABERTURAS"
  ],

  /* Proveedores sugeridos por rubro (los pasó Iván). Aparecen como chips en
     Gestión → Proveedores para precargar nombre + rubro rápido; no crean
     nada hasta confirmar "Agregar proveedor". */
  PROVEEDORES_SUGERIDOS: [
    { nombre: "Newton", rubro: "MADERAS" },
    { nombre: "Aserradero Panamericano", rubro: "MADERAS" },
    { nombre: "Batezzatti", rubro: "ELECTRICIDAD" },
    { nombre: "Electro Norte", rubro: "ELECTRICIDAD" },
    { nombre: "Pelba", rubro: "ELECTRICIDAD" },
    { nombre: "Super Chapa", rubro: "HERRERIA" },
    { nombre: "Mundo Hierro", rubro: "HERRERIA" },
    { nombre: "Tubo Center", rubro: "HERRERIA" },
    { nombre: "CMP", rubro: "HERRERIA" },
    { nombre: "Sólido Herrajes", rubro: "HERRERIA" },
    { nombre: "Sanitario del Este", rubro: "SANITARIOS" },
    { nombre: "Hokama", rubro: "SANITARIOS" },
    { nombre: "Konecta", rubro: "SANITARIOS" },
    { nombre: "Ombú", rubro: "HORMIGONES" },
    { nombre: "Concret Vial", rubro: "HORMIGONES" },
    { nombre: "Cavalsa", rubro: "HORMIGONES" },
    { nombre: "Volquetes Nahuel", rubro: "VOLQUETES" },
    { nombre: "La Nueva Norte", rubro: "VOLQUETES" },
    { nombre: "El Mono", rubro: "VOLQUETES" },
    { nombre: "Pinturería del Plata", rubro: "PINTURA" },
    { nombre: "Quintex", rubro: "PINTURA" },
    { nombre: "Revesco", rubro: "REVESTIMIENTO" },
    { nombre: "Sebastián Gamarra", rubro: "REVESTIMIENTO" },
    { nombre: "Tarquini", rubro: "REVESTIMIENTO" },
    { nombre: "Protex", rubro: "REVESTIMIENTO" },
    { nombre: "Megaporcelanatos", rubro: "PORCELANATOS" },
    { nombre: "Decomármol", rubro: "PORCELANATOS" },
    { nombre: "San Jerónimo", rubro: "ABERTURAS" }
  ]
};
