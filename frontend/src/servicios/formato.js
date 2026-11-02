/** Utilidades de formato para pesos colombianos y fechas. */

const FORMATO_PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** 185000 → "$ 185.000" */
export function pesos(valor) {
  return FORMATO_PESOS.format(Number(valor) || 0);
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function fecha(valor) {
  if (!valor) return '—';
  return FORMATO_FECHA.format(new Date(valor));
}

/** Porcentaje de descuento entre el precio de lista y el de oferta. */
export function descuento(precio, precioOferta) {
  if (!precioOferta || precioOferta >= precio) return 0;
  return Math.round(((precio - precioOferta) / precio) * 100);
}
