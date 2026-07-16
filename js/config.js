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
  WEBHOOK_URL: "",

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
    "Herrería"
  ]
};
