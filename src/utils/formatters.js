export const formatNumber = (number) =>
  Number(number).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export const formatearFecha = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const parseFormattedNumber = (str) =>
  parseFloat(String(str).replace(/\./g, '').replace(/,/g, '')) || 0;
