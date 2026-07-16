/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — config.js
   Configuración editable de la app (no requiere tocar el resto del código).
   ============================================================================ */

window.APP_CONFIG = {

  /* Códigos de invitación para crear cuenta. El código define el rol:
     - rol "obra"  → director de obra (pide materiales, registra recepción)
     - rol "admin" → administración (gestiona compras, obras, y todo lo demás)
     Cambialos cuando quieras; los usuarios ya registrados no se ven afectados. */
  CODIGOS_INVITACION: {
    "OBRA-ST": "obra",
    "ADMIN-ST": "admin"
  },

  /* Webhook de notificaciones (n8n / WhatsApp / mail).
     Si está vacío no se envía nada. Cuando tengas el workflow de n8n,
     pegá acá la URL del webhook y la app hará un POST con JSON en cada
     cambio de estado de un pedido. */
  WEBHOOK_URL: "",

  /* Unidades sugeridas al cargar ítems (se puede escribir cualquier otra). */
  UNIDADES: ["un.", "m²", "m³", "kg", "bolsa", "pallet", "ml", "lts"]
};
