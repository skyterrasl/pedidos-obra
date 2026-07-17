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
  apiKey: "AIzaSyDLEH4cV07RRkqUvRRyrTY_-l0BUrbv30I",
  authDomain: "pedidos-obra-skyterra.firebaseapp.com",
  projectId: "pedidos-obra-skyterra",
  storageBucket: "pedidos-obra-skyterra.firebasestorage.app",
  messagingSenderId: "675988642628",
  appId: "1:675988642628:web:f6acd7f93fdfbe1b8f9511"
};
