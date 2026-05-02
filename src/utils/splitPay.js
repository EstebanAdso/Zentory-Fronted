// Utilidades para split-pay (pagos divididos en varias cuentas de recaudo).
// Estructura del estado: `pagos` es un objeto { [cuentaId]: montoString } donde
// las claves son las cuentas seleccionadas y los valores el monto formateado.

import { formatNumber, parseFormattedNumber } from './formatters';

/**
 * Auto-completa la cuenta "vacía" con el restante cuando exactamente una
 * queda sin monto. Devuelve el nuevo mapa y el id del slot auto-completado
 * (o null si ninguno se autocompletó).
 *
 * @param {Object} map         Estado actual { [id]: montoString }
 * @param {number} total       Monto total a cubrir
 * @param {string|number|null} currentAutoId  Id que estaba auto previamente
 * @param {string|number|null} editedId       Id que el usuario acaba de editar
 *                                           (no será candidato a auto)
 */
export function applyAutoFill(map, total, currentAutoId, editedId) {
  const ids = Object.keys(map);
  if (ids.length < 2) return { map, autoId: null };
  const isEmpty = (k) => !map[k] || parseFormattedNumber(map[k]) === 0;
  const candidatos = ids.filter(
    (k) => k !== String(editedId) && (isEmpty(k) || k === String(currentAutoId))
  );
  if (candidatos.length !== 1) return { map, autoId: null };
  const target = candidatos[0];
  const sumOtros = ids
    .filter((k) => k !== target)
    .reduce((s, k) => s + (parseFormattedNumber(map[k]) || 0), 0);
  const restante = total - sumOtros;
  if (restante <= 0) return { map: { ...map, [target]: '' }, autoId: null };
  return { map: { ...map, [target]: formatNumber(restante) }, autoId: target };
}

/**
 * Distribuye `total` en partes iguales entre las cuentas seleccionadas.
 * El sobrante (resto de la división entera) se asigna a la primera cuenta.
 * Devuelve un nuevo mapa con los montos ya formateados.
 */
export function distribuirEqual(pagos, total) {
  const ids = Object.keys(pagos);
  if (ids.length === 0) return pagos;
  const base = Math.floor(total / ids.length);
  const sobrante = total - base * ids.length;
  const nuevo = {};
  ids.forEach((id, i) => {
    nuevo[id] = formatNumber(base + (i === 0 ? sobrante : 0));
  });
  return nuevo;
}

/**
 * Calcula la lista de pagos normalizada para enviar al backend.
 * - Si hay una sola cuenta, asigna el total redondeado a esa cuenta.
 * - Si hay varias, usa los montos ingresados.
 */
export function normalizarPagos(pagos, total) {
  const ids = Object.keys(pagos);
  const totalRedondeado = Math.round(total);
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    return [{ cuentaRecaudoId: Number(ids[0]), monto: totalRedondeado }];
  }
  return ids.map((id) => ({
    cuentaRecaudoId: Number(id),
    monto: parseFormattedNumber(pagos[id]) || 0,
  }));
}
