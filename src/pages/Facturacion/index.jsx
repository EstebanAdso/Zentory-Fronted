import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getClienteSugerencias, buscarProductos as apiBuscarProductos,
  buscarProductoPorCodigo, crearFactura, crearPrestamo,
} from '../../api';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import {
  abrirVentanaImpresion, abrirVentanaPOS,
  generarFacturaHTMLPDF, generarFacturaHTMLPOS,
  generarPrestamoHTMLPDF, generarPrestamoHTMLPOS,
} from '../../utils/printing';

// ── LocalStorage ───────────────────────────────────────────────────────────
const CLI_FIELDS = ['nombreCliente', 'cedulaNit', 'correoCliente', 'telefonoCliente', 'direccionCliente'];
const LS_PROD = 'productosEnFactura';
const TTL_MS = 20 * 60 * 1000;
const lsGet = k => localStorage.getItem(k) || '';
const lsSet = (k, v) => localStorage.setItem(k, v);
const lsRemove = ks => ks.forEach(k => localStorage.removeItem(k));

// ── Barcode scanner hook ───────────────────────────────────────────────────
function useBarcodeScanner(onDetect) {
  const buf = useRef(''), lastKey = useRef(0);
  useEffect(() => {
    function handler(e) {
      const now = Date.now(), gap = now - lastKey.current;
      lastKey.current = now;
      if (e.key === 'Enter') { const c = buf.current.trim(); buf.current = ''; if (c.length >= 3) onDetect(c); return; }
      if (e.key.length === 1) buf.current = (gap < 50 || buf.current.length > 0) ? buf.current + e.key : e.key;
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDetect]);
}

// ── Shared styles ──────────────────────────────────────────────────────────
// Inputs equivalentes a Bootstrap 4 form-control con font-size: 0.9em
const iSt = {
  width: '100%', border: '1px solid #ced4da', borderRadius: '4px',
  padding: '4px 8px', fontSize: '0.9em', color: '#000',
  backgroundColor: '#fff', boxSizing: 'border-box', outline: 'none',
};
const lSt = { display: 'block', fontSize: '0.9em', marginBottom: '2px' };
// Fieldset igual al original
const fsSt = (extra = {}) => ({
  border: '2px solid rgba(17,22,22,0.15)', borderRadius: '10px',
  padding: '4px 6px', marginBottom: '3px', ...extra,
});
const lgSt = { fontSize: '0.95em', padding: '0 4px' };

// ─────────────────────────────────────────────────────────────────────────────
export default function Facturacion() {
  const [tipDoc, setTipDoc] = useState('FACTURA');
  const [cliente, setCliente] = useState({ nombreCliente: '', cedulaNit: '', telefonoCliente: '', correoCliente: '', direccionCliente: '' });
  const [sugCli, setSugCli] = useState([]); const [showCli, setShowCli] = useState(false);
  const [prod, setProd] = useState({ nombre: '', precio: '', pc: '', cantidad: '1', garantia: '1', descripcion: '' });
  const [prodSel, setProdSel] = useState(null);
  const [verCosto, setVerCosto] = useState(false);
  const [mayoreo, setMayoreo] = useState(false);
  const [maxCant, setMaxCant] = useState(null);
  const [sugProd, setSugProd] = useState([]); const [showProd, setShowProd] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [descGen, setDescGen] = useState('');
  const [abono, setAbono] = useState('');
  const [obs, setObs] = useState('');
  const [confirm, setConfirm] = useState(null);
  const tCli = useRef(null), tProd = useRef(null);

  // ── Load localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    const s = {}; CLI_FIELDS.forEach(f => { s[f] = lsGet(f); }); setCliente(s);
    const stored = localStorage.getItem(LS_PROD);
    if (stored) setCarrito(JSON.parse(stored).map(p => ({ ...p, precioOriginal: p.precioOriginal ?? p.precioUnitario, descuento: p.descuento ?? 0 })));
    const t = setTimeout(() => lsRemove([...CLI_FIELDS, LS_PROD]), TTL_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { localStorage.setItem(LS_PROD, JSON.stringify(carrito)); }, [carrito]);

  // ── Barcode ────────────────────────────────────────────────────────────
  const onBarcode = useCallback(async codigo => {
    toast.info('Buscando producto por código de barras...');
    try {
      const { data } = await buscarProductoPorCodigo(codigo);
      if (!data) { toast.error('Código no registrado'); return; }
      if (data.cantidad === 0) { toast.error('El producto no tiene stock'); return; }
      pickProd(data); toast.success(`Producto "${data.nombre}" seleccionado`);
    } catch { toast.error('El código de barras no se encuentra registrado'); }
  }, []);
  useBarcodeScanner(onBarcode);

  // ── Cliente ────────────────────────────────────────────────────────────
  async function fetchCli(q) {
    if (q.length < 2) { setSugCli([]); setShowCli(false); return; }
    try { const { data } = await getClienteSugerencias(q); setSugCli(data); setShowCli(data.length > 0); } catch { }
  }
  function onNombreCli(e) {
    const v = e.target.value.toUpperCase(); setCliente(p => ({ ...p, nombreCliente: v }));
    clearTimeout(tCli.current); tCli.current = setTimeout(() => fetchCli(v), 150);
  }
  function pickCli(c) {
    const u = { nombreCliente: c.nombre.toUpperCase(), cedulaNit: c.identificacion, correoCliente: c.correo || '', telefonoCliente: c.telefono || '', direccionCliente: c.direccion || '' };
    setCliente(u); CLI_FIELDS.forEach(f => lsSet(f, u[f])); setSugCli([]); setShowCli(false);
  }

  // ── Producto ───────────────────────────────────────────────────────────
  async function fetchProd(q) {
    if (q.length < 3) { setSugProd([]); setShowProd(false); return; }
    setProdSel(null);
    try {
      const { data } = await apiBuscarProductos(q);
      if (Array.isArray(data) && data.length > 0) { setSugProd(data); setShowProd(true); }
      else { setSugProd([]); setShowProd(false); }
    } catch { }
  }
  function onNombreProd(e) {
    const v = e.target.value; setProd(p => ({ ...p, nombre: v })); setProdSel(null);
    clearTimeout(tProd.current); tProd.current = setTimeout(() => fetchProd(v), 200);
  }
  function pickProd(p) {
    const usaMay = mayoreo && p.precioMayorista > 0;
    const precio = usaMay ? p.precioMayorista : p.precioVendido;
    setProd(prev => ({ ...prev, nombre: p.nombre, precio: formatNumber(precio), pc: formatNumber(p.precioComprado), garantia: String(p.garantia || 1) }));
    setMaxCant(p.cantidad); setProdSel(p); setSugProd([]); setShowProd(false);
  }
  function onMayoreo(checked) {
    setMayoreo(checked);
    if (prodSel) { const precio = checked && prodSel.precioMayorista > 0 ? prodSel.precioMayorista : prodSel.precioVendido; setProd(p => ({ ...p, precio: formatNumber(precio) })); }
  }

  // ── Carrito ────────────────────────────────────────────────────────────
  function agregar() {
    if (!prodSel) { toast.error('No se seleccionó un producto válido. Verifica que el producto exista.'); return; }
    const cant = parseInt(prod.cantidad), precio = parseFormattedNumber(prod.precio), pc = parseFormattedNumber(prod.pc), gar = parseInt(prod.garantia) || 1;
    if (cant > (maxCant ?? Infinity)) { toast.error(`La cantidad (${cant}) supera la máxima disponible (${maxCant}).`); return; }
    if (!prod.nombre || isNaN(cant) || isNaN(precio) || isNaN(pc)) { toast.error('No se seleccionó un producto válido.'); return; }
    setCarrito(p => [...p, { id: prodSel.id, nombre: prod.nombre, cantidad: cant, precioOriginal: precio, precioUnitario: precio, garantia: gar, descripcion: prod.descripcion || '', total: cant * precio, pc, descuento: 0 }]);
    limpiarProd();
  }
  function eliminar(idx) { setCarrito(p => p.filter((_, i) => i !== idx)); }
  function editar(idx) {
    const item = carrito[idx];
    setProd({ nombre: item.nombre, precio: formatNumber(item.precioOriginal), pc: formatNumber(item.pc), cantidad: String(item.cantidad), garantia: String(item.garantia), descripcion: item.descripcion });
    setProdSel({ id: item.id, nombre: item.nombre, precioVendido: item.precioOriginal, precioComprado: item.pc, cantidad: 9999 });
    setCarrito(p => p.filter((_, i) => i !== idx));
  }
  function descInd(idx, pct) {
    if (pct < 0) pct = 0; if (pct > 20) { pct = 20; toast.error('El descuento no puede ser mayor al 20%'); }
    setCarrito(p => p.map((item, i) => { if (i !== idx) return item; const pr = item.precioOriginal * (1 - pct / 100); return { ...item, descuento: pct, precioUnitario: pr, total: pr * item.cantidad }; }));
  }
  function applyDescGen() {
    const pct = parseFloat(descGen);
    if (isNaN(pct) || pct <= 0) { toast.error('Ingrese un porcentaje válido'); return; }
    if (pct > 20) { toast.error('El descuento no puede ser mayor al 20%'); return; }
    if (carrito.length === 0) { toast.error('No hay productos en la factura'); return; }
    setCarrito(p => p.map(item => { const pr = item.precioOriginal * (1 - pct / 100); return { ...item, descuento: pct, precioUnitario: pr, total: pr * item.cantidad }; }));
    setDescGen(''); toast.success(`Descuento del ${pct}% aplicado a todos los productos`);
  }
  function removeDescGen() {
    if (!carrito.some(p => p.descuento > 0)) { toast.info('No hay descuentos aplicados'); return; }
    setCarrito(p => p.map(item => ({ ...item, descuento: 0, precioUnitario: item.precioOriginal, total: item.precioOriginal * item.cantidad })));
    setDescGen(''); toast.success('Descuentos eliminados de todos los productos');
  }

  const totalCarrito = carrito.reduce((s, p) => s + p.total, 0);
  const totalOriginal = carrito.reduce((s, p) => s + p.precioOriginal * p.cantidad, 0);
  const montoDesc = totalOriginal - totalCarrito;

  function limpiarProd() {
    setProd({ nombre: '', precio: '', pc: '', cantidad: '1', garantia: '1', descripcion: '' });
    setProdSel(null); setMaxCant(null); setMayoreo(false); setSugProd([]); setShowProd(false);
  }
  function limpiarTodo() {
    setCliente({ nombreCliente: '', cedulaNit: '', telefonoCliente: '', correoCliente: '', direccionCliente: '' });
    limpiarProd(); setCarrito([]); setDescGen(''); setAbono(''); setObs(''); setTipDoc('FACTURA');
    lsRemove([...CLI_FIELDS, LS_PROD]);
  }
  function validar() {
    if (!cliente.nombreCliente.trim() || !cliente.cedulaNit.trim()) { toast.error('El nombre y la identificación son obligatorios.'); return false; }
    if (carrito.length === 0) { toast.error('Agrega al menos un producto.'); return false; }
    if (parseFloat(descGen) > 0) { toast.error('Tienes un descuento por aplicar. Aplícalo o quítalo antes de imprimir.'); return false; }
    return true;
  }
  function confirmSinAgregar(cb) {
    if (prod.nombre.trim().length > 0) setConfirm({ mensaje: 'Tienes un producto sin agregar al carrito. ¿Deseas continuar?', onAceptar: () => { setConfirm(null); cb(); } });
    else cb();
  }

  // ── Payloads ───────────────────────────────────────────────────────────
  const mkFact = fecha => ({ clienteNombre: cliente.nombreCliente, clienteCedula: cliente.cedulaNit, telefono: cliente.telefonoCliente || null, correo: cliente.correoCliente || null, direccion: cliente.direccionCliente || null, fechaCreacion: fecha, detalles: carrito.map(p => ({ productoId: p.id || '', nombreProducto: p.nombre, cantidad: p.cantidad, precioVenta: p.precioUnitario, garantia: `${p.garantia} Mes.`, descripcion: p.descripcion || '', precioCompra: p.pc || null })) });
  const mkPrest = ab => ({ clienteNombre: cliente.nombreCliente, clienteCedula: cliente.cedulaNit, telefono: cliente.telefonoCliente || null, correo: cliente.correoCliente || null, direccion: cliente.direccionCliente || null, tipo: tipDoc, observaciones: obs || null, abonoInicial: ab > 0 ? ab : null, metodoPagoAbono: ab > 0 ? 'EFECTIVO' : null, detalles: carrito.map(p => ({ productoId: p.id || null, nombreProducto: p.nombre, cantidad: p.cantidad, precioVenta: p.precioUnitario, garantia: `${p.garantia} Mes.`, descripcion: p.descripcion || '', precioCompra: p.pc || null })) });
  const hPOS = items => items.map(p => `<tr style="font-size:12px;color:#000"><td style="padding:1px 0;text-align:left;max-width:20mm;word-wrap:break-word;">${p.nombre.toUpperCase()} - ${p.descripcion || ''}</td><td style="text-align:center;">${p.cantidad}</td><td style="text-align:center;">${p.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td><td style="text-align:center;">${p.garantia} Mes</td><td style="text-align:center;">${p.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td></tr>`).join('');
  const hPDF = items => items.map(p => `<tr><td style="border:1px solid #ddd;padding:8px;">${p.nombre.toUpperCase()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${p.cantidad}</td><td style="border:1px solid #ddd;padding:8px;text-align:right;">${p.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td><td style="border:1px solid #ddd;padding:8px;">${p.garantia} Mes</td><td style="border:1px solid #ddd;padding:8px;">${p.descripcion || 'Excelente calidad'}</td><td style="border:1px solid #ddd;padding:8px;text-align:right;">${p.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td></tr>`).join('');

  // ── Actions ────────────────────────────────────────────────────────────
  async function accionFact(fn) {
    confirmSinAgregar(async () => {
      if (!validar()) return;
      const total = carrito.reduce((s, p) => s + p.total, 0);
      try { await fn(total); limpiarTodo(); } catch (e) { toast.error(`Error: ${e.response?.data || e.message}`); }
    });
  }
  function validarApartado(total, ab) {
    if (tipDoc === 'APARTADO') {
      if (!ab || ab <= 0) { toast.error('El abono inicial es obligatorio para apartados.'); return false; }
      if (ab > total) { toast.error('El abono inicial no puede ser mayor al total.'); return false; }
    }
    return true;
  }

  async function imprimirPOS() {
    accionFact(async total => {
      const fecha = new Date().toLocaleString('es-CO'), { data } = await crearFactura(mkFact(fecha));
      abrirVentanaPOS(generarFacturaHTMLPOS({ facturaId: data.id, nombreCliente: cliente.nombreCliente, cedulaNit: cliente.cedulaNit, telefonoCliente: cliente.telefonoCliente, correoCliente: cliente.correoCliente, direccionCliente: cliente.direccionCliente, productosHTML: hPOS(carrito), totalFactura: total, fechaActual: fecha }));
    });
  }
  async function guardarPDF() {
    accionFact(async total => {
      const fecha = new Date().toLocaleDateString('es-CO'), { data } = await crearFactura(mkFact(fecha));
      abrirVentanaImpresion(generarFacturaHTMLPDF({ facturaId: data.id, nombreCliente: cliente.nombreCliente, cedulaNit: cliente.cedulaNit, telefonoCliente: cliente.telefonoCliente, correoCliente: cliente.correoCliente, direccionCliente: cliente.direccionCliente, productosHTML: hPDF(carrito), totalFactura: total, fechaActual: fecha }));
    });
  }
  async function imprimirPOSPrest() {
    accionFact(async total => {
      const ab = parseFormattedNumber(abono); if (!validarApartado(total, ab)) return;
      const { data } = await crearPrestamo(mkPrest(ab));
      const fecha = new Date(data.fechaCreacion).toLocaleString('es-CO');
      const ph = carrito.map(p => `<tr style="font-size:11px;"><td>${p.nombre}</td><td style="text-align:center;">${p.cantidad}</td><td style="text-align:center;">${p.precioUnitario.toLocaleString('es-CO')}</td><td style="text-align:center;">${p.total.toLocaleString('es-CO')}</td></tr>`).join('');
      abrirVentanaPOS(generarPrestamoHTMLPOS({ prestamoId: data.serial, tipoDocumento: data.tipo, nombreCliente: cliente.nombreCliente, cedulaNit: cliente.cedulaNit, telefonoCliente: cliente.telefonoCliente, productosHTML: ph, totalPrestamo: data.total, totalAbonado: data.totalAbonado, saldoPendiente: data.saldoPendiente, fechaActual: fecha, observaciones: data.observaciones }));
    });
  }
  async function guardarPDFPrest() {
    accionFact(async total => {
      const ab = parseFormattedNumber(abono); if (!validarApartado(total, ab)) return;
      const { data } = await crearPrestamo(mkPrest(ab));
      const fecha = new Date(data.fechaCreacion).toLocaleString('es-CO');
      abrirVentanaImpresion(generarPrestamoHTMLPDF({ prestamoId: data.serial, tipoDocumento: data.tipo, nombreCliente: cliente.nombreCliente, cedulaNit: cliente.cedulaNit, telefonoCliente: cliente.telefonoCliente, correoCliente: cliente.correoCliente, direccionCliente: cliente.direccionCliente, productosHTML: hPDF(carrito), totalPrestamo: data.total, totalAbonado: data.totalAbonado, saldoPendiente: data.saldoPendiente, fechaActual: fecha, observaciones: data.observaciones, abonosHTML: '' }));
    });
  }

  const esPrest = tipDoc !== 'FACTURA';
  const titulo = tipDoc === 'FACTURA' ? 'Facturación' : tipDoc === 'PRESTAMO' ? 'Préstamo (Fiado)' : 'Apartado (Separar)';

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        Layout: empieza justo bajo el nav (55px), ocupa el resto del viewport.
        Ancho 100%. Overflow hidden → sin scroll exterior.
        Dos columnas flexbox que llenan el alto disponible.
      */}
      <div style={{ paddingTop: '55px', height: '100vh', width: '96%', maxWidth: '1500px', margin: '0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Two-column row: fills all remaining height ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            borderRight: '2px solid rgba(17,22,22,0.1)',
            padding: '0 10px', overflowY: 'auto', minHeight: 0,
          }}>
            <h1 style={{ fontSize: '2em', textAlign: 'center', userSelect: 'none', margin: '10px 0 4px 0', flexShrink: 0 }}>
              {titulo}
            </h1>

            {/* ── Tipo de documento ── */}
            <fieldset style={fsSt({ flexShrink: 0 })}>
              <legend style={lgSt}>Tipo de Documento</legend>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Tipo de Documento</label>
                  <select style={iSt} value={tipDoc} onChange={e => setTipDoc(e.target.value)}>
                    <option value="FACTURA">Factura Normal</option>
                    <option value="PRESTAMO">Préstamo (Fiado)</option>
                    <option value="APARTADO">Apartado (Separar producto)</option>
                  </select>
                </div>
                {tipDoc === 'APARTADO' && (
                  <div style={{ flex: 1 }}>
                    <label style={lSt}>Abono Inicial:</label>
                    <input type="text" style={iSt} placeholder="$0" autoComplete="off" value={abono} onChange={e => setAbono(e.target.value)} />
                  </div>
                )}
              </div>
              {esPrest && (
                <div style={{ marginTop: '3px' }}>
                  <label style={lSt}>Observaciones:</label>
                  <textarea style={{ ...iSt, resize: 'none' }} rows={1} placeholder="Notas adicionales..." value={obs} onChange={e => setObs(e.target.value)} />
                </div>
              )}
            </fieldset>

            {/* ── Datos del cliente ── */}
            <fieldset style={fsSt({ flexShrink: 0 })}>
              <legend style={lgSt}>Datos del Cliente</legend>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <div style={{ flex: '0 0 58%', position: 'relative' }}>
                  <label style={lSt}>Nombre del Cliente:</label>
                  <input type="text" style={iSt} placeholder="Obligatorio" autoComplete="off"
                    value={cliente.nombreCliente} onChange={onNombreCli}
                    onBlur={() => lsSet('nombreCliente', cliente.nombreCliente)} />
                  {showCli && (
                    <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #ddd', listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {sugCli.map((c, i) => (
                        <li key={i} onMouseDown={() => pickCli(c)}
                          style={{ padding: '6px 8px', cursor: 'pointer', fontSize: '0.9em' }}
                          className="hover:bg-gray-100">{c.nombre.toUpperCase()}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Cédula o NIT:</label>
                  <input type="number" style={iSt} placeholder="Obligatorio" autoComplete="off"
                    value={cliente.cedulaNit} onChange={e => setCliente(p => ({ ...p, cedulaNit: e.target.value }))}
                    onBlur={() => lsSet('cedulaNit', cliente.cedulaNit)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Teléfono:</label>
                  <input type="number" style={iSt} placeholder="Opcional" autoComplete="off"
                    value={cliente.telefonoCliente} onChange={e => setCliente(p => ({ ...p, telefonoCliente: e.target.value }))}
                    onBlur={() => lsSet('telefonoCliente', cliente.telefonoCliente)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Dirección:</label>
                  <input type="text" style={iSt} placeholder="Opcional" autoComplete="off"
                    value={cliente.direccionCliente} onChange={e => setCliente(p => ({ ...p, direccionCliente: e.target.value }))}
                    onBlur={() => lsSet('direccionCliente', cliente.direccionCliente)} />
                </div>
              </div>
              <div>
                <label style={lSt}>Correo Electrónico:</label>
                <input type="email" style={iSt} placeholder="Opcional" autoComplete="off"
                  value={cliente.correoCliente} onChange={e => setCliente(p => ({ ...p, correoCliente: e.target.value }))}
                  onBlur={() => lsSet('correoCliente', cliente.correoCliente)} />
              </div>
            </fieldset>

            {/* ── Datos de facturación ── */}
            <fieldset style={fsSt({ flexShrink: 0 })}>
              <legend style={lgSt}>Datos de Facturación</legend>
              {/* Nombre producto + ver costo */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <div style={{ flex: '0 0 66%', position: 'relative' }}>
                  <label style={lSt}>Nombre del Producto:</label>
                  <input type="text" style={iSt} autoComplete="off" value={prod.nombre} onChange={onNombreProd} />
                  {showProd && (
                    <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #ddd', listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {sugProd.map((p, i) => (
                        <li key={i} onMouseDown={() => pickProd(p)}
                          style={{ padding: '5px 8px', cursor: 'pointer', fontSize: '0.85em', borderBottom: '1px solid #eee' }}
                          className="hover:bg-gray-100">
                          <span style={{ fontWeight: 500 }}>{p.nombre.toUpperCase()}</span>
                          <i style={{ color: '#666' }}> || P.C <span style={{ color: 'red' }}>${formatNumber(p.precioComprado)}</span></i>
                          <i style={{ color: '#666' }}> || P.V ${formatNumber(p.precioVendido)}</i>
                          {p.precioMayorista > 0 && <i style={{ color: 'blue' }}> || MAY ${formatNumber(p.precioMayorista)}</i>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                    <input type="checkbox" id="verCosto" checked={verCosto} onChange={e => setVerCosto(e.target.checked)} style={{ cursor: 'pointer' }} />
                    <label htmlFor="verCosto" style={{ fontSize: '0.85em', cursor: 'pointer', userSelect: 'none' }}>Ver costo</label>
                  </div>
                  <input type="text" style={{ ...iSt, WebkitTextSecurity: verCosto ? 'none' : 'disc' }} autoComplete="off"
                    value={prod.pc} onChange={e => setProd(p => ({ ...p, pc: e.target.value }))} />
                </div>
              </div>
              {/* Precio + Cantidad + Garantía */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Precio Venta:</label>
                  <input type="text" style={iSt} autoComplete="off" value={prod.precio} onChange={e => setProd(p => ({ ...p, precio: e.target.value }))} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                    <input type="checkbox" id="mayoreo" checked={mayoreo} onChange={e => onMayoreo(e.target.checked)} style={{ cursor: 'pointer' }} />
                    <label htmlFor="mayoreo" style={{ fontSize: '0.85em', cursor: 'pointer', userSelect: 'none' }}>Mayoreo</label>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Cantidad:</label>
                  <input type="number" style={iSt} min="1" max={maxCant ?? undefined} autoComplete="off"
                    value={prod.cantidad} onChange={e => setProd(p => ({ ...p, cantidad: e.target.value }))} />
                  {maxCant !== null && <p style={{ color: 'red', fontSize: '0.85em', margin: '2px 0 0' }}>Cantidad máxima disponible: {maxCant}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lSt}>Garantía (meses):</label>
                  <input type="number" style={iSt} autoComplete="off" value={prod.garantia} onChange={e => setProd(p => ({ ...p, garantia: e.target.value }))} />
                </div>
              </div>
              {/* Descripción */}
              <div style={{ marginBottom: '3px' }}>
                <label style={lSt}>Descripción:</label>
                <textarea style={{ ...iSt, resize: 'none' }} rows={1} placeholder="Opcional" autoComplete="off"
                  value={prod.descripcion} onChange={e => setProd(p => ({ ...p, descripcion: e.target.value.toUpperCase() }))} />
              </div>
              {/* Agregar / Limpiar */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                <button onClick={agregar}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded"
                  style={{ letterSpacing: '1px', fontSize: '0.9em', padding: '6px 12px', flex: 1 }}>
                  Agregar
                </button>
                <button onClick={limpiarProd}
                  className="bg-gray-500 hover:bg-gray-600 text-white rounded"
                  style={{ letterSpacing: '1px', fontSize: '0.9em', padding: '6px 12px', flex: 1 }}>
                  Limpiar
                </button>
              </div>
            </fieldset>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            <h2 style={{ fontSize: '1.3em', fontWeight: 600, textAlign: 'center', userSelect: 'none', margin: '10px 0 4px', flexShrink: 0 }}>
              Productos seleccionados
            </h2>

            {/* Table area — scrolls internally if needed */}
            <div style={{ overflowY: 'auto', padding: '0 8px', minHeight: 0 }}>
              <h5 style={{ fontSize: '1em', marginBottom: '4px' }}> Tabla de Productos Seleccionados</h5>
              <table className="factura-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #dee2e6', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f3f5' }}>
                    {['Nombre', 'Cant.', 'Precio', 'Dcto%', 'Gtía', 'Descripción', 'Total', 'Acciones'].map(h => (
                      <th key={h} style={{ border: '1px solid #dee2e6', padding: '5px 6px', fontWeight: 600, fontSize: '0.88em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item, idx) => (
                    <tr key={idx} style={item.descuento > 0 ? { backgroundColor: '#d4edda', borderLeft: '2px solid #28a745' } : {}}>
                      <td style={{ border: '1px solid #dee2e6', padding: '5px 6px', width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <div title={item.nombre} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'help', lineHeight: '1.2' }}>
                          {item.nombre}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '5px 6px', textAlign: 'center' }}>{item.cantidad}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '5px 6px', textAlign: 'right' }}>{item.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '3px', textAlign: 'center' }}>
                        <input type="number" min="0" max="20"
                          style={{ width: '52px', fontSize: '0.8em', padding: '2px 4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px' }}
                          value={item.descuento} onChange={e => descInd(idx, parseFloat(e.target.value) || 0)} />
                      </td>
                      <td style={{ border: '1px solid #dee2e6', padding: '5px 6px', textAlign: 'center' }}>{item.garantia}</td>
                      <td title={item.descripcion} style={{ border: '1px solid #dee2e6', padding: '5px 6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>{item.descripcion}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '5px 6px', textAlign: 'right', fontWeight: 500 }}>{item.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '3px 5px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => eliminar(idx)} className="bg-red-600 hover:bg-red-700 text-white rounded"
                          style={{ fontSize: '0.8em', padding: '2px 7px', marginRight: '2px' }}>Eliminar</button>
                        <button onClick={() => editar(idx)} className="bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                          style={{ fontSize: '0.8em', padding: '2px 7px' }}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total + descuento general — fixed at bottom of right col */}
            <div style={{ flexShrink: 0, padding: '4px 8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <h6 style={{ margin: 0, fontSize: '0.95em', fontWeight: 'bold' }}>
                  TOTAL: <span style={{ color: 'red' }}>${totalCarrito.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </h6>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <small style={{ fontSize: '0.8em', color: '#6c757d' }}>Dcto a todos:</small>
                  <input type="number" min="0" max="20" placeholder="0" autoComplete="off"
                    style={{ width: '50px', fontSize: '0.8em', padding: '2px 5px', border: '1px solid #ccc', borderRadius: '4px' }}
                    value={descGen} onChange={e => setDescGen(e.target.value)} />
                  <small style={{ fontSize: '0.8em', color: '#6c757d' }}>%</small>
                  <button onClick={applyDescGen} title="Aplicar a todos"
                    className="bg-green-600 hover:bg-green-700 text-white rounded"
                    style={{ fontSize: '0.75em', padding: '2px 8px' }}>✓</button>
                  <button onClick={removeDescGen} title="Quitar descuento"
                    className="bg-gray-500 hover:bg-gray-600 text-white rounded"
                    style={{ fontSize: '0.75em', padding: '2px 8px' }}>✕</button>
                </div>
              </div>
              {montoDesc > 0 && (
                <small style={{ color: '#28a745', fontSize: '0.8em', marginLeft: '4px' }}>
                  Descuento total: -${montoDesc.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </small>
              )}
            </div>

            {/* ── Botones de impresión — idénticos al original */}
            <div style={{ flexShrink: 0, textAlign: 'center', margin: 0, padding: '8px 0 14px' }}>
              {!esPrest ? (
                <>
                  <button onClick={imprimirPOS} className="bg-green-600 hover:bg-green-700 text-white rounded"
                    style={{ width: '300px', letterSpacing: '2px', padding: '6px 12px', marginRight: '4px' }}>
                    Imprimir Pos
                  </button>
                  <button onClick={guardarPDF} className="border border-red-500 text-red-600 hover:bg-red-50 rounded bg-white"
                    style={{ letterSpacing: '1px', padding: '6px 12px', marginRight: '4px' }}>
                    Guardar Factura PDF
                  </button>
                  <button onClick={limpiarTodo} className="bg-gray-800 hover:bg-gray-900 text-white rounded"
                    style={{ letterSpacing: '1px', padding: '6px 12px' }}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={imprimirPOSPrest} className="bg-yellow-500 hover:bg-yellow-600 text-white rounded"
                    style={{ width: '300px', letterSpacing: '2px', padding: '6px 12px', marginRight: '4px' }}>
                    Imprimir Pos
                  </button>
                  <button onClick={guardarPDFPrest} className="border border-yellow-500 text-yellow-700 hover:bg-yellow-50 rounded bg-white"
                    style={{ letterSpacing: '1px', padding: '6px 12px', marginRight: '4px' }}>
                    Guardar Factura PDF
                  </button>
                  <button onClick={limpiarTodo} className="bg-gray-800 hover:bg-gray-900 text-white rounded"
                    style={{ letterSpacing: '1px', padding: '6px 12px' }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal open={!!confirm} mensaje={confirm?.mensaje || ''} textoAceptar="Aceptar" textoCancelar="Volver"
        onAceptar={confirm?.onAceptar} onCancelar={() => setConfirm(null)} />
    </>
  );
}
