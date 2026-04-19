import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ScanLine, Search, Package, DollarSign, Store, Tag, FolderOpen,
  Shield, CheckCircle2, XCircle, FileText, Barcode, Loader2,
} from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import { buscarProductoPorCodigo } from '../../api';

// ── Hook: escáner global ────────────────────────────────────────────────────
function useBarcodeScanner(onDetect) {
  const buf = useRef('');
  const lastKey = useRef(0);
  useEffect(() => {
    function handler(e) {
      const tag = e.target?.tagName;
      const editable = e.target?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || editable) return;

      const now = Date.now();
      const gap = now - lastKey.current;
      lastKey.current = now;
      if (e.key === 'Enter') {
        const c = buf.current.trim();
        buf.current = '';
        if (c.length >= 3) onDetect(c);
        return;
      }
      if (e.key.length === 1) {
        buf.current = (gap < 50 || buf.current.length > 0) ? buf.current + e.key : e.key;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDetect]);
}

// ── Badge de stock ──────────────────────────────────────────────────────────
function StockBadge({ cantidad, alertaStock }) {
  let cls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  let txt = `${cantidad} unidades disponibles`;
  if (cantidad === 0) {
    cls = 'bg-rose-100 text-rose-700 border-rose-200';
    txt = 'Sin stock';
  } else if (alertaStock > 0 && cantidad <= alertaStock) {
    cls = 'bg-amber-100 text-amber-700 border-amber-200';
    txt = `${cantidad} unidades (Stock bajo)`;
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {txt}
    </span>
  );
}

// ── Fila detalle ────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0 gap-3">
      <span className="flex items-center gap-2 font-semibold text-slate-600 text-sm">
        <Icon size={16} className="text-[#4488ee] shrink-0" />
        {label}
      </span>
      <span className="text-sm text-slate-800 text-right font-medium">{children}</span>
    </div>
  );
}

// ── Card del producto ───────────────────────────────────────────────────────
function ProductoCard({ producto }) {
  const categoria = producto.categoria?.nombre ?? 'Sin categoría';
  const estadoActivo = String(producto.estado || '').toLowerCase() === 'activo';
  const codigosBarra = producto.codigosDeBarra?.length
    ? producto.codigosDeBarra.map((c) => c.codigoBarra).join(', ')
    : 'Sin códigos de barras';

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-6 animate-[fadeIn_200ms_ease-out]">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)',
        }} />
        <h2 className="text-2xl font-black mb-1 drop-shadow relative">{producto.nombre}</h2>
        <p className="text-4xl font-black drop-shadow-md relative tabular-nums">
          ${formatNumber(producto.precioVendido)}
        </p>
        <small className="opacity-90 relative uppercase tracking-wide font-semibold">Precio de venta</small>
      </div>

      {/* Detalles */}
      <div className="p-6">
        <Row icon={Package} label="Stock">
          <StockBadge cantidad={producto.cantidad} alertaStock={producto.alertaStock} />
        </Row>
        <Row icon={DollarSign} label="Precio Compra">
          <span className="tabular-nums">${formatNumber(producto.precioComprado)}</span>
        </Row>
        <Row icon={Store} label="Precio Mayorista">
          <span className="tabular-nums">${formatNumber(producto.precioMayorista)}</span>
        </Row>
        <Row icon={Tag} label="SKU">
          {producto.sku || <span className="text-slate-400">N/A</span>}
        </Row>
        <Row icon={FolderOpen} label="Categoría">
          {categoria}
        </Row>
        <Row icon={Shield} label="Garantía">
          {producto.garantia} {producto.garantia === 1 ? 'mes' : 'meses'}
        </Row>
        <Row icon={estadoActivo ? CheckCircle2 : XCircle} label="Estado">
          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${estadoActivo ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
            }`}>
            {String(producto.estado || '').toUpperCase()}
          </span>
        </Row>
        <Row icon={Barcode} label="Códigos">
          <span className="font-mono text-xs">{codigosBarra}</span>
        </Row>
        {producto.descripcion && (
          <Row icon={FileText} label="Descripción">
            <span className="text-left block max-w-[60ch]">{producto.descripcion}</span>
          </Row>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Scan() {
  const [codigo, setCodigo] = useState('');
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const buscar = useCallback(async (codigoParam) => {
    const c = (codigoParam ?? codigo).trim();
    if (!c) {
      toast.error('Por favor ingresa un código de barras');
      return;
    }
    setLoading(true);
    setError('');
    setProducto(null);
    try {
      const { data } = await buscarProductoPorCodigo(c);
      setProducto(data);
      toast.success('Producto encontrado');
    } catch (err) {
      const status = err.response?.status;
      let msg = 'Error al buscar el producto';
      if (status === 404) msg = 'Producto no encontrado con ese código de barras';
      else if (!err.response) msg = 'No se puede conectar con el servidor. Verifica que esté ejecutándose.';
      else if (err.code === 'ECONNABORTED') msg = 'La búsqueda está tardando demasiado. Intenta nuevamente.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setCodigo('');
      inputRef.current?.focus();
    }
  }, [codigo]);

  useBarcodeScanner(buscar);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscar();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ScanLine size={28} className="text-[#4488ee]" /> Escanear Producto
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Escanea o ingresa el código de barras para consultar información del producto
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-[720px] mx-auto">
          {/* Search box - hero */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
              Código de barras
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Escanea o digita el código…"
                  autoComplete="off"
                  disabled={loading}
                  className="w-full pl-11 pr-4 h-12 text-base border-2 border-slate-200 rounded-xl outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all font-mono disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={() => buscar()}
                disabled={loading}
                className="inline-flex items-center gap-2 h-12 px-6 bg-[#4488ee] hover:bg-[#3672c9] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                Buscar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
              <ScanLine size={12} />
              Puedes usar un lector físico o escribirlo manualmente.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center mt-8">
              <Loader2 size={32} className="animate-spin text-[#4488ee] mx-auto" />
              <p className="mt-2 text-slate-500 text-sm">Buscando producto...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && !producto && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 p-4 rounded-xl mt-6 text-center flex items-center justify-center gap-2">
              <XCircle size={20} /> {error}
            </div>
          )}

          {/* Resultado */}
          {!loading && producto && <ProductoCard producto={producto} />}
        </div>
      </main>
    </div>
  );
}
