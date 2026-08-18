import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import type { RawRecord } from "./types";

// Orden esperado de columnas en el export "Mis Comprobantes" (Compras) de AFIP.
// Si AFIP cambia el orden algun dia, esto es lo primero que hay que revisar.
const EXPECTED_HEADER = [
  "Fecha de Emisión",
  "Tipo de Comprobante",
  "Punto de Venta",
  "Número de Comprobante",
  "Tipo Doc. Vendedor",
  "Nro. Doc. Vendedor",
  "Denominación Vendedor",
  "Importe Total",
  "Moneda Original",
  "Tipo de Cambio",
  "Importe No Gravado",
  "Importe Exento",
  "Crédito Fiscal Computable",
  "Importe de Per. o Pagos a Cta. de Otros Imp. Nac.",
  "Importe de Percepciones de Ingresos Brutos",
  "Importe de Impuestos Municipales",
  "Importe de Percepciones o Pagos a Cuenta de IVA",
  "Importe de Impuestos Internos",
  "Importe Otros Tributos",
  "Neto Gravado IVA 0%",
  "Neto Gravado IVA 2,5%",
  "Importe IVA 2,5%",
  "Neto Gravado IVA 5%",
  "Importe IVA 5%",
  "Neto Gravado IVA 10,5%",
  "Importe IVA 10,5%",
  "Neto Gravado IVA 21%",
  "Importe IVA 21%",
  "Neto Gravado IVA 27%",
  "Importe IVA 27%",
  "Total Neto Gravado",
  "Total IVA",
];

export class RawParseError extends Error {}

function parseArNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") return raw;
  const s = raw.trim();
  if (s === "") return 0;
  // formato AR: separador de miles "." y decimal ","
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function parseArDate(raw: string | Date | null | undefined): Date {
  if (raw instanceof Date) return raw;
  if (!raw) throw new RawParseError("Fecha vacia en el archivo crudo");
  const s = raw.trim();
  // admite "yyyy-mm-dd" (formato del export de AFIP)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new RawParseError(`No se pudo interpretar la fecha: "${s}"`);
  return d;
}

function rowToRecord(cols: (string | number | Date | null)[]): RawRecord {
  const s = (i: number) => (cols[i] === null || cols[i] === undefined ? "" : String(cols[i]));
  const n = (i: number) => parseArNumber(cols[i] as string | number | null);

  return {
    fecha: parseArDate(cols[0] as string | Date),
    tipoComp: Math.trunc(n(1)),
    ptoVta: Math.trunc(n(2)),
    nroComp: Math.trunc(n(3)),
    tipoDocVend: Math.trunc(n(4)),
    nroDocVend: Math.trunc(n(5)),
    denominacion: s(6),
    importeTotal: n(7),
    moneda: s(8),
    tipoCambio: n(9),
    noGravado: n(10),
    exento: n(11),
    creditoFiscal: n(12),
    perOtrosImpNac: n(13),
    percepIIBB: n(14),
    impMunicipales: n(15),
    percepIVA: n(16),
    impInternos: n(17),
    otrosTributos: n(18),
    ng0: n(19),
    ng2_5: n(20),
    iva2_5: n(21),
    ng5: n(22),
    iva5: n(23),
    ng10_5: n(24),
    iva10_5: n(25),
    ng21: n(26),
    iva21: n(27),
    ng27: n(28),
    iva27: n(29),
    totalNetoGravado: n(30),
    totalIva: n(31),
  };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvBuffer(buffer: Buffer): RawRecord[] {
  // el export de AFIP viene en latin1 (ISO-8859-1) y separado por ";"
  const text = iconv.decode(buffer, "latin1");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new RawParseError("El archivo esta vacio");

  const header = splitCsvLine(lines[0], ";");
  validateHeader(header);

  return lines.slice(1).map((line, idx) => {
    const cols = splitCsvLine(line, ";");
    try {
      return rowToRecord(cols);
    } catch (e) {
      throw new RawParseError(`Fila ${idx + 2} del CSV: ${(e as Error).message}`);
    }
  });
}

async function parseXlsxBuffer(buffer: Buffer): Promise<RawRecord[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new RawParseError("El Excel no tiene hojas");

  const headerRow = ws.getRow(1).values as (string | undefined)[];
  const header = EXPECTED_HEADER.map((_, i) => String(headerRow[i + 1] ?? "").trim());
  validateHeader(header);

  const records: RawRecord[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as (string | number | Date | null)[];
    // ExcelJS values[] arranca en indice 1
    const cols = EXPECTED_HEADER.map((_, i) => values[i + 1] ?? null);
    if (cols.every((c) => c === null || c === "")) return; // fila vacia al final
    try {
      records.push(rowToRecord(cols));
    } catch (e) {
      throw new RawParseError(`Fila ${rowNumber} del Excel: ${(e as Error).message}`);
    }
  });
  return records;
}

function validateHeader(header: string[]) {
  for (let i = 0; i < EXPECTED_HEADER.length; i++) {
    if ((header[i] || "").trim() !== EXPECTED_HEADER[i]) {
      throw new RawParseError(
        `La columna ${i + 1} del archivo es "${header[i] ?? ""}" y se esperaba "${EXPECTED_HEADER[i]}". ` +
          `Verificá que sea el export de "Mis Comprobantes > Compras" de AFIP sin modificar.`
      );
    }
  }
}

export async function parseRawFile(buffer: Buffer, filename: string): Promise<RawRecord[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsvBuffer(buffer);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseXlsxBuffer(buffer);
  throw new RawParseError("Formato no soportado: subí un .csv o .xlsx del export de AFIP");
}
