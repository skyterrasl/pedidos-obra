/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — lector-lista.js

   Convierte una lista escrita a mano en ítems del pedido.

   El director de obra casi nunca inventa la lista: se la pasa el plomero, el
   electricista o el capataz, por WhatsApp o en un papel. Cargarla a mano son
   tres toques por renglón; en un pedido de 43 renglones, ciento treinta
   toques parado en la obra. Este módulo le deja pegar (o dictar) la lista tal
   como la recibió.

   Todo con reglas, sin IA y sin red: en obra no hay señal, y una lista de
   materiales mal adivinada se paga comprando la pieza equivocada.

   Dos niveles de reconocimiento:
     · por ejes, para cañerías — pieza, diámetro, ángulo, terminación y largo.
       "codo a 45 de 110 m.h" → "AWADUCT codo 110 a 45 MH (2004)"
     · por palabras, para todo lo demás — el que más coincide gana.

   Cuando hay duda NO elige: devuelve los candidatos para que el director
   toque uno. Y si no encuentra nada, el renglón entra tal como se escribió:
   el proveedor lo entiende igual y el pedido sale completo.
   ============================================================================ */

(function () {
  "use strict";

  const norm = (t) =>
    String(t == null ? "" : t).toLowerCase()
      .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
      .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
      .replace(/\s+/g, " ").trim();

  /* ------------------------------------------------------------- ejes ----- */

  /* Diámetros de cañería en milímetros. 45 y 90 no están en la lista a
     propósito: en este rubro son siempre ángulos, nunca medidas. */
  const DIAM_MM = [110, 63, 50, 40, 32, 25, 20];

  /* Los diámetros en pulgadas se escriben de mil formas. Se buscan de mayor a
     menor para que 1 1/4 no se lea como "1" y después "1/4". */
  const PULG = [
    ["1 1/2", /1\s*1\/2/], ["1 1/4", /1\s*1\/4/],
    ["3/4", /3\/4/], ["1/2", /1\/2/], ["1/4", /1\/4/],
    ["1", /(^|[^\/\d])1(?![\s]*[\/\d])/]
  ];

  function angulo(s) {
    if (/\b90\b|90ro/.test(s)) return 90;
    if (/\b45\b|45ro/.test(s)) return 45;
    return null;
  }

  /* La terminación se saca del texto antes de medir: el "m" de "m.h" se leía
     como metros y el largo de "codo de 110 m.h" salía 110. */
  function partirTerminacion(s) {
    const pares = [
      ["RH", /\br\.?\s*hembra\b|\brh\b|\brosca\s+hembra\b/],
      ["RM", /\br\.?\s*macho\b|\brm\b|\brosca\s+macho\b/],
      // "HHC" también es hembra-hembra (la cupla patentada de Awaduct): sin
      // esto parecía una pieza "común" y se elegía sola en vez de preguntar.
      ["MH", /\bm[\.\- ]?h\b|\bmh\b/], ["HH", /\bh[\.\- ]?h\b|\bhhc?\b|h-hc/]
    ];
    for (const p of pares) if (p[1].test(s)) return { term: p[0], resto: s.replace(p[1], " ") };
    return { term: null, resto: s };
  }

  /* Largo del caño, siempre en metros. Devuelve también el texto sin el
     largo, porque el "50" de "0.50 mts" se leía como diámetro 50. */
  function partirLargo(s) {
    const pares = [
      [/\b(\d+)\s*cm\b/, (m) => parseInt(m[1], 10) / 100],
      [/\b0[\.,](\d+)\s*(?:mts?|metros?|m)?\b/, (m) => parseFloat("0." + m[1])],
      [/\b(\d+(?:[\.,]\d+)?)\s*(?:mts|mt|metros?)\b/, (m) => parseFloat(m[1].replace(",", "."))],
      [/\b(\d+)\s*m\b/, (m) => parseFloat(m[1])]
    ];
    for (const p of pares) {
      const m = s.match(p[0]);
      if (m) return { largo: p[1](m), resto: s.replace(p[0], " ") };
    }
    return { largo: null, resto: s };
  }

  function diametros(s) {
    const t = " " + s.replace(/90ro|45ro/g, " ").replace(/\b(90|45)\b/g, " ") + " ";
    const mm = DIAM_MM.filter((d) =>
      new RegExp("(^|[^\\d\\.,])" + d + "([^\\d]|$)").test(t));
    const pulg = [];
    let resto = t;
    PULG.forEach((p) => {
      if (p[1].test(resto)) { pulg.push(p[0]); resto = resto.replace(p[1], " "); }
    });
    return { mm: mm.sort((a, b) => b - a), pulg: pulg };
  }

  /* Sinónimos → pieza canónica. Las frases largas primero: "tapa macho" antes
     que "tapa", "buje reduccion" antes que "buje". */
  const PIEZAS = [
    ["tapa_hembra", ["tapa hembra"]],
    ["tapon", ["tapon", "tapa macho"]],
    ["buje", ["buje reduccion", "buje reduc", "buje red", "buje"]],
    ["pileta", ["pileta de patio", "pileta patio", "pileta"]],
    ["llave", ["llave de paso", "llave esferica", "llave"]],
    ["cano", ["tira cano", "cano", "tubo"]],
    ["codo", ["codo"]],
    ["curva", ["curva"]],
    ["ramal", ["ramal simple", "ramal"]],
    ["tee", ["tee"]],
    ["cupla", ["cupla", "manguito"]],
    ["union", ["union"]],
    ["tapa", ["tapa p.v.c", "tapa pvc", "tapa"]],
    ["boquilla", ["boquilla"]],
    ["niple", ["niple"]],
    ["boca", ["boca de acceso", "boca acceso"]],
    ["deslizante", ["solucion deslizante", "lubricante en aerosol", "lubricante"]],
    ["sellador", ["sellador", "cellador", "sellagas"]],
    ["teton", ["teton", "tubo macho"]]
  ];

  /* La pieza es la palabra que aparece más a la izquierda: en "sellador para
     caño de gas" lo que se pide es el sellador, y "caño" es el complemento.
     Se busca por palabra entera —"cellador" contenía "cano"— y se acepta el
     plural ("caños", "cuplas"). */
  function pieza(s) {
    const t = " " + s.replace(/[^a-z0-9\/\. ]/g, " ").replace(/\s+/g, " ") + " ";
    let mejor = null, dondeMejor = Infinity;
    PIEZAS.forEach((par) => {
      par[1].forEach((a) => {
        let i = t.indexOf(" " + a + " ");
        if (i < 0) i = t.indexOf(" " + a + "s ");
        if (i >= 0 && i < dondeMejor) { dondeMejor = i; mejor = par[0]; }
      });
    });
    return mejor;
  }

  /* Marca escrita en el pedido → marca del catálogo. */
  const MARCAS = [
    [/fusion verde|termofusion/, "TIGRE"], [/awaduct/, "AWADUCT"],
    [/duratop/, "DURATOP"], [/sigas/, "SIGAS"],
    // "acquasisten", "acqua systen", "acqua system": se escribe de mil formas.
    [/acqua\s*s[iy]s?t[ei][mn]/, "ACQUASYSTEM"], [/saladillo|hidro3|hidroflex/, "SALADILLO"],
    [/tubotherm/, "TUBOTHERM"],
    [/tigre/, "TIGRE"], [/duke/, "DUKE"], [/amanco/, "AMANCO"],
    [/dema|epoxi/, "DEMA"], [/calibron/, "CALIBRON"], [/conexsa/, "CONEXSA"]
  ];
  const marcaDe = (s) => {
    for (const p of MARCAS) if (p[0].test(s)) return p[1];
    return null;
  };

  /* Un caño de gas no reemplaza a uno de desagüe, ni una llave de bronce a
     una de termofusión. Cuando la marca del renglón no da resultado se busca
     en el resto de SU familia, nunca fuera: antes ofrecía un buje SIGAS (gas)
     para un desagüe y un tee de bronce para fusión verde. */
  const FAMILIAS = {
    cloacal: ["AWADUCT", "AMANCO", "DURATOP", "CASAL", "DUKE", "GALI", "TIGRE PVC"],
    agua: ["TIGRE", "SALADILLO", "ACQUASYSTEM", "PPP", "POLIMEX", "BAIRES",
           "GENEBRE", "LATYN", "TRIANGULAR", "WATERPLAST", "ROTOPLAS"],
    gas: ["SIGAS", "DEMA", "DINATECNICA"],
    bronce: ["CALIBRON", "CONEXSA", "NP", "MANTA"]
  };
  function familiaDe(marca) {
    if (!marca) return null;
    for (const f in FAMILIAS) if (FAMILIAS[f].indexOf(marca) >= 0) return f;
    return null;
  }

  function ejes(texto) {
    const s = norm(texto);
    const t = partirTerminacion(s);
    const g = partirLargo(t.resto);
    const d = diametros(g.resto);
    return { pieza: pieza(s), ang: angulo(s), mm: d.mm, pulg: d.pulg,
             term: t.term, largo: g.largo, marca: marcaDe(s) };
  }

  /* --------------------------------------------------------- unidades ----- */

  /* Unidades que aparecen escritas en la lista. Las claves salen de
     APP_CONFIG.UNIDADES; lo que no se reconoce queda en "un.". */
  const UNIDADES = [
    ["bolsa", /\bbolsas?\b/], ["m³", /\bm3\b|\bmetros? cubicos?\b/],
    ["m²", /\bm2\b|\bmetros? cuadrados?\b/], ["kg", /\bkgs?\b|\bkilos?\b/],
    ["lts", /\blts?\b|\blitros?\b/], ["pallet", /\bpallets?\b/],
    ["ml", /\bml\b|\bmetros? lineales?\b/]
  ];
  function unidadDe(s) {
    for (const p of UNIDADES) if (p[1].test(s)) return p[0];
    return "un.";
  }

  /* --------------------------------------------------------- por palabras - */

  /* Palabras que no distinguen nada y sólo ensucian el puntaje. */
  const VACIAS = ["de", "del", "la", "el", "los", "las", "con", "para", "por",
                  "a", "y", "en", "x", "un", "una", "al", "su"];

  const tokens = (t) =>
    norm(t).replace(/[^a-z0-9\/\.\s]/g, " ").split(/\s+/)
      // Un número de un dígito sí distingue: "colector de 7" no es el de 5.
      .filter((w) => w && (w.length > 1 || /^\d$/.test(w)) && VACIAS.indexOf(w) < 0);

  /* Cuánto del renglón pedido aparece en el ítem del catálogo. Se pide que
     estén TODAS las palabras del pedido: con la mitad ya empieza a traer
     cualquier cosa. */
  function puntaje(pedido, item) {
    const a = tokens(pedido), b = tokens(item);
    if (!a.length) return 0;
    let hay = 0;
    a.forEach((w) => { if (b.some((v) => v === w || v.indexOf(w) === 0)) hay++; });
    return hay / a.length;
  }

  /* ---------------------------------------------------------- matcheo ----- */

  function crearBuscador(catalogo) {
    const CAT = (catalogo || []).map((t) => ({ texto: t, e: ejes(t) }));

    function filtrar(e, marca, familia) {
      let c = CAT;
      if (marca) c = c.filter((x) => norm(x.texto).indexOf(norm(marca)) === 0);
      else if (familia)
        c = c.filter((x) => (FAMILIAS[familia] || [])
          .some((m) => norm(x.texto).indexOf(norm(m)) === 0));
      if (e.pieza) c = c.filter((x) => x.e.pieza === e.pieza);
      if (e.ang) c = c.filter((x) => x.e.ang === e.ang);
      if (e.term) c = c.filter((x) => x.e.term === e.term);
      if (e.mm.length) c = c.filter((x) => e.mm.every((d) => x.e.mm.indexOf(d) >= 0));
      if (e.pulg.length) c = c.filter((x) => e.pulg.every((p) => x.e.pulg.indexOf(p) >= 0));
      if (e.largo != null) c = c.filter((x) => x.e.largo === e.largo);
      return c;
    }

    /* Por ejes: sirve cuando el renglón tiene una pieza de cañería
       reconocible. Devuelve null si este renglón no es de ese tipo. */
    function porEjes(linea, marcaBloque, largoBloque) {
      const e = ejes(linea);
      if (!e.pieza) return null;

      // "Caño 2m todos" arriba del bloque: el largo que no se repite renglón
      // por renglón está escrito una vez. Sin esto, cada caño quedaba con
      // cinco opciones de largo y había que elegir una por una.
      if (e.pieza === "cano" && e.largo == null && largoBloque != null) {
        e.largo = largoBloque;
        e.porNota = true;
      }

      const marca = e.marca || marcaBloque;
      let otraMarca = false;

      const conMarca = (ej) => {
        let c = filtrar(ej, marca, null);
        // La lista viene agrupada por sistema, no por marca: dentro del bloque
        // AWADUCT aparece la tapa de 110, que en el catálogo es AMANCO, y el
        // lubricante, que es GALI. Eso vale para la marca del BLOQUE. Si la
        // marca está escrita en el mismo renglón ("acqua systen"), el plomero
        // fue explícito y no se le ofrece otra. Y una marca que no tiene
        // familia conocida (Tubotherm) no cae a buscar en todo el catálogo.
        if (!c.length && marca && !e.marca && familiaDe(marca)) {
          c = filtrar(ej, null, familiaDe(marca));
          otraMarca = c.length > 0;
        }
        return c;
      };

      let c = conMarca(e);
      // En termofusión la cupla se vende como "unión" (así la llama Tigre).
      if (!c.length && e.pieza === "cupla") c = conMarca(Object.assign({}, e, { pieza: "union" }));

      // Si no se pidió terminación, se prefiere la pieza común: "codo 45 32"
      // es el codo de siempre, y el MH se pide diciendo "MH".
      if (c.length > 1 && !e.term) {
        const comunes = c.filter((x) => !x.e.term);
        if (comunes.length && comunes.length < c.length) c = comunes;
      }

      // "ramal a 45 de 110 x 110": los dos diámetros iguales significan que
      // no reduce, así que gana el que tiene un solo diámetro.
      if (c.length > 1 && e.mm.length === 1) {
        const exactos = c.filter((x) => x.e.mm.length === 1);
        if (exactos.length) c = exactos;
      }
      if (!c.length) return null;
      return { candidatos: c.map((x) => x.texto), otraMarca: otraMarca,
               porNota: !!e.porNota, via: "ejes" };
    }

    /* Por palabras: para los rubros que no son cañería. Se piden todas las
       palabras del renglón y gana el nombre más corto que las tenga. Respeta
       la familia del bloque: sin eso, un codo de gas ofrecía también el de
       desagüe y el de agua caliente. */
    function porPalabras(linea, marcaBloque) {
      const marcaLinea = marcaDe(norm(linea));
      const marca = marcaLinea || marcaBloque;
      let base = CAT;
      if (marca) {
        // Primero la marca; si no tiene nada, su familia (sólo si la marca es
        // la del bloque); y si es una marca que el catálogo no tiene, nada:
        // un gabinete Tubotherm no es uno Saladillo.
        base = CAT.filter((x) => norm(x.texto).indexOf(norm(marca)) === 0);
        const fam = FAMILIAS[familiaDe(marca)];
        if (!base.length && !marcaLinea && fam)
          base = CAT.filter((x) => fam.some((m) => norm(x.texto).indexOf(norm(m)) === 0));
      }
      const con = base.map((x) => ({ texto: x.texto, p: puntaje(linea, x.texto) }))
        .filter((x) => x.p >= 0.999)
        .sort((a, b) => tokens(a.texto).length - tokens(b.texto).length);
      if (!con.length) return null;
      return { candidatos: con.slice(0, 6).map((x) => x.texto), otraMarca: false, via: "palabras" };
    }

    return function buscar(linea, marcaBloque, largoBloque) {
      return porEjes(linea, marcaBloque, largoBloque) ||
        porPalabras(linea, marcaBloque) ||
        { candidatos: [], otraMarca: false, via: null };
    };
  }

  /* ----------------------------------------------------------- pedido ----- */

  /* Encabezados que no son materiales. */
  const ES_CABECERA = /^(pedido|cotizacion|presupuesto|obra|barrio|lote|materiales|lista)\b/;

  /* "Retira Richard", "lo retira el plomero", "pasa a buscar Martin". */
  const ES_RETIRA = /^(retira|lo retira|la retira|pasa a buscar|busca)\b/;

  /* Notas del tipo "Caño 2m todos" o "todos de 4 mts": fijan el largo de los
     caños del bloque. Se exige que hable de caños o diga "todos", para no
     tomar cualquier número con una "m" al lado. */
  function largoDeNota(s) {
    if (!/\bcanos?\b|\btodos?\b/.test(s)) return null;
    // "Caño 2m todos" es una nota; "Rollos de caños de 100m según metros de
    // casa" es un material. La nota es corta o dice "todos".
    if (!/\btodos?\b/.test(s) && s.split(" ").length > 3) return null;
    const g = partirLargo(s);
    return g.largo;
  }

  function nombreDeObra(texto) {
    const t = String(texto).replace(/^[^:]*:\s*/, "").trim();
    return t.replace(/^(pedido|cotizacion|obra|barrio|lote)\s*/i, "").trim() || null;
  }

  /** Lee la lista completa.
      @param texto     lo que pegó o dictó el director
      @param catalogo  materiales del rubro elegido (para matchear)
      @returns { obra, retira, items: [...], resumen: {...} } */
  function leer(texto, catalogo) {
    const buscar = crearBuscador(catalogo);
    const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim());

    let obra = null, retira = null, marca = null, esperandoRetira = false;
    let largoBloque = null;   // lo fija una nota como "Caño 2m todos"
    const items = [];

    lineas.forEach((linea) => {
      if (!linea) return;
      const s = norm(linea);

      if (esperandoRetira && !/^\d/.test(s)) { retira = linea; esperandoRetira = false; return; }
      esperandoRetira = false;

      if (ES_RETIRA.test(s)) {
        const resto = linea.replace(new RegExp(ES_RETIRA.source, "i"), "")
          .replace(/^[:\s]+/, "").trim();
        // "Retira" solo, con el nombre en el renglón siguiente.
        if (resto) retira = resto; else esperandoRetira = true;
        return;
      }

      if (ES_CABECERA.test(s) && !/^\d/.test(s)) {
        const n = nombreDeObra(linea);
        if (n && !obra) obra = n;
        return;
      }

      const agregar = (cant, textoItem) => {
        const r = buscar(textoItem, marca, largoBloque);
        items.push({
          cant: cant,
          // Sin cantidad escrita: no se inventa un 1. Entra con la cantidad
          // vacía y el formulario pide completarla antes de enviar.
          sinCantidad: cant == null,
          texto: textoItem,
          unidad: unidadDe(norm(textoItem)),
          marca: marca,
          nota: false,
          candidatos: r.candidatos,
          otraMarca: r.otraMarca,
          porNota: !!r.porNota,
          via: r.via,
          // Resuelto: un solo candidato. Con varios, decide el director.
          elegido: r.candidatos.length === 1 ? r.candidatos[0] : null
        });
      };

      // "40 y 40 tornillos y tarugos 8": son dos materiales, uno por cantidad.
      const doble = linea.match(/^(\d+(?:[\.,]\d+)?)\s+y\s+(\d+(?:[\.,]\d+)?)\s+(\S+)\s+y\s+(\S+)(.*)$/i);
      if (doble) {
        agregar(parseFloat(doble[1].replace(",", ".")), (doble[3] + doble[5]).trim());
        agregar(parseFloat(doble[2].replace(",", ".")), (doble[4] + doble[5]).trim());
        return;
      }

      const m = linea.match(/^(\d+(?:[\.,]\d+)?)\s*[\)\-\.]?\s+(.*)$/);
      if (!m) {
        // Un número solo en el primer renglón es la obra: "433" es ATA-433.
        if (!obra && !items.length && /^\d{1,5}$/.test(s)) { obra = s; return; }

        // El nombre de un bloque: una marca conocida, o "Todo X" aunque X no
        // esté en el catálogo (así "Todo Tubotherm" no busca en otras marcas).
        const mk = marcaDe(s);
        const todo = s.match(/^todos?\s+(?:de\s+|en\s+)?([a-z][a-z0-9]*)$/);
        if ((mk && s.split(" ").length <= 3) || todo) {
          marca = mk || todo[1].toUpperCase();
          largoBloque = null;      // cada bloque tiene el suyo
          return;
        }

        // Una nota que fija el largo de los caños del bloque.
        const lg = largoDeNota(s);
        if (lg != null) {
          largoBloque = lg;
          items.push({ cant: null, texto: linea, marca: marca, nota: true,
                       candidatos: [], elegido: null, fijaLargo: lg });
          return;
        }

        // Cualquier otro renglón con más de una palabra es un material al que
        // le falta la cantidad ("Rollos de caños de 100m según metros de
        // casa"). Antes se tomaba como nota y se perdía del pedido.
        if (s.split(" ").length >= 2) { agregar(null, linea); return; }

        items.push({ cant: null, texto: linea, marca: marca, nota: true,
                     candidatos: [], elegido: null });
        return;
      }

      agregar(parseFloat(m[1].replace(",", ".")), m[2].trim());
    });

    const reales = items.filter((i) => !i.nota);
    return {
      obra: obra, retira: retira, items: items,
      resumen: {
        total: reales.length,
        listos: reales.filter((i) => i.elegido).length,
        aElegir: reales.filter((i) => !i.elegido && i.candidatos.length > 1).length,
        libres: reales.filter((i) => !i.elegido && !i.candidatos.length).length,
        sinCantidad: reales.filter((i) => i.sinCantidad).length,
        notas: items.length - reales.length
      }
    };
  }

  const API = { leer: leer, ejes: ejes, norm: norm, unidadDe: unidadDe,
                largoDeNota: largoDeNota };

  if (typeof window !== "undefined") {
    window.PO = window.PO || {};
    window.PO.lector = API;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
