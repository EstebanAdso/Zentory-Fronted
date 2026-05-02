// ── Números / dinero (Colombia) ───────────────────────────────────────────
// Formato: punto como separador de miles, sin decimales. Ej: 10.000 · 3.000.000

export const formatNumber = (number) =>
  Number(number || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

// Alias semántico para precios en pesos colombianos.
export const formatMoney = formatNumber;

// "$10.000"
export const formatMoneyCOP = (n) => `$${formatNumber(n)}`;

// Convierte "10.000" / "$10.000" / "10.000,50" → 10000
export const parseFormattedNumber = (str) =>
  parseFloat(String(str ?? '').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '')) || 0;

// Toma el input crudo del usuario y lo devuelve con separadores de miles
// auto aplicados. Ej: "500000" → "500.000", "abc" → "", "1.234" → "1.234"
export const formatMoneyInput = (str) => {
  const digits = String(str ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('es-CO');
};

// Handler reutilizable para <input type="text" inputMode="numeric"> de dinero.
// Uso:
//   <input onChange={onChangeMoney(setForm, 'precio')} />
//   <input onChange={onChangeMoney(setAbono)} />  // setter directo
export const onChangeMoney = (setter, field) => (e) => {
  const formatted = formatMoneyInput(e.target.value);
  if (field) {
    setter((prev) => ({ ...prev, [field]: formatted }));
  } else {
    setter(formatted);
  }
};

export const formatearFecha = (fecha) => {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
