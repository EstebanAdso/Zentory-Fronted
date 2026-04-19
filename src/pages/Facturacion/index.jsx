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
  CircleDollarSign, ShoppingBag, Plus, Trash2, Edit, Search, Tag, 
  Printer, FileText, XCircle, Eraser
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
const iSt = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '11px 14px',
  fontSize: '0.95em',
  color: '#1e293b',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'all 0.2s',
  fontWeight: '500'
};

const lSt = { 
  display: 'block', 
  fontSize: '0.88em', 
  marginBottom: '6px', 
  fontWeight: '700', 
  color: '#1e293b' 
};

const fsSt = (extra = {}) => ({
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '18px',
  marginBottom: '16px',
  backgroundColor: '#fff',
  ...extra,
});

const lgSt = { 
  fontSize: '0.85em', 
  padding: '0 8px', 
  fontWeight: '700', 
  color: '#0f172a',
  backgroundColor: '#fff',
};

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
  const ahorroPorc = totalSinDesc > 0 ? (ahorroTotal / totalSinDesc) * 100 : 0;

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

  const titulo = tipDoc === 'FACTURA' ? 'Facturación' : tipDoc === 'PRESTAMO' ? 'Préstamo (Fiado)' : 'Apartado (Separar)';

  function editar(idx) {
    const item = carrito[idx];
    setProd({ nombre: item.nombre, precio: formatNumber(item.precioOriginal), pc: formatNumber(item.pc), cantidad: String(item.cantidad), garantia: String(item.garantia), descripcion: item.descripcion });
    setProdSel({ id: item.id, nombre: item.nombre, precioVendido: item.precioOriginal, precioComprado: item.pc, cantidad: 9999 });
    setCarrito(p => p.filter((_, i) => i !== idx));
  }

  return (
    <>
      <style>{`
        .factura-input:focus { border-color: #3b82f6; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.85em; text-transform: uppercase; }
        .action-btn:hover { filter: brightness(0.9); transform: translateY(-1px); }
        .scroll-custom::-webkit-scrollbar { width: 4px; }
        .scroll-custom::-webkit-scrollbar-track { background: transparent; }
        .scroll-custom::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        /* --- ESTILOS FACTURA DE PAPEL --- */
        .invoice-paper {
          background: #fff;
          background-image: 
            linear-gradient(#f1f5f9 1px, transparent 1px),
            linear-gradient(90deg, #f1f5f9 1px, transparent 1px);
          background-size: 20px 20px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.1);
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', sans-serif;
          border: 1px solid #e2e8f0;
          transition: all 0.3s ease;
          height: 935px; /* Perfect alignment with the left column action button */
        }
        
        /* Zigzag edge */
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
          padding: 40px 30px 20px 30px;
          text-align: center;
          position: relative;
        }
        
        .invoice-brand {
          font-size: 2.2em;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -2px;
          line-height: 1;
          margin-bottom: 5px;
        }
        
        .invoice-brand span { color: #3b82f6; }

        .invoice-sub {
          font-size: 0.75em;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 3px;
          font-weight: 800;
        }

        .invoice-client-box {
          margin: 20px 30px;
          padding: 15px;
          border: 2px solid #0f172a;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          font-size: 0.8em;
          text-transform: uppercase;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
        }

        .invoice-table th {
          background: #0f172a;
          color: #fff;
          padding: 12px 10px;
          text-align: left;
          font-size: 0.7em;
          font-weight: 800;
          text-transform: uppercase;
        }

        .invoice-table td {
          padding: 15px 10px;
          font-size: 0.85em;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
          font-weight: 600;
        }

        .item-row:nth-child(even) { background: #f8fafc; }
        .item-row:hover { background: rgba(59, 130, 246, 0.03); }

        .invoice-total-section {
          margin-top: auto;
          padding: 15px 30px 30px 30px;
          border-top: 2px dashed #0f172a;
        }

        .stamp {
          position: absolute;
          top: 40px;
          right: 30px;
          width: 100px;
          height: 100px;
          border: 4px double #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ef4444;
          font-weight: 900;
          font-size: 0.8em;
          transform: rotate(-15deg);
          opacity: 0.6;
          text-transform: uppercase;
          text-align: center;
          padding: 10px;
          pointer-events: none;
        }

        .cart-input-mini { border: 1px solid #94a3b8; border-radius: 6px; padding: 4px 8px; width: 55px; font-size: 0.9em; text-align: center; background: #ffffff; font-weight: 800; color: #1e293b; outline: none; transition: all 0.2s; }
        .cart-input-mini:focus { border-color: #000000; box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05); }
        
        ::placeholder { color: #94a3b8; opacity: 1; font-weight: 400; }
        ::-ms-input-placeholder { color: #94a3b8; }
        
        .btn-icon-sm { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; border: none; transition: 0.2s; }
      `}</style>

      <div style={{ paddingTop: '55px', width: '96%', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'stretch', padding: '20px 0' }}>
          
          {/* ── LEFT COLUMN: ENTRY ── */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '935px' }}>
            <h1 style={{ fontSize: '1.6em', fontWeight: '800', color: '#0f172a', margin: '15px 0 0 0', height: '40px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {titulo}
            </h1>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <fieldset style={fsSt({ marginBottom: 0, padding: '20px' })}>
                <legend style={lgSt}>Configuración de Venta</legend>
                <label style={lSt}>Tipo de Documento</label>
                <select style={{ ...iSt, background: '#f8fafc' }} value={tipDoc} onChange={e => { setTipDoc(e.target.value); setEsPrest(e.target.value === 'FACTURA' ? false : true); }}>
                  <option value="FACTURA">📄 Factura de Venta</option>
                  <option value="PRESTAMO">🤝 Préstamo (Fiado)</option>
                  <option value="APARTADO">🏷️ Apartado (Separar)</option>
                </select>
              </fieldset>

              <fieldset style={fsSt({ marginBottom: 0, padding: '20px' })}>
                <legend style={lgSt}>Información del Cliente</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '15px' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={lSt}>Nombre / Razón Social</label>
                    <input type="text" style={iSt} className="factura-input" value={cliente.nombreCliente} onChange={onNombreCli} placeholder="Nombre completo..." />
                    {showCli && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '5px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                        {sugCli.map((c, i) => (
                          <div key={i} onMouseDown={() => pickCli(c)} className="sugerencia-item" style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9em' }}>{c.nombre.toUpperCase()}</div>
                            <div style={{ fontSize: '0.8em', color: '#64748b' }}>NIT/CC: {c.identificacion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={lSt}>Cédula / NIT</label>
                    <input type="number" style={iSt} className="factura-input" value={cliente.cedulaNit} onChange={e => setCliente(p => ({ ...p, cedulaNit: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                  <div>
                    <label style={lSt}>Teléfono</label>
                    <input type="text" style={iSt} className="factura-input" placeholder="Ej: 310... (Opcional)" value={cliente.telefonoCliente} onChange={e => setCliente(p => ({ ...p, telefonoCliente: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lSt}>Dirección</label>
                    <input type="text" style={iSt} className="factura-input" placeholder="Calle, Barrio... (Opcional)" value={cliente.direccionCliente} onChange={e => setCliente(p => ({ ...p, direccionCliente: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={lSt}>Correo Electrónico</label>
                  <input type="email" style={iSt} className="factura-input" placeholder="cliente@ejemplo.com (Opcional)" value={cliente.correoCliente} onChange={e => setCliente(p => ({ ...p, correoCliente: e.target.value }))} />
                </div>
              </fieldset>

              <fieldset style={fsSt({ marginBottom: 0, padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' })}>
                <legend style={lgSt}>Agregar Producto</legend>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '15px', marginBottom: '15px', alignItems: 'flex-end' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={lSt}>Buscador de Productos</label>
                      <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" style={{ ...iSt, paddingLeft: '45px' }} className="factura-input" placeholder="Nombre o código..." value={prod.nombre} onChange={onNombreProd} />
                      </div>
                      {showProd && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '5px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                          {sugProd.map((p, i) => (
                            <div key={i} onMouseDown={() => pickProd(p)} className="sugerencia-item" style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ fontWeight: '700' }}>{p.nombre.toUpperCase()}</div>
                              <div style={{ fontSize: '0.85em', color: '#10b981', fontWeight: '600' }}>Precio: ${formatNumber(p.precioVendido)} | Stock: {p.cantidad}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={lSt}>Costo</label>
                      <div style={{ ...iSt, height: '42px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderStyle: 'dotted', padding: '0 10px' }}>
                        <span style={{ fontSize: '0.9em', fontWeight: '800', filter: verCosto ? 'none' : 'blur(4px)', transition: '0.3s' }}>
                          {prodSel && verCosto ? `$${prod.pc}` : '$ *****'}
                        </span>
                        <button onClick={() => setVerCosto(!verCosto)} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}>
                          {verCosto ? <ShoppingBag size={14} /> : <Search size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      <label style={lSt}>Precio Venta</label>
                      <input type="text" style={iSt} className="factura-input" value={prod.precio} onChange={e => setProd(p => ({ ...p, precio: e.target.value }))} />
                      <label style={{ ...lSt, marginTop: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8em' }}>
                        <input type="checkbox" checked={mayoreo} onChange={e => onMayoreo(e.target.checked)} /> Aplicar Mayoreo
                      </label>
                    </div>
                    <div>
                      <label style={lSt}>Cantidad</label>
                      <input type="number" style={iSt} className="factura-input" value={prod.cantidad} onChange={e => setProd(p => ({ ...p, cantidad: e.target.value }))} />
                    </div>
                    <div>
                      <label style={lSt}>Garantía</label>
                      <input type="number" style={iSt} className="factura-input" value={prod.garantia} onChange={e => setProd(p => ({ ...p, garantia: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={lSt}>Descripción del Producto</label>
                    <textarea style={{ ...iSt, resize: 'none', height: '60px' }} className="factura-input" placeholder="Detalles adicionales, estado del producto, etc. (Opcional)" value={prod.descripcion} onChange={e => setProd(p => ({ ...p, descripcion: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button onClick={agregar} className="action-btn" style={{ flex: 1, background: '#3b82f6', color: '#fff', height: '48px', fontSize: '0.9em' }}>
                    <Plus size={18} /> AÑADIR A LA LISTA
                  </button>
                  <button onClick={clearFields} className="action-btn" style={{ width: '120px', background: '#f1f5f9', color: '#64748b', height: '48px', gap: '8px' }} title="Limpiar campos">
                    <Eraser size={18} /> LIMPIAR
                  </button>
                </div>
              </fieldset>
            </div>
          </div>

          {/* ── RIGHT COLUMN: CART AS INVOICE ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.6em', fontWeight: '800', color: 'transparent', margin: '15px 0 10px 0', userSelect: 'none' }}>.</h2>
            <div className="invoice-paper">
              
              {/* Invoice Header (Fixed) */}
              <div className="invoice-header">
                <div className="invoice-brand">ZENTORY<span>.</span></div>
                <div className="invoice-sub">Sistema de Gestión & Ventas</div>
                <div className="stamp">
                  {tipDoc}<br />PENDIENTE
                </div>
              </div>

              {/* Client Info (Fixed) */}
              <div className="invoice-client-box">
                <div>
                  <div style={{ fontWeight: '900', color: '#64748b', fontSize: '0.7em', marginBottom: '4px' }}>CLIENTE</div>
                  <div style={{ fontWeight: '800' }}>{cliente.nombreCliente || 'CONSUMIDOR FINAL'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '900', color: '#64748b', fontSize: '0.7em', marginBottom: '4px' }}>NIT / CC</div>
                  <div style={{ fontWeight: '800' }}>{cliente.cedulaNit || '-------'}</div>
                </div>
              </div>

              {/* Items Table (Scrollable Area) */}
              <div className="scroll-custom" style={{ padding: '0 30px', flex: 1, overflowY: 'auto' }}>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>CANT</th>
                      <th>DESCRIPCIÓN</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>% DESC</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>UNITARIO</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>ACC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8', fontStyle: 'italic' }}>
                          Esperando productos...
                        </td>
                      </tr>
                    ) : (
                      carrito.map((item, idx) => (
                        <tr key={idx} className="item-row">
                          <td style={{ textAlign: 'center' }}>{item.cantidad}</td>
                          <td>
                            <div style={{ fontWeight: '800' }}>{item.nombre.toUpperCase()}</div>
                            <div style={{ fontSize: '0.75em', color: '#64748b', fontWeight: '500' }}>{item.descripcion || 'Sin especificar'}</div>
                            <div style={{ fontSize: '0.7em', marginTop: '4px' }}>
                              <span style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>Gtz: {item.garantia}m</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                              <input type="number" className="cart-input-mini" 
                                style={{ width: '40px', height: '24px', fontSize: '0.8em', border: '1px solid #cbd5e1', padding: '0 4px' }}
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
                              />
                              <span style={{ fontSize: '0.8em', fontWeight: '800', color: '#64748b' }}>%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.descuento > 0 ? (
                              <>
                                <div style={{ fontSize: '0.7em', textDecoration: 'line-through', color: '#94a3b8' }}>${item.precioOriginal.toLocaleString()}</div>
                                <div style={{ color: '#ef4444' }}>${item.precioUnitario.toLocaleString()}</div>
                              </>
                            ) : (
                              `$${item.precioUnitario.toLocaleString()}`
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '900' }}>
                            ${Math.round(item.total).toLocaleString()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => editar(idx)} className="btn-icon-sm" style={{ background: '#f8fafc', color: '#3b82f6', border: '1px solid #e2e8f0' }} title="Editar"><Edit size={14} /></button>
                              <button onClick={() => eliminar(idx)} className="btn-icon-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fee2e2' }} title="Eliminar"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invoice Footer (Fixed at Bottom) */}
              <div className="invoice-total-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    {ahorroTotal > 0 ? (
                      <div style={{ fontSize: '0.75em', fontWeight: '900', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
                        AHORRAS: ${Math.round(ahorroTotal).toLocaleString('es-CO')}
                      </div>
                    ) : <div></div>}
                    
                    {ahorroTotal > 0 && (
                       <div style={{ fontSize: '0.8em', fontWeight: '800', color: '#94a3b8', textDecoration: 'line-through' }}>
                         NORMAL: ${Math.round(totalSinDesc).toLocaleString('es-CO')}
                       </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={16} color="#64748b" />
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input type="number" className="cart-input-mini" value={descGen === '' ? 0 : descGen} placeholder="0" onChange={e => setDescGen(e.target.value)} style={{ width: '60px', height: '32px', fontSize: '0.9em', paddingRight: '20px' }} />
                        <span style={{ position: 'absolute', right: '8px', fontSize: '0.8em', fontWeight: '800', color: '#94a3b8' }}>%</span>
                      </div>
                      <button onClick={applyDescGen} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em', fontWeight: '900' }}>APLICAR DESC.</button>
                      {(parseFloat(descGen) > 0 || ahorroTotal > 0) && (
                        <button onClick={removeDescGen} style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em', fontWeight: '900' }}>LIMPIAR</button>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75em', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Total a Pagar</div>
                    <div style={{ fontSize: '2.4em', fontWeight: '900', color: ahorroTotal > 0 ? '#10b981' : '#0f172a', letterSpacing: '-2px', lineHeight: 1 }}>
                      ${totalCarrito.toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) 50px', gap: '12px' }}>
                    {!esPrest ? (
                      <>
                        <button onClick={imprimirPOS} className="action-btn" style={{ background: '#0f172a', color: '#fff', height: '48px', borderRadius: '4px' }}>
                          <Printer size={18} /> TICKET POS
                        </button>
                        <button onClick={guardarPDF} className="action-btn" style={{ background: '#fff', border: '2px solid #0f172a', color: '#0f172a', height: '48px', borderRadius: '4px' }}>
                          <FileText size={18} /> FACTURA PDF
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={imprimirPOSPrest} className="action-btn" style={{ background: '#f59e0b', color: '#fff', height: '48px', borderRadius: '4px' }}>
                          <Printer size={18} /> IMPRIMIR {tipDoc}
                        </button>
                        <button onClick={guardarPDFPrest} className="action-btn" style={{ background: '#fff', border: '2px solid #f59e0b', color: '#f59e0b', height: '48px', borderRadius: '4px' }}>
                          <FileText size={18} /> FACTURA PDF
                        </button>
                      </>
                    )}
                    <button onClick={limpiarTodo} className="action-btn" style={{ background: '#f1f5f9', color: '#64748b', height: '48px', borderRadius: '4px', padding: 0 }}>
                      <XCircle size={22} />
                    </button>
                  </div>
                </div>
                

              </div>

            </div>
          </div>

        </div>
      </div>

      <ConfirmModal open={!!confirm} mensaje={confirm?.mensaje || ''} textoAceptar="PROCESAR" textoCancelar="VOLVER"
        onAceptar={confirm?.onAceptar} onCancelar={() => setConfirm(null)} />
    </>
  );
}
