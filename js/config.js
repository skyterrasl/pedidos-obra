/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — config.js
   Configuración editable de la app (no requiere tocar el resto del código).
   ============================================================================ */

window.APP_CONFIG = {

  /* Versión visible en Perfil. Sirve para saber si un celular está corriendo
     la última versión o quedó con una cacheada. Subirla en cada deploy que
     toque HTML/CSS/JS, igual que el CACHE del service-worker.js. */
  VERSION: "v46",

  /* Registro abierto: APAGADO a propósito (vacío = nadie puede autoregistrarse).

     Esto se sirve desde un repo público, así que un código acá es un código
     que puede leer cualquiera — y con "admin" se veía toda la operación.
     Hoy se entra por dos puertas mejores:
       · con el usuario de Gestión (gestion.skyterra.com.ar/pedidos/), o
       · con la cuenta que le crea administración desde Gestión → Usuarios.

     Para reabrirlo temporalmente (por ejemplo, para dar de alta a mucha gente
     de golpe), poner acá códigos NUEVOS y sacarlos cuando termines:
       "ALGO-QUE-NADIE-ADIVINE": "director" */
  CODIGOS_INVITACION: {},

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

  /* Código de cada rubro para numerar sus pedidos: ELE-0001, MG-0002.
     Cada rubro lleva su propia serie, así el número dice de qué es el pedido
     sin abrirlo. El código se edita por rubro desde Gestión; esto es solo la
     sugerencia inicial. Para un rubro sin código se usan las primeras tres
     letras del nombre. */
  CODIGOS_RUBRO: {
    "MATERIALES GRUESOS": "MG",
    "MADERAS": "MAD",
    "ELECTRICIDAD": "ELE",
    "HERRERIA": "HER",
    "SANITARIOS": "SAN",
    "HORMIGONES": "HOR",
    "VOLQUETES": "VOL",
    "PINTURA": "PIN",
    "REVESTIMIENTO": "REV",
    "PORCELANATOS": "POR",
    "ABERTURAS": "ABE"
  },

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
