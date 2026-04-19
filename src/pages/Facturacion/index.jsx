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
import {
  ShoppingBag, Plus, Trash2, Edit, Search, Tag, FileSignature,
  Printer, FileText, XCircle, Eraser, Receipt, Eye, EyeOff,
} from 'lucide-react';

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
      const tag = e.target?.tagName;
      const editable = e.target?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;
      const now = Date.now(), gap = now - lastKey.current;
      lastKey.current = now;
      if (e.key === 'Enter') { const c = buf.current.trim(); buf.current = ''; if (c.length >= 3) onDetect(c); return; }
      if (e.key.length === 1) buf.current = (gap < 50 || buf.current.length > 0) ? buf.current + e.key : e.key;
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDetect]);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Facturacion() {
  const [tipDoc, setTipDoc] = useState('FACTURA');
  const [esPrest, setEsPrest] = useState(false);
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

  useEffect(() => {
    const s = {}; CLI_FIELDS.forEach(f => { s[f] = lsGet(f); }); setCliente(s);
    const stored = localStorage.getItem(LS_PROD);
    if (stored) setCarrito(JSON.parse(stored).map(p => ({ ...p, precioOriginal: p.precioOriginal ?? p.precioUnitario, descuento: p.descuento ?? 0 })));
    const t = setTimeout(() => lsRemove([...CLI_FIELDS, LS_PROD]), TTL_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { localStorage.setItem(LS_PROD, JSON.stringify(carrito)); }, [carrito]);

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

  const clearFields = () => {
    setProd({ nombre: '', precio: '', cantidad: '1', pc: '', garantia: '1', descripcion: '' });
    setProdSel(null);
    setVerCosto(false);
    setMayoreo(false);
  };

  function agregar() {
    if (!prodSel) { toast.error('No se seleccionó un producto válido. Verifica que el producto exista.'); return; }
    const cant = parseInt(prod.cantidad), precio = parseFormattedNumber(prod.precio), pc = parseFormattedNumber(prod.pc), gar = parseInt(prod.garantia) || 1;
    if (cant > (maxCant ?? Infinity)) { toast.error(`La cantidad (${cant}) supera la máxima disponible (${maxCant}).`); return; }
    if (!prod.nombre || isNaN(cant) || isNaN(precio) || isNaN(pc)) { toast.error('No se seleccionó un producto válido.'); return; }
    setCarrito(p => [...p, { id: prodSel.id, nombre: prod.nombre, cantidad: cant, precioOriginal: precio, precioUnitario: precio, garantia: gar, descripcion: prod.descripcion || '', total: cant * precio, pc, descuento: 0 }]);
    limpiarProd();
  }
  function eliminar(idx) { setCarrito(p => p.filter((_, i) => i !== idx)); }
  function applyDescGen() {
    const pct = parseFloat(descGen);
    if (isNaN(pct) || pct <= 0) { toast.error('Ingrese un porcentaje válido'); return; }
    if (pct > 20) { toast.error('El descuento no puede ser mayor al 20%'); return; }
    if (carrito.length === 0) { toast.error('No hay productos en la factura'); return; }
    setCarrito(p => p.map(item => { const pr = item.precioOriginal * (1 - pct / 100); return { ...item, descuento: pct, precioUnitario: pr, total: pr * item.cantidad }; }));
    setDescGen(''); toast.success(`Descuento del ${pct}% aplicado a todos los productos`);
  }
  function removeDescGen() {
    setCarrito(p => p.map(item => ({ ...item, descuento: 0, precioUnitario: item.precioOriginal, total: item.precioOriginal * item.cantidad })));
    setDescGen('');
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + item.total, 0) * (1 - (parseFloat(descGen) || 0) / 100);
  const totalSinDesc = carrito.reduce((acc, item) => acc + (item.precioOriginal * item.cantidad), 0);
  const ahorroTotal = totalSinDesc - totalCarrito;

  function limpiarProd() {
    setProd({ nombre: '', precio: '', pc: '', cantidad: '1', garantia: '1', descripcion: '' });
    setProdSel(null); setMaxCant(null); setMayoreo(false); setSugProd([]); setShowProd(false);
  }
  function limpiarTodo() {
    setCliente({ nombreCliente: '', cedulaNit: '', telefonoCliente: '', correoCliente: '', direccionCliente: '' });
    limpiarProd(); setCarrito([]); setDescGen(''); setAbono(''); setObs(''); setTipDoc('FACTURA'); setEsPrest(false);
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

  const mkFact = fecha => ({ clienteNombre: cliente.nombreCliente, clienteCedula: cliente.cedulaNit, telefono: cliente.telefonoCliente || null, correo: cliente.correoCliente || null, direccion: cliente.direccionCliente || null, fechaCreacion: fecha, detalles: carrito.map(p => ({ productoId: p.id || '', nombreProducto: p.nombre, cantidad: p.cantidad, precioVenta: p.precioUnitario, garantia: `${p.garantia} Mes.`, descripcion: p.descripcion || '', precioCompra: p.pc || null })) });
  const mkPrest = ab => ({ clienteNombre: cliente.nombreCliente, clienteCedula: cliente.cedulaNit, telefono: cliente.telefonoCliente || null, correo: cliente.correoCliente || null, direccion: cliente.direccionCliente || null, tipo: tipDoc, observaciones: obs || null, abonoInicial: ab > 0 ? ab : null, metodoPagoAbono: ab > 0 ? 'EFECTIVO' : null, detalles: carrito.map(p => ({ productoId: p.id || null, nombreProducto: p.nombre, cantidad: p.cantidad, precioVenta: p.precioUnitario, garantia: `${p.garantia} Mes.`, descripcion: p.descripcion || '', precioCompra: p.pc || null })) });
  const hPOS = items => items.map(p => `<tr style="font-size:12px;color:#000"><td style="padding:1px 0;text-align:left;max-width:20mm;word-wrap:break-word;">${p.nombre.toUpperCase()} - ${p.descripcion || ''}</td><td style="text-align:center;">${p.cantidad}</td><td style="text-align:center;">${p.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td><td style="text-align:center;">${p.garantia} Mes</td><td style="text-align:center;">${p.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td></tr>`).join('');
  const hPDF = items => items.map(p => `<tr><td style="border:1px solid #ddd;padding:8px;">${p.nombre.toUpperCase()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center;">${p.cantidad}</td><td style="border:1px solid #ddd;padding:8px;text-align:right;">${p.precioUnitario.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td><td style="border:1px solid #ddd;padding:8px;">${p.garantia} Mes</td><td style="border:1px solid #ddd;padding:8px;">${p.descripcion || 'Excelente calidad'}</td><td style="border:1px solid #ddd;padding:8px;text-align:right;">${p.total.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td></tr>`).join('');

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

  const titulo = tipDoc === 'FACTURA' ? 'Facturación' : tipDoc === 'PRESTAMO' ? 'Préstamo (Fiado)' : 'Apartado (Separar)';

  function editar(idx) {
    const item = carrito[idx];
    setProd({ nombre: item.nombre, precio: formatNumber(item.precioOriginal), pc: formatNumber(item.pc), cantidad: String(item.cantidad), garantia: String(item.garantia), descripcion: item.descripcion });
    setProdSel({ id: item.id, nombre: item.nombre, precioVendido: item.precioOriginal, precioComprado: item.pc, cantidad: 9999 });
    setCarrito(p => p.filter((_, i) => i !== idx));
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-4">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt size={26} className="text-[#4488ee]" /> {titulo}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {carrito.length === 0 ? 'Comienza agregando productos al carrito' : `${carrito.length} ${carrito.length === 1 ? 'producto' : 'productos'} en el carrito · Total $${formatNumber(Math.round(totalCarrito))}`}
            </p>
          </div>
          <button
            onClick={limpiarTodo}
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            <XCircle size={14} /> Limpiar Todo
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 gap-6 max-w-[1800px] mx-auto">

          {/* ── LEFT COLUMN: ENTRY ── */}
          <div className="h-full overflow-y-auto pr-1 space-y-4 scroll-custom">
            {/* Configuración de Venta */}
            <fieldset className="bg-white border-2 border-slate-200 rounded-2xl p-5">
              <legend className="text-xs font-black text-slate-900 uppercase tracking-wider px-2 bg-white">
                Configuración de Venta
              </legend>
              <div className={`grid gap-4 ${tipDoc === 'APARTADO' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Tipo de Documento</label>
                  <select
                    value={tipDoc}
                    onChange={e => { const v = e.target.value; setTipDoc(v); setEsPrest(v !== 'FACTURA'); if (v !== 'APARTADO') setAbono(''); }}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-slate-50 font-semibold"
                  >
                    <option value="FACTURA">📄 Factura de Venta</option>
                    <option value="PRESTAMO">🤝 Préstamo (Fiado)</option>
                    <option value="APARTADO">🏷️ Apartado (Separar)</option>
                  </select>
                </div>
                {tipDoc === 'APARTADO' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                      Abono Inicial <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="$0"
                      value={abono}
                      onChange={e => {
                        const raw = parseFormattedNumber(e.target.value);
                        setAbono(isNaN(raw) || raw === 0 ? '' : formatNumber(raw));
                      }}
                      className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums font-semibold"
                    />
                  </div>
                )}
              </div>
              {esPrest && (
                <div className="mt-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Observaciones</label>
                  <textarea
                    placeholder="Notas adicionales… (Opcional)"
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-none h-16"
                  />
                </div>
              )}
            </fieldset>

            {/* Información del Cliente */}
            <fieldset className="bg-white border-2 border-slate-200 rounded-2xl p-5">
              <legend className="text-xs font-black text-slate-900 uppercase tracking-wider px-2 bg-white">
                Información del Cliente
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-4 mb-3">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Nombre / Razón Social</label>
                  <input
                    type="text"
                    value={cliente.nombreCliente}
                    onChange={onNombreCli}
                    placeholder="Nombre completo…"
                    autoComplete="off"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all font-semibold"
                  />
                  {showCli && (
                    <div className="absolute top-full left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl mt-1 shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                      {sugCli.map((c, i) => (
                        <div
                          key={i}
                          onMouseDown={() => pickCli(c)}
                          className="p-3 cursor-pointer border-b border-slate-100 last:border-0 hover:bg-[#4488ee]/5 transition-colors"
                        >
                          <div className="font-bold text-sm text-slate-800">{c.nombre.toUpperCase()}</div>
                          <div className="text-xs text-slate-500">NIT/CC: {c.identificacion}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Cédula / NIT</label>
                  <input
                    type="number"
                    value={cliente.cedulaNit}
                    onChange={e => setCliente(p => ({ ...p, cedulaNit: e.target.value }))}
                    autoComplete="off"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all font-semibold tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej: 310… (Opcional)"
                    value={cliente.telefonoCliente}
                    onChange={e => setCliente(p => ({ ...p, telefonoCliente: e.target.value }))}
                    autoComplete="off"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Dirección</label>
                  <input
                    type="text"
                    placeholder="Calle, Barrio… (Opcional)"
                    value={cliente.direccionCliente}
                    onChange={e => setCliente(p => ({ ...p, direccionCliente: e.target.value }))}
                    autoComplete="off"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com (Opcional)"
                  value={cliente.correoCliente}
                  onChange={e => setCliente(p => ({ ...p, correoCliente: e.target.value }))}
                  autoComplete="off"
                  className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                />
              </div>
            </fieldset>

            {/* Agregar Producto */}
            <fieldset className="bg-white border-2 border-slate-200 rounded-2xl p-5">
              <legend className="text-xs font-black text-slate-900 uppercase tracking-wider px-2 bg-white">
                Agregar Producto
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3 mb-3">
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Buscador de Productos</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Nombre o código…"
                      value={prod.nombre}
                      onChange={onNombreProd}
                      autoComplete="off"
                      className="w-full pl-9 pr-3 h-11 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                    />
                  </div>
                  {showProd && (
                    <div className="absolute top-full left-0 right-0 z-[100] bg-white border border-slate-200 rounded-xl mt-1 shadow-xl overflow-hidden max-h-52 overflow-y-auto">
                      {sugProd.map((p, i) => (
                        <div
                          key={i}
                          onMouseDown={() => pickProd(p)}
                          className="p-3 cursor-pointer border-b border-slate-100 last:border-0 hover:bg-[#4488ee]/5 transition-colors"
                        >
                          <div className="font-bold text-sm text-slate-800">{p.nombre.toUpperCase()}</div>
                          <div className="text-xs text-emerald-600 font-semibold">
                            Precio: ${formatNumber(p.precioVendido)} · Stock: {p.cantidad}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Costo</label>
                  <div className="h-11 flex items-center justify-between bg-slate-50 border-2 border-dotted border-slate-300 rounded-lg px-3">
                    <span className={`text-sm font-bold tabular-nums transition-all ${verCosto ? '' : 'blur-sm select-none'}`}>
                      {prodSel && verCosto ? `$${prod.pc}` : '$ *****'}
                    </span>
                    <button
                      onClick={() => setVerCosto(!verCosto)}
                      className="text-[#4488ee] hover:text-[#3672c9] transition-colors"
                    >
                      {verCosto ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_0.6fr_0.6fr] gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Precio Venta</label>
                  <input
                    type="text"
                    value={prod.precio}
                    onChange={e => setProd(p => ({ ...p, precio: e.target.value }))}
                    autoComplete="off"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums font-semibold"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                    <input type="checkbox" checked={mayoreo} onChange={e => onMayoreo(e.target.checked)} className="accent-[#4488ee]" />
                    Aplicar Mayoreo
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Cantidad</label>
                  <input
                    type="number"
                    value={prod.cantidad}
                    onChange={e => setProd(p => ({ ...p, cantidad: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Garantía</label>
                  <input
                    type="number"
                    value={prod.garantia}
                    onChange={e => setProd(p => ({ ...p, garantia: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-11 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums text-center"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">Descripción</label>
                <textarea
                  placeholder="Detalles adicionales, estado del producto, etc. (Opcional)"
                  value={prod.descripcion}
                  onChange={e => setProd(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-none h-14"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={agregar}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-12 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-black uppercase tracking-wider transition-colors shadow-sm shadow-[#4488ee]/20"
                >
                  <Plus size={18} /> Añadir a la Lista
                </button>
                <button
                  onClick={clearFields}
                  className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
                  title="Limpiar campos"
                >
                  <Eraser size={16} /> Limpiar
                </button>
              </div>
            </fieldset>
          </div>

          {/* ── RIGHT COLUMN: CART AS INVOICE ── */}
          <div className="h-full">
            <div className="invoice-paper h-full flex flex-col">

              {/* Invoice Header */}
              <div className="invoice-header shrink-0">
                <div className="invoice-brand">ZENTORY<span>.</span></div>
                <div className="invoice-sub">Sistema de Gestión & Ventas</div>
                <div className="stamp">
                  {tipDoc}<br />PENDIENTE
                </div>
              </div>

              {/* Client Info */}
              <div className="invoice-client-box shrink-0">
                <div>
                  <div className="text-[0.65rem] font-black text-slate-500 mb-1">CLIENTE</div>
                  <div className="font-black truncate">{cliente.nombreCliente || 'CONSUMIDOR FINAL'}</div>
                </div>
                <div>
                  <div className="text-[0.65rem] font-black text-slate-500 mb-1">NIT / CC</div>
                  <div className="font-black truncate">{cliente.cedulaNit || '-------'}</div>
                </div>
              </div>

              {/* Items Table (Scrollable, fills available space) */}
              <div className="scroll-custom flex-1 overflow-y-auto px-8 min-h-0">
                <table className="invoice-table">
                  <thead className="sticky top-0 z-[1]">
                    <tr>
                      <th style={{ width: '50px' }}>CANT</th>
                      <th>DESCRIPCIÓN</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>% DESC</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>UNITARIO</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>ACC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-20 text-slate-400 italic">
                          Esperando productos…
                        </td>
                      </tr>
                    ) : (
                      carrito.map((item, idx) => (
                        <tr key={idx} className="item-row">
                          <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                          <td>
                            <div className="font-black">{item.nombre.toUpperCase()}</div>
                            <div className="text-[0.7rem] text-slate-500 font-medium">{item.descripcion || 'Sin especificar'}</div>
                            <div className="text-[0.75rem] mt-1">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded font-black">Garantía: {item.garantia}m</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                value={item.descuento || 0}
                                onChange={(e) => {
                                  const pct = Math.max(0, parseFloat(e.target.value) || 0);
                                  setCarrito(prev => prev.map((it, i) => {
                                    if (i !== idx) return it;
                                    const pr = it.precioOriginal * (1 - pct / 100);
                                    return { ...it, descuento: pct, precioUnitario: pr, total: pr * it.cantidad };
                                  }));
                                }}
                                className="cart-input-mini w-10 h-6 text-[0.75rem] px-1"
                              />
                              <span className="text-[0.75rem] font-black text-slate-500">%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.descuento > 0 ? (
                              <>
                                <div className="text-[0.7rem] line-through text-slate-400">${item.precioOriginal.toLocaleString()}</div>
                                <div className="text-rose-600">${item.precioUnitario.toLocaleString()}</div>
                              </>
                            ) : (
                              `$${item.precioUnitario.toLocaleString()}`
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-black">
                            ${Math.round(item.total).toLocaleString()}
                          </td>
                          <td>
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => editar(idx)}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-50 text-[#4488ee] border border-slate-200 hover:bg-[#4488ee]/10 transition-colors"
                                title="Editar"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => eliminar(idx)}
                                className="w-7 h-7 flex items-center justify-center rounded-md bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invoice Footer (Fixed at Bottom) */}
              <div className="invoice-total-section shrink-0">
                <div className="flex justify-between items-center mb-2">
                  {ahorroTotal > 0 ? (
                    <div className="text-[0.7rem] font-black text-emerald-600 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      AHORRAS: ${Math.round(ahorroTotal).toLocaleString('es-CO')}
                    </div>
                  ) : <div></div>}

                  {ahorroTotal > 0 && (
                    <div className="text-xs font-black text-slate-400 line-through">
                      NORMAL: ${Math.round(totalSinDesc).toLocaleString('es-CO')}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-end gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={16} className="text-slate-500" />
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        value={descGen === '' ? 0 : descGen}
                        placeholder="0"
                        onChange={e => setDescGen(e.target.value)}
                        className="cart-input-mini w-16 h-8 text-sm pr-5"
                      />
                      <span className="absolute right-2 text-xs font-black text-slate-400">%</span>
                    </div>
                    <button
                      onClick={applyDescGen}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-3 h-8 rounded text-[0.7rem] font-black tracking-wider transition-colors"
                    >
                      APLICAR
                    </button>
                    {(parseFloat(descGen) > 0 || ahorroTotal > 0) && (
                      <button
                        onClick={removeDescGen}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 h-8 rounded text-[0.7rem] font-black tracking-wider transition-colors"
                      >
                        LIMPIAR
                      </button>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-[0.65rem] font-black text-slate-500 uppercase">Total a Pagar</div>
                    <div
                      className="text-4xl font-black leading-none tabular-nums tracking-tight"
                      style={{ color: ahorroTotal > 0 ? '#10b981' : '#0f172a' }}
                    >
                      ${Math.round(totalCarrito).toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
                  {!esPrest ? (
                    <>
                      <button
                        onClick={imprimirPOS}
                        className="inline-flex items-center justify-center gap-2 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded text-sm font-black uppercase tracking-wider transition-colors"
                      >
                        <Printer size={16} /> Ticket POS
                      </button>
                      <button
                        onClick={guardarPDF}
                        className="inline-flex items-center justify-center gap-2 h-12 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 rounded text-sm font-black uppercase tracking-wider transition-colors"
                      >
                        <FileText size={16} /> Factura PDF
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={imprimirPOSPrest}
                        className="inline-flex items-center justify-center gap-2 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-black uppercase tracking-wider transition-colors"
                      >
                        <Printer size={16} /> Imprimir {tipDoc}
                      </button>
                      <button
                        onClick={guardarPDFPrest}
                        className="inline-flex items-center justify-center gap-2 h-12 bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50 rounded text-sm font-black uppercase tracking-wider transition-colors"
                      >
                        <FileText size={16} /> Factura PDF
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      <ConfirmModal
        open={!!confirm}
        mensaje={confirm?.mensaje || ''}
        textoAceptar="PROCESAR"
        textoCancelar="VOLVER"
        onAceptar={confirm?.onAceptar}
        onCancelar={() => setConfirm(null)}
      />

      {/* Paper-invoice styles (kept as-is, height now fills flex column) */}
      <style>{`
        .scroll-custom::-webkit-scrollbar { width: 4px; }
        .scroll-custom::-webkit-scrollbar-track { background: transparent; }
        .scroll-custom::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

        .invoice-paper {
          background: #fff;
          background-image:
            linear-gradient(#f1f5f9 1px, transparent 1px),
            linear-gradient(90deg, #f1f5f9 1px, transparent 1px);
          background-size: 20px 20px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.08);
          border-radius: 2px;
          border: 1px solid #e2e8f0;
          min-height: 0;
        }
        .invoice-paper::before {
          content: "";
          position: absolute;
          top: -10px;
          left: 0;
          right: 0;
          height: 10px;
          background: linear-gradient(-45deg, #fff 5px, transparent 0), linear-gradient(45deg, #fff 5px, transparent 0);
          background-position: left top;
          background-repeat: repeat-x;
          background-size: 10px 10px;
        }
        .invoice-header {
          padding: 32px 32px 12px 32px;
          text-align: center;
          position: relative;
        }
        .invoice-brand {
          font-size: 2em;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -2px;
          line-height: 1;
          margin-bottom: 4px;
        }
        .invoice-brand span { color: #4488ee; }
        .invoice-sub {
          font-size: 0.7em;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 3px;
          font-weight: 800;
        }
        .invoice-client-box {
          margin: 12px 32px 16px 32px;
          padding: 12px 14px;
          border: 2px solid #0f172a;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          font-size: 0.78em;
          text-transform: uppercase;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
        }
        .invoice-table th {
          background: #0f172a;
          color: #fff;
          padding: 10px 8px;
          text-align: left;
          font-size: 0.65em;
          font-weight: 800;
          text-transform: uppercase;
        }
        .invoice-table td {
          padding: 10px 8px;
          font-size: 0.82em;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
          font-weight: 600;
          vertical-align: middle;
        }
        .item-row:nth-child(even) { background: #f8fafc; }
        .item-row:hover { background: rgba(68, 136, 238, 0.04); }
        .invoice-total-section {
          padding: 14px 32px 24px 32px;
          border-top: 2px dashed #0f172a;
          background: #fff;
        }
        .stamp {
          position: absolute;
          top: 24px;
          right: 24px;
          width: 90px;
          height: 90px;
          border: 4px double #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          font-weight: 900;
          font-size: 0.75em;
          transform: rotate(-15deg);
          opacity: 0.55;
          text-transform: uppercase;
          text-align: center;
          padding: 8px;
          pointer-events: none;
        }
        .cart-input-mini {
          border: 1px solid #94a3b8;
          border-radius: 6px;
          text-align: center;
          background: #fff;
          font-weight: 800;
          color: #1e293b;
          outline: none;
          transition: all 0.2s;
        }
        .cart-input-mini:focus {
          border-color: #4488ee;
          box-shadow: 0 0 0 2px rgba(68, 136, 238, 0.15);
        }
      `}</style>
    </div>
  );
}
