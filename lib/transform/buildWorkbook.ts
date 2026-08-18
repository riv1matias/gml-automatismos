import ExcelJS from "exceljs";
import type { FinalRow, RawRecord } from "./types";

const RAW_SHEET_NAME = "RawAFIP";

const FINAL_HEADERS = [
  "Fecha", "FechaContable", "Proveedor", "Comprobante", "Sucursal", "NroComprobante",
  "CondCompra", "Moneda", "Cotizacion", "ClasificacionCF", "ImputacionCF",
  "NG al 21%", "NG al 27%", "NG al 10,5%", "NG al 5%", "NG al 2,5%",
  "IVA al 21%", "IVA al 27%", "IVA al 10,5%", "IVA al 5%", "IVA al 2,5%",
  "Exento", "NoAlcanzado", "ImpuestosInternos", "PercepcionesIVA", "RegimenPercIVA",
  "PercepcionesIB", "PercepcionesIG", "PercepcionesBP", "TotalComprobante",
  "CAI/CAE/COE", "VtoCAI/CAE/COE",
];

const RAW_HEADERS = [
  "Fecha de Emisión", "Tipo de Comprobante", "Punto de Venta", "Número de Comprobante",
  "Tipo Doc. Vendedor", "Nro. Doc. Vendedor", "Denominación Vendedor", "Importe Total",
  "Moneda Original", "Tipo de Cambio", "Importe No Gravado", "Importe Exento",
  "Crédito Fiscal Computable", "Importe de Per. o Pagos a Cta. de Otros Imp. Nac.",
  "Importe de Percepciones de Ingresos Brutos", "Importe de Impuestos Municipales",
  "Importe de Percepciones o Pagos a Cuenta de IVA", "Importe de Impuestos Internos",
  "Importe Otros Tributos", "Neto Gravado IVA 0%", "Neto Gravado IVA 2,5%",
  "Importe IVA 2,5%", "Neto Gravado IVA 5%", "Importe IVA 5%", "Neto Gravado IVA 10,5%",
  "Importe IVA 10,5%", "Neto Gravado IVA 21%", "Importe IVA 21%", "Neto Gravado IVA 27%",
  "Importe IVA 27%", "Total Neto Gravado", "Total IVA",
];

// exceljs no trae un helper publico para esto en todas las versiones -> propio
function getColLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function formulaCell(sheet: string, colLetter: string, row: number): string {
  return `'${sheet}'!${colLetter}${row}`;
}

/**
 * Construye el workbook final:
 *  - hoja "RawAFIP": el crudo parseado, tal cual, para trazabilidad
 *  - hoja "Comprobantes": header fijo + una fila por comprobante con formulas que
 *    leen de RawAFIP (mismo criterio que la planilla manual original) y el valor
 *    ya calculado como cache, para que se vea bien aunque no se recalculen las
 *    formulas al abrir el archivo.
 *  - hoja "Proveedores": copia de la hoja Proveedores del archivo base activo,
 *    para que el archivo final quede autocontenido.
 */
export async function buildFinalWorkbook(
  raw: RawRecord[],
  finalRows: FinalRow[],
  proveedoresWorkbookBuffer: Buffer
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // --- hoja RawAFIP ---
  const rawWs = wb.addWorksheet(RAW_SHEET_NAME);
  rawWs.addRow(RAW_HEADERS);
  raw.forEach((r) => {
    rawWs.addRow([
      r.fecha, r.tipoComp, r.ptoVta, r.nroComp, r.tipoDocVend, r.nroDocVend, r.denominacion,
      r.importeTotal, r.moneda, r.tipoCambio, r.noGravado, r.exento, r.creditoFiscal,
      r.perOtrosImpNac, r.percepIIBB, r.impMunicipales, r.percepIVA, r.impInternos,
      r.otrosTributos, r.ng0, r.ng2_5, r.iva2_5, r.ng5, r.iva5, r.ng10_5, r.iva10_5,
      r.ng21, r.iva21, r.ng27, r.iva27, r.totalNetoGravado, r.totalIva,
    ]);
  });
  rawWs.getColumn(1).numFmt = "dd/mm/yyyy";

  // --- hoja Comprobantes ---
  const compWs = wb.addWorksheet("Comprobantes");
  compWs.addRow(FINAL_HEADERS);

  // columnas del RAW por letra (mismo layout que RAW_HEADERS arriba, 1-indexed)
  const RAW_COL = {
    fecha: getColLetter(1),
    tipoComp: getColLetter(2),
    ptoVta: getColLetter(3),
    nroComp: getColLetter(4),
    nroDocVend: getColLetter(6),
    importeTotal: getColLetter(8),
    noGravado: getColLetter(11),
    exento: getColLetter(12),
    creditoFiscal: getColLetter(13),
    perOtrosImpNac: getColLetter(14),
    percepIIBB: getColLetter(15),
    impMunicipales: getColLetter(16),
    percepIVA: getColLetter(17),
    impInternos: getColLetter(18),
    otrosTributos: getColLetter(19),
    ng0: getColLetter(20),
    ng2_5: getColLetter(21),
    iva2_5: getColLetter(22),
    ng5: getColLetter(23),
    iva5: getColLetter(24),
    ng10_5: getColLetter(25),
    iva10_5: getColLetter(26),
    ng21: getColLetter(27),
    iva21: getColLetter(28),
    ng27: getColLetter(29),
    iva27: getColLetter(30),
  };

  finalRows.forEach((row, i) => {
    const r = i + 2; // fila 1 = header, tanto en Comprobantes como en RawAFIP

    const setFormula = (colIdx: number, formula: string, result: number | Date | null) => {
      compWs.getCell(r, colIdx).value = { formula, result: result ?? undefined } as ExcelJS.CellFormulaValue;
    };
    const setConst = (colIdx: number, value: number | null) => {
      compWs.getCell(r, colIdx).value = value;
    };

    setFormula(1, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.fecha, r)}`, row.fecha);
    compWs.getCell(r, 1).numFmt = "dd/mm/yyyy";
    setFormula(2, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.fecha, r)}`, row.fechaContable);
    compWs.getCell(r, 2).numFmt = "dd/mm/yyyy";
    setFormula(3, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.nroDocVend, r)}`, row.proveedor);
    setFormula(4, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.tipoComp, r)}`, row.comprobante);
    setFormula(5, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ptoVta, r)}`, row.sucursal);
    setFormula(6, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.nroComp, r)}`, row.nroComprobante);
    setConst(7, row.condCompra);
    setConst(8, row.moneda);
    setConst(9, row.cotizacion);
    setConst(10, row.clasificacionCF);
    setConst(11, row.imputacionCF);
    setFormula(12, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ng21, r)}`, row.ng21);
    setFormula(13, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ng27, r)}`, row.ng27);
    setFormula(14, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ng10_5, r)}`, row.ng10_5);
    setFormula(15, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ng5, r)}`, row.ng5);
    setFormula(16, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.ng2_5, r)}`, row.ng2_5);
    setFormula(17, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.iva21, r)}`, row.iva21);
    setFormula(18, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.iva27, r)}`, row.iva27);
    setFormula(19, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.iva10_5, r)}`, row.iva10_5);
    setFormula(20, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.iva5, r)}`, row.iva5);
    setFormula(21, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.iva2_5, r)}`, row.iva2_5);
    setFormula(
      22,
      `=IF(SUM(${formulaCell(RAW_SHEET_NAME, RAW_COL.creditoFiscal, r)},` +
        `${formulaCell(RAW_SHEET_NAME, RAW_COL.ng0, r)}:${formulaCell(RAW_SHEET_NAME, RAW_COL.iva27, r)})=0,` +
        `${formulaCell(RAW_SHEET_NAME, RAW_COL.importeTotal, r)},${formulaCell(RAW_SHEET_NAME, RAW_COL.exento, r)})`,
      row.exento
    );
    setFormula(
      23,
      `=${formulaCell(RAW_SHEET_NAME, RAW_COL.noGravado, r)}+${formulaCell(RAW_SHEET_NAME, RAW_COL.perOtrosImpNac, r)}` +
        `+${formulaCell(RAW_SHEET_NAME, RAW_COL.impMunicipales, r)}+${formulaCell(RAW_SHEET_NAME, RAW_COL.impInternos, r)}` +
        `+${formulaCell(RAW_SHEET_NAME, RAW_COL.otrosTributos, r)}`,
      row.noAlcanzado
    );
    setConst(24, row.impuestosInternos);
    setFormula(25, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.percepIVA, r)}`, row.percepcionesIVA);
    setConst(26, row.regimenPercIVA);
    setFormula(27, `=${formulaCell(RAW_SHEET_NAME, RAW_COL.percepIIBB, r)}`, row.percepcionesIB);
    setConst(28, row.percepcionesIG);
    setConst(29, row.percepcionesBP);
    setFormula(30, `=SUM(L${r}:Y${r})+SUM(AA${r}:AC${r})`, row.totalComprobante);
    setConst(31, row.caiCaeCoe);
    setConst(32, row.vtoCaiCaeCoe);
  });

  // --- hoja Proveedores: se copia tal cual del archivo base activo ---
  const provWb = new ExcelJS.Workbook();
  await provWb.xlsx.load(proveedoresWorkbookBuffer);
  const provSrc = provWb.worksheets[0];
  if (provSrc) {
    const provWs = wb.addWorksheet("Proveedores");
    provSrc.eachRow((row, rowNumber) => {
      const values = (row.values as (string | number | null)[]).slice(1);
      provWs.getRow(rowNumber).values = values;
    });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
