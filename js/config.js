/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — config.js
   Configuración editable de la app (no requiere tocar el resto del código).
   ============================================================================ */

window.APP_CONFIG = {

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

  /* Unidades sugeridas al cargar ítems (se puede escribir cualquier otra). */
  UNIDADES: ["un.", "m²", "m³", "kg", "bolsa", "pallet", "ml", "lts"],

  /* Rubros que carga el botón "Cargar rubros por defecto" de
     Gestión → Rubros (después se editan libremente desde ahí). */
  RUBROS_DEFAULT: [
    "Electricidad",
    "Sanitarios",
    "Materiales gruesos (corralón)",
    "Hierros",
    "Pintura",
    "Herrería",
    "Maderas",
    "Hormigones",
    "Volquetes",
    "Revestimiento",
    "Porcelanatos",
    "Fletes",
    "Aberturas"
  ],

  /* Proveedores sugeridos por rubro (los pasó Iván). Aparecen como chips en
     Gestión → Proveedores para precargar nombre + rubro rápido; no crean
     nada hasta confirmar "Agregar proveedor". */
  PROVEEDORES_SUGERIDOS: [
    { nombre: "Newton", rubro: "Maderas" },
    { nombre: "Aserradero Panamericano", rubro: "Maderas" },
    { nombre: "Batezzatti", rubro: "Electricidad" },
    { nombre: "Electro Norte", rubro: "Electricidad" },
    { nombre: "Pelba", rubro: "Electricidad" },
    { nombre: "Super Chapa", rubro: "Herrería" },
    { nombre: "Mundo Hierro", rubro: "Herrería" },
    { nombre: "Tubo Center", rubro: "Herrería" },
    { nombre: "CMP", rubro: "Herrería" },
    { nombre: "Sólido Herrajes", rubro: "Herrería" },
    { nombre: "Sanitario del Este", rubro: "Sanitarios" },
    { nombre: "Hokama", rubro: "Sanitarios" },
    { nombre: "Konecta", rubro: "Sanitarios" },
    { nombre: "Ombú", rubro: "Hormigones" },
    { nombre: "Concret Vial", rubro: "Hormigones" },
    { nombre: "Cavalsa", rubro: "Hormigones" },
    { nombre: "Volquetes Nahuel", rubro: "Volquetes" },
    { nombre: "La Nueva Norte", rubro: "Volquetes" },
    { nombre: "El Mono", rubro: "Volquetes" },
    { nombre: "Pinturería del Plata", rubro: "Pintura" },
    { nombre: "Quintex", rubro: "Pintura" },
    { nombre: "Revesco", rubro: "Revestimiento" },
    { nombre: "Sebastián Gamarra", rubro: "Revestimiento" },
    { nombre: "Tarquini", rubro: "Revestimiento" },
    { nombre: "Protex", rubro: "Revestimiento" },
    { nombre: "Megaporcelanatos", rubro: "Porcelanatos" },
    { nombre: "Decomármol", rubro: "Porcelanatos" },
    { nombre: "San Jerónimo", rubro: "Aberturas" }
  ]
};
