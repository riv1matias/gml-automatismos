// Un comprobante ya parseado desde el crudo de AFIP (venga de .csv o .xlsx),
// con nombres de campo propios en vez de las columnas textuales de AFIP.
export interface RawRecord {
  fecha: Date;
  tipoComp: number;
  ptoVta: number;
  nroComp: number;
  tipoDocVend: number;
  nroDocVend: number;
  denominacion: string;
  importeTotal: number;
  moneda: string;
  tipoCambio: number;
  noGravado: number;
  exento: number;
  creditoFiscal: number;
  perOtrosImpNac: number;
  percepIIBB: number;
  impMunicipales: number;
  percepIVA: number;
  impInternos: number;
  otrosTributos: number;
  ng0: number;
  ng2_5: number;
  iva2_5: number;
  ng5: number;
  iva5: number;
  ng10_5: number;
  iva10_5: number;
  ng21: number;
  iva21: number;
  ng27: number;
  iva27: number;
  totalNetoGravado: number;
  totalIva: number;
}

// Una fila ya mapeada al formato final "Comprobantes"
export interface FinalRow {
  fecha: Date;
  fechaContable: Date;
  proveedor: number;
  comprobante: number;
  sucursal: number;
  nroComprobante: number;
  condCompra: number;
  moneda: null;
  cotizacion: null;
  clasificacionCF: number;
  imputacionCF: number;
  ng21: number;
  ng27: number;
  ng10_5: number;
  ng5: number;
  ng2_5: number;
  iva21: number;
  iva27: number;
  iva10_5: number;
  iva5: number;
  iva2_5: number;
  exento: number;
  noAlcanzado: number;
  impuestosInternos: null;
  percepcionesIVA: number;
  regimenPercIVA: number;
  percepcionesIB: number;
  percepcionesIG: null;
  percepcionesBP: null;
  totalComprobante: number;
  caiCaeCoe: null;
  vtoCaiCaeCoe: null;
}

export interface RunWarning {
  rowIndex: number; // 1-based, referido a la fila del archivo crudo (sin contar header)
  denominacion: string;
  nroDocVend: number;
  importeTotal: number;
  totalCalculado: number;
  diferencia: number;
  mensaje: string;
}

export interface TransformResult {
  finalRows: FinalRow[];
  warnings: RunWarning[];
}
