import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ScanLine, Search, Package, DollarSign, Store, Tag, FolderOpen,
  Shield, CheckCircle2, XCircle, FileText, Barcode, Loader2,
} from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import { buscarProductoPorCodigo } from '../../api';

// ── Hook: escáner global (teclea rápido + Enter) ───────────────────────────
function useBarcodeScanner(onDetect) {
  const buf = useRef('');
  const lastKey = useRef(0);
  useEffect(() => {
    function handler(e) {
      const tag = e.target?.tagName;
      const editable = e.target?.isContentEditable;
      // Si ya está escribiendo en un input/textarea, dejamos que el input maneje
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
  let cls = 'bg-[#d4edda] text-[#155724]';
  let txt = `${cantidad} unidades disponibles`;
  if (cantidad === 0) {
    cls = 'bg-[#f8d7da] text-[#721c24]';
    txt = 'Sin stock';
  } else if (alertaStock > 0 && cantidad <= alertaStock) {
    cls = 'bg-[#fff3cd] text-[#856404]';
    txt = `${cantidad} unidades (Stock bajo)`;
  }
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${cls}`}>
      {txt}
    </span>
  );
}

// ── Fila detalle ────────────────────────────────────────────────────────────
function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-200 last:border-0 gap-3">
      <span className="flex items-center gap-2 font-semibold text-[#495057] text-sm">
        <Icon size={16} className="text-[#4488ee] shrink-0" />
        {label}
      </span>
      <span className="text-sm text-[#212529] text-right">{children}</span>
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
    <div className="bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef] rounded-2xl shadow-lg overflow-hidden mt-5">
      {/* Header con nombre + precio */}
      <div className="bg-gradient-to-r from-[#28a745] to-[#20c997] text-white p-5 text-center">
        <h2 className="text-2xl font-bold mb-1 drop-shadow">{producto.nombre}</h2>
        <p className="text-4xl font-bold drop-shadow-md">
          ${formatNumber(producto.precioVendido)}
        </p>
        <small className="opacity-90">Precio de venta</small>
      </div>

      {/* Detalles */}
      <div className="p-5">
        <Row icon={Package} label="Stock">
          <StockBadge cantidad={producto.cantidad} alertaStock={producto.alertaStock} />
        </Row>
        <Row icon={DollarSign} label="Precio Compra">
          ${formatNumber(producto.precioComprado)}
        </Row>
        <Row icon={Store} label="Precio Mayorista">
          ${formatNumber(producto.precioMayorista)}
        </Row>
        <Row icon={Tag} label="SKU">
          {producto.sku || 'N/A'}
        </Row>
        <Row icon={FolderOpen} label="Categoría">
          {categoria}
        </Row>
        <Row icon={Shield} label="Garantía">
          {producto.garantia} {producto.garantia === 1 ? 'mes' : 'meses'}
        </Row>
        <Row icon={estadoActivo ? CheckCircle2 : XCircle} label="Estado">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${
            estadoActivo ? 'bg-[#28a745] text-white' : 'bg-gray-500 text-white'
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
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="max-w-[800px] mx-auto px-5 py-8">
        {/* Título */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#007bff] inline-flex items-center gap-2">
            <ScanLine size={36} /> Escanear Producto
          </h1>
          <p className="text-gray-500 mt-2">
            Ingresa o escanea el código de barras para obtener información del producto
          </p>
        </div>

        {/* Input + botón */}
        <div className="mb-4">
          <div className="flex shadow-sm rounded-lg overflow-hidden">
            <input
              ref={inputRef}
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Código de barras del producto"
              autoComplete="off"
              className="flex-1 text-lg px-4 py-3 border-2 border-[#007bff] border-r-0 rounded-l-lg outline-none focus:ring-2 focus:ring-[#007bff]/30"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => buscar()}
              disabled={loading}
              className="inline-flex items-center gap-2 text-lg font-semibold px-6 py-3 bg-gradient-to-r from-[#007bff] to-[#0056b3] text-white hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 rounded-r-lg"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              Buscar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <ScanLine size={12} />
            Tip: puedes usar un lector de códigos de barras o escribir el código manualmente.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center mt-6">
            <Loader2 size={32} className="animate-spin text-[#007bff] mx-auto" />
            <p className="mt-2 text-gray-500">Buscando producto...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && !producto && (
          <div className="bg-[#f8d7da] text-[#721c24] p-4 rounded-lg mt-5 text-center text-base flex items-center justify-center gap-2">
            <XCircle size={20} /> {error}
          </div>
        )}

        {/* Resultado */}
        {!loading && producto && <ProductoCard producto={producto} />}
      </div>
    </div>
  );
}
