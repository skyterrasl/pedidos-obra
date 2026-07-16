/* ============================================================================
   PEDIDOS DE OBRA · SKY TERRA — export.js
   Exporta el listado filtrado a Excel (.xlsx con SheetJS por CDN).
   Si la librería no carga (sin internet, CDN caído), cae a CSV que Excel
   abre igual. No forma parte del app shell: se carga solo al exportar.
   ============================================================================ */

window.PO = window.PO || {};

(function () {
  "use strict";

  const CDN_SHEETJS = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  function cargarSheetJS() {
    return new Promise((resolve, reject) => {
      if (window.XLSX) { resolve(window.XLSX); return; }
      const s = document.createElement("script");
      const timer = setTimeout(() => reject(new Error("timeout")), 8000);
      s.onload = () => { clearTimeout(timer); resolve(window.XLSX); };
      s.onerror = () => { clearTimeout(timer); reject(new Error("no cargó")); };
      s.src = CDN_SHEETJS;
      document.head.appendChild(s);
    });
  }

  function filasExport(pedidos, h) {
    const cab = ["Número", "Obra", "Rubro", "Estado", "Prioridad", "Solicitante",
      "Creado", "Fecha necesaria", "Proveedor", "Fecha estimada", "Ítems", "% recibido"];
    const filas = pedidos.map((p) => [
      p.numero || "Borrador",
      p.obraNombre || "",
      p.rubro || "",
      (h.ESTADOS && h.ESTADOS[p.estado]) || p.estado,
      p.prioridad === "urgente" ? "Urgente" : "Normal",
      p.solicitanteNombre || "",
      h.tsAFechaISO(p.creado),
      p.fechaNecesaria || "",
      (p.proveedor && p.proveedor.nombre) || "",
      (p.proveedor && p.proveedor.fechaEstimada) || "",
      (p.items || []).map((it) => it.cantidad + " " + it.unidad + " " + it.descripcion).join(" | "),
      h.pctRecibido(p) + "%"
    ]);
    return [cab].concat(filas);
  }

  function nombreArchivo(ext) {
    const d = new Date();
    const f = d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0");
    return "pedidos-obra-" + f + "." + ext;
  }

  function descargarCSV(filas) {
    // Separador ";" (Excel en español) + BOM para que respete acentos.
    const csv = "\uFEFF" + filas.map((fila) =>
      fila.map((c) => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(";")
    ).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombreArchivo("csv");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /** Exporta la lista (ya filtrada) de pedidos. h = helpers del app
      { fmtFecha, tsAFechaISO, pctRecibido, ESTADOS }. */
  PO.exportarPedidos = async function (pedidos, h) {
    const filas = filasExport(pedidos, h);
    try {
      const XLSX = await cargarSheetJS();
      const ws = XLSX.utils.aoa_to_sheet(filas);
      ws["!cols"] = [
        { wch: 9 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 9 }, { wch: 18 },
        { wch: 11 }, { wch: 13 }, { wch: 20 }, { wch: 13 }, { wch: 60 }, { wch: 10 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
      XLSX.writeFile(wb, nombreArchivo("xlsx"));
    } catch (e) {
      console.warn("[PO] SheetJS no disponible, exportando CSV:", e);
      descargarCSV(filas);
    }
  };

})();
