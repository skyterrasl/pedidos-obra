/* ============================================================================
   ★★★  ESTE ES EL ARCHIVO QUE HAY QUE EDITAR PARA CONECTAR LA APP  ★★★
   ----------------------------------------------------------------------------
   Acá van las claves de TU proyecto de Firebase (las que conectan la app con
   la base de datos y el login). Mientras diga REEMPLAZAR, la app muestra una
   pantalla avisando que falta configurar (no se rompe).

   ¿De dónde saco esto? El README.md lo explica paso a paso. En resumen:
   console.firebase.google.com → tu proyecto → Configuración del proyecto
   (la ruedita) → "Tus apps" → app web → copiá el bloque "firebaseConfig"
   y reemplazá los valores de abajo (dejá las comillas).

   ⚠️ ¿Es seguro que estas claves queden a la vista? Sí: en Firebase estas
   claves son públicas por diseño. Lo que protege los datos son las REGLAS
   de Firestore (archivo firestore.rules, se pegan en la consola).
   ============================================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "REEMPLAZAR-apiKey",
  authDomain: "REEMPLAZAR-authDomain",
  projectId: "REEMPLAZAR-projectId",
  storageBucket: "REEMPLAZAR-storageBucket",
  messagingSenderId: "REEMPLAZAR-messagingSenderId",
  appId: "REEMPLAZAR-appId"
};
