/**
 * Librerías pesadas que sólo se usan al exportar: se descargan en el momento
 * en que el usuario pulsa Exportar/Imprimir, no al abrir el módulo.
 *   xlsx ≈ 137 KB comprimido · jspdf + autotable ≈ 133 KB comprimido
 */
export const cargarXLSX = () => import('xlsx');

export async function cargarPDF() {
  const [pdf, tabla] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF: pdf.default, autoTable: tabla.default };
}
