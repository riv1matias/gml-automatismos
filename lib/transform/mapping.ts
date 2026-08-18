import type { RawRecord, FinalRow, RunWarning, TransformResult } from "./types";

const TOLERANCE = 0.02; // pesos - margen para redondeos de centavos

/**
 * Reglas de negocio confirmadas con el equipo contable (ver hilo de definicion):
 *
 * - Fecha / FechaContable            <- Fecha de Emision (misma fecha para ambas)
 * - Proveedor                        <- Nro. Doc. Vendedor (CUIT)
 * - Comprobante                      <- Tipo de Comprobante (codigo AFIP)
 * - Sucursal                         <- Punto de Venta
 * - NroComprobante                   <- Numero de Comprobante
 * - CondCompra                       = 0 (constante)
 * - ClasificacionCF                  = 3 (constante)
 * - ImputacionCF                     = 1 (constante)
 * - Moneda / Cotizacion              siempre vacias (los importes en USD ya vienen
 *                                     convertidos a pesos en el export de AFIP)
 * - NG / IVA por tasa (21/27/10,5/5/2,5) <- columna de esa tasa en el crudo, 1 a 1
 * - Exento                           <- si la factura no discrimina IVA en ningun lado
 *                                     (Factura C / monotributista), se usa el Importe
 *                                     Total completo. Si discrimina, se usa el
 *                                     Importe Exento tal cual viene.
 * - NoAlcanzado                      <- Importe No Gravado + Per./Pagos Cta Otros Imp
 *                                     Nac. + Imp. Municipales + Imp. Internos +
 *                                     Otros Tributos (los 5 conceptos "varios" se
 *                                     agrupan aca, confirmado por el equipo contable)
 * - ImpuestosInternos (columna propia) siempre vacia (va dentro de NoAlcanzado)
 * - PercepcionesIVA                  <- Importe de Percepciones o Pagos a Cta de IVA
 * - RegimenPercIVA                   = 493 (constante)
 * - PercepcionesIB                   <- Importe de Percepciones de Ingresos Brutos
 * - PercepcionesIG / PercepcionesBP  siempre vacias (no hay dato equivalente en AFIP)
 * - CAI/CAE/COE y su vencimiento     siempre vacios (no se cargan)
 * - TotalComprobante                 = suma de todas las columnas de importe de la fila
 *
 * Nota conocida: comprobantes de compañías de seguros pueden traer un
 * "Importe No Gravado" que NO es un componente adicional del total (es informativo
 * de otra naturaleza, ej. premio de poliza vs cuota facturada). Cuando eso pasa, la
 * fila queda marcada en `warnings` para que un socio la revise a mano en vez de
 * confiar ciegamente en la formula.
 */
export function mapToFinalRows(raw: RawRecord[]): TransformResult {
  const finalRows: FinalRow[] = [];
  const warnings: RunWarning[] = [];

  raw.forEach((r, idx) => {
    const sinDiscriminarIVA =
      r.creditoFiscal === 0 &&
      r.ng0 === 0 &&
      r.ng2_5 === 0 &&
      r.iva2_5 === 0 &&
      r.ng5 === 0 &&
      r.iva5 === 0 &&
      r.ng10_5 === 0 &&
      r.iva10_5 === 0 &&
      r.ng21 === 0 &&
      r.iva21 === 0 &&
      r.ng27 === 0 &&
      r.iva27 === 0;

    const exento = sinDiscriminarIVA ? r.importeTotal : r.exento;

    const noAlcanzado =
      r.noGravado + r.perOtrosImpNac + r.impMunicipales + r.impInternos + r.otrosTributos;

    const totalComprobante =
      r.ng21 + r.ng27 + r.ng10_5 + r.ng5 + r.ng2_5 +
      r.iva21 + r.iva27 + r.iva10_5 + r.iva5 + r.iva2_5 +
      exento + noAlcanzado + r.percepIVA + r.percepIIBB;

    const row: FinalRow = {
      fecha: r.fecha,
      fechaContable: r.fecha,
      proveedor: r.nroDocVend,
      comprobante: r.tipoComp,
      sucursal: r.ptoVta,
      nroComprobante: r.nroComp,
      condCompra: 0,
      moneda: null,
      cotizacion: null,
      clasificacionCF: 3,
      imputacionCF: 1,
      ng21: r.ng21,
      ng27: r.ng27,
      ng10_5: r.ng10_5,
      ng5: r.ng5,
      ng2_5: r.ng2_5,
      iva21: r.iva21,
      iva27: r.iva27,
      iva10_5: r.iva10_5,
      iva5: r.iva5,
      iva2_5: r.iva2_5,
      exento,
      noAlcanzado,
      impuestosInternos: null,
      percepcionesIVA: r.percepIVA,
      regimenPercIVA: 493,
      percepcionesIB: r.percepIIBB,
      percepcionesIG: null,
      percepcionesBP: null,
      totalComprobante,
      caiCaeCoe: null,
      vtoCaiCaeCoe: null,
    };

    finalRows.push(row);

    const diferencia = Math.round((r.importeTotal - totalComprobante) * 100) / 100;
    if (Math.abs(diferencia) > TOLERANCE) {
      warnings.push({
        rowIndex: idx + 1,
        denominacion: r.denominacion,
        nroDocVend: r.nroDocVend,
        importeTotal: r.importeTotal,
        totalCalculado: totalComprobante,
        diferencia,
        mensaje:
          `El total calculado no coincide con el Importe Total del comprobante ` +
          `(diferencia de $${diferencia.toFixed(2)}). Revisar a mano antes de importar.`,
      });
    }
  });

  return { finalRows, warnings };
}
