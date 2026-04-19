import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Search, Plus, Info, Pencil, Trash2, X, Package, Tag, BarChart3,
  RefreshCw, Eye, EyeOff, Printer, ChevronLeft, ChevronRight, Loader2,
  DollarSign, Barcode as BarcodeIcon, AlertTriangle,
} from 'lucide-react';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import { generarHTMLParaCodigos } from '../../utils/printing';
import {
  getProductos, getProducto, getProductosPorCategoria, getProductosInactivos,
  buscarProductosPorNombre, buscarProductosPorNombreInactivo,
  getTotalGlobal, getTotalPorCategoria,
  crearProducto, actualizarProducto, eliminarProducto,
  getCategorias, crearCategoria,
  getCodigosBarraPorProducto, crearCodigoBarra, eliminarCodigoBarra,
} from '../../api/index';

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ show, onClose, children, size = 'md' }) {
  if (!show) return null;
  const widths = { sm: 'w-[480px]', md: 'w-[640px]', lg: 'w-[900px]', xl: 'w-[1100px]' };
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`${widths[size] || widths.md} max-w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_200ms_ease-out]`}>
        {children}
      </div>
    </div>
  );
}

const FORM_INIT = {
  nombre: '', precioComprado: '', precioVendido: '', cantidad: '',
  precioMayoreo: '', garantia: '', alertaStock: '0', descripcion: '', categoriaId: '',
};

const CAT_FORM_INIT = { nombre: '', descripcion: '', descripcionGarantia: '' };

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(14);
  const [totalPages, setTotalPages] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrandoInactivos, setMostrandoInactivos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [totalCategorias, setTotalCategorias] = useState({});

  const [showProductoModal, setShowProductoModal] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
  const [confirmarId, setConfirmarId] = useState(null);
  const [infoProducto, setInfoProducto] = useState(null);

  const [productoId, setProductoId] = useState('');
  const [activeTab, setActiveTab] = useState('producto');
  const [form, setForm] = useState(FORM_INIT);
  const [codigosBarras, setCodigosBarras] = useState(['']);
  const [codigosBarraDB, setCodigosBarraDB] = useState([]);
  const [codigoBarrasInput, setCodigoBarrasInput] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [cantidadCodigosTab, setCantidadCodigosTab] = useState(1);
  const [cantidadCodigos, setCantidadCodigos] = useState(0);
  const [mensajeCodigoError, setMensajeCodigoError] = useState('');
  const [mensajeCodigoErrorProducto, setMensajeCodigoErrorProducto] = useState('');

  const [catForm, setCatForm] = useState(CAT_FORM_INIT);

  useEffect(() => {
    cargarCategorias();
    cargarTotales();
  }, []);

  useEffect(() => {
    cargarProductosActual(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCategoria, mostrandoInactivos]);

  useEffect(() => {
    cargarProductosActual(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const searchTimer = useRef(null);
  const handleSearch = (val) => {
    setSearchQuery(val);
    setCurrentPage(0);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => ejecutarBusqueda(val, 0), 300);
  };

  async function ejecutarBusqueda(nombre, page) {
    if (!nombre.trim()) {
      cargarProductosActual(page);
      return;
    }
    setLoading(true);
    try {
      const res = mostrandoInactivos
        ? await buscarProductosPorNombreInactivo(nombre.trim(), page, pageSize)
        : await buscarProductosPorNombre(nombre.trim(), page, pageSize);
      setProductos(res.data.content);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error('Error al buscar productos.');
    } finally {
      setLoading(false);
    }
  }

  const cargarProductosActual = useCallback(async (page) => {
    setCurrentPage(page);
    if (searchQuery.trim()) {
      ejecutarBusqueda(searchQuery, page);
      return;
    }
    setLoading(true);
    try {
      let res;
      if (mostrandoInactivos) {
        res = await getProductosInactivos(page, pageSize);
      } else if (filtroCategoria) {
        res = await getProductosPorCategoria(filtroCategoria, page, pageSize);
      } else {
        res = await getProductos(page, pageSize);
      }
      setProductos(res.data.content);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error('Error al cargar productos.');
    } finally {
      setLoading(false);
    }
  }, [filtroCategoria, mostrandoInactivos, pageSize, searchQuery]);

  const cargarCategorias = async () => {
    try {
      const res = await getCategorias();
      setCategorias(res.data);
    } catch {
      toast.error('Error al cargar categorías.');
    }
  };

  const cargarTotales = async () => {
    try {
      const [resGlobal, resCat] = await Promise.all([getTotalGlobal(), getTotalPorCategoria()]);
      setTotalGlobal(resGlobal.data);
      setTotalCategorias(resCat.data);
    } catch { /* silent */ }
  };

  const toggleInactivos = () => {
    setMostrandoInactivos(!mostrandoInactivos);
    setSearchQuery('');
    setCurrentPage(0);
    setFiltroCategoria('');
  };

  const abrirModalNuevo = () => {
    setProductoId('');
    setForm(FORM_INIT);
    setCodigosBarras(['']);
    setCodigosBarraDB([]);
    setSkuInput('');
    setCodigoBarrasInput('');
    setCantidadCodigos(0);
    setMensajeCodigoError('');
    setMensajeCodigoErrorProducto('');
    setActiveTab('producto');
    setShowProductoModal(true);
  };

  const editarProducto = async (id) => {
    try {
      const res = await getProducto(id);
      const p = res.data;
      setProductoId(String(p.id));
      setForm({
        nombre: p.nombre || '',
        precioComprado: formatNumber(p.precioComprado),
        precioVendido: formatNumber(p.precioVendido),
        cantidad: String(p.cantidad),
        precioMayoreo: p.precioMayorista ? formatNumber(p.precioMayorista) : '',
        garantia: String(p.garantia || ''),
        alertaStock: String(p.alertaStock || 0),
        descripcion: p.descripcion || '',
        categoriaId: String(p.categoria?.id || ''),
      });
      setSkuInput(p.sku || '');
      setCantidadCodigosTab(1);
      setCodigosBarras(['']);
      setCodigoBarrasInput('');
      setMensajeCodigoError('');
      setMensajeCodigoErrorProducto('');
      setActiveTab('codigos');
      const resCod = await getCodigosBarraPorProducto(id);
      setCodigosBarraDB(resCod.data);
      setShowProductoModal(true);
    } catch {
      toast.error('Error al cargar el producto.');
    }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const nombre = form.nombre.toUpperCase().trim();
    const precioComprado = parseFormattedNumber(form.precioComprado);
    const precioVendido = parseFormattedNumber(form.precioVendido);
    const precioMayorista = parseFormattedNumber(form.precioMayoreo) || 0;
    const cantidad = parseInt(form.cantidad) || 0;
    const alertaStock = parseInt(form.alertaStock) || 0;
    const garantia = parseInt(form.garantia) || 0;

    if (precioVendido <= precioComprado) {
      toast.error('El precio de venta debe ser mayor que el precio de compra.');
      return;
    }
    if (precioMayorista !== 0 && precioMayorista <= precioComprado) {
      toast.error('El precio de mayoreo debe ser mayor que el precio de compra.');
      return;
    }
    if (precioMayorista !== 0 && precioVendido < precioMayorista) {
      toast.error('El precio de venta debe ser mayor que el precio de mayoreo.');
      return;
    }

    const codigosDeBarra = codigosBarras
      .filter((c) => c.trim() !== '')
      .map((c) => ({ codigoBarra: c.trim() }));

    const payload = {
      nombre, precioComprado, precioVendido, cantidad, alertaStock, precioMayorista, garantia,
      codigosDeBarra, categoria: { id: parseInt(form.categoriaId) },
      total: precioComprado * cantidad, descripcion: form.descripcion.trim(),
    };

    try {
      if (productoId) {
        await actualizarProducto(productoId, payload);
        toast.success('Producto actualizado satisfactoriamente.');
      } else {
        await crearProducto(payload);
        toast.success('Producto agregado satisfactoriamente.');
      }
      setShowProductoModal(false);
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar el producto.');
    }
  };

  const imprimirCodigosYGuardar = async (e) => {
    e.preventDefault();
    if (!cantidadCodigos || cantidadCodigos == 0) {
      toast.error('Debes agregar una cantidad de códigos.');
      return;
    }
    const nombre = form.nombre.toUpperCase().trim();
    const precioComprado = parseFormattedNumber(form.precioComprado);
    const precioVendido = parseFormattedNumber(form.precioVendido);
    const precioMayorista = parseFormattedNumber(form.precioMayoreo) || 0;
    const cantidad = parseInt(form.cantidad) || 0;
    const alertaStock = parseInt(form.alertaStock) || 0;
    const garantia = parseInt(form.garantia) || 0;

    const codigosDeBarra = codigosBarras
      .filter((c) => c.trim() !== '')
      .map((c) => ({ codigoBarra: c.trim() }));

    const payload = {
      nombre, precioComprado, precioVendido, cantidad, alertaStock, precioMayorista, garantia,
      codigosDeBarra, categoria: { id: parseInt(form.categoriaId) },
      total: precioComprado * cantidad, descripcion: form.descripcion.trim(),
    };

    try {
      const res = productoId
        ? await actualizarProducto(productoId, payload)
        : await crearProducto(payload);
      const codigoGenerado = res.data?.sku;
      if (!codigoGenerado) {
        toast.error('No se pudo obtener el SKU del producto.');
        return;
      }
      const htmlCodigos = await generarHTMLParaCodigos(cantidadCodigos, codigoGenerado);
      const ventana = window.open('', '', 'height=1200,width=940');
      ventana.document.write(htmlCodigos);
      ventana.document.close();
      ventana.onload = () => ventana.print();

      toast.success(productoId ? 'Producto actualizado satisfactoriamente.' : 'Producto agregado satisfactoriamente.');
      setShowProductoModal(false);
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch {
      toast.error('Error al procesar la solicitud.');
    }
  };

  const guardarCodigoBarra = async () => {
    if (!codigoBarrasInput.trim()) {
      setMensajeCodigoError('Debes agregar un código');
      return;
    }
    try {
      await crearCodigoBarra({ productoId: parseInt(productoId), codigoBarra: codigoBarrasInput.trim() });
      setCodigoBarrasInput('');
      setMensajeCodigoError('');
      const res = await getCodigosBarraPorProducto(productoId);
      setCodigosBarraDB(res.data);
    } catch {
      setMensajeCodigoError('El código ya está asignado a otro producto.');
    }
  };

  const eliminarCodigo = async (codigoId) => {
    try {
      await eliminarCodigoBarra(codigoId);
      toast.success('Código de barra eliminado correctamente.');
      const res = await getCodigosBarraPorProducto(productoId);
      setCodigosBarraDB(res.data);
    } catch {
      toast.error('Error al eliminar el código de barra.');
    }
  };

  const imprimirCodigos = async () => {
    if (!skuInput) {
      setMensajeCodigoError('Debes agregar un código');
      return;
    }
    const htmlCodigos = await generarHTMLParaCodigos(cantidadCodigosTab, skuInput);
    const ventana = window.open('', '_blank', 'height=1200,width=940');
    ventana.document.write(htmlCodigos);
    ventana.document.close();
    ventana.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => ventana.print(), 500);
    });
  };

  const confirmarEliminar = (id) => {
    setConfirmarId(id);
    setShowConfirmEliminar(true);
  };

  const ejecutarEliminar = async () => {
    setShowConfirmEliminar(false);
    try {
      await eliminarProducto(confirmarId);
      toast.success('Producto desactivado satisfactoriamente.');
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch {
      toast.error('Error al desactivar el producto.');
    }
  };

  const verInformacion = async (id) => {
    try {
      const res = await getProducto(id);
      setInfoProducto(res.data);
      setShowInfoModal(true);
    } catch {
      toast.error('No se pudo cargar la información del producto.');
    }
  };

  const guardarCategoria = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: catForm.nombre.toUpperCase(),
      descripcion: catForm.descripcion.toUpperCase(),
      descripcionGarantia: catForm.descripcionGarantia.toUpperCase(),
    };
    try {
      await crearCategoria(payload);
      toast.success('Categoría agregada satisfactoriamente.');
      setCatForm(CAT_FORM_INIT);
      setShowCategoriaModal(false);
      cargarCategorias();
      cargarProductosActual(currentPage);
    } catch {
      toast.error('Error al agregar la categoría.');
    }
  };

  const irAPagina = (page) => {
    if (page < 0 || page >= totalPages) return;
    cargarProductosActual(page);
  };

  const maxVisible = 6;
  const startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

  const agregarCampoBarras = () => setCodigosBarras((prev) => [...prev, '']);
  const actualizarBarras = (i, val) => setCodigosBarras((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  const eliminarBarras = (i) => setCodigosBarras((prev) => prev.filter((_, idx) => idx !== i));

  const totalCatEntries = Object.entries(totalCategorias).sort((a, b) => b[1] - a[1]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Page header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package size={26} className="text-[#4488ee]" />
              {mostrandoInactivos ? 'Productos Inactivos' : 'Inventario de Productos'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading ? 'Cargando…' : `${productos.length} en esta página · Página ${currentPage + 1} de ${Math.max(1, totalPages)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => cargarProductosActual(currentPage)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 hover:bg-slate-100 disabled:opacity-60 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button
              onClick={toggleInactivos}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold transition-colors ${mostrandoInactivos
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
            >
              {mostrandoInactivos ? <><Eye size={14} /> Ver Activos</> : <><EyeOff size={14} /> Ver Inactivos</>}
            </button>
            {!mostrandoInactivos && (
              <>
                <button
                  onClick={() => { cargarTotales(); setShowTotalModal(true); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <BarChart3 size={14} /> Totales
                </button>
                <button
                  onClick={() => { setCatForm(CAT_FORM_INIT); setShowCategoriaModal(true); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  <Tag size={14} /> Categoría
                </button>
                <button
                  onClick={abrirModalNuevo}
                  className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
                >
                  <Plus size={16} /> Agregar Producto
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content — no page scroll, only table scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full flex flex-col gap-4">
          {/* Filters — fixed */}
          <div className="shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Buscar</label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Escribe el nombre del producto…"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-3 h-10 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                  />
                </div>
              </div>
              {!mostrandoInactivos && (
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Categoría</label>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => { setFiltroCategoria(e.target.value); setCurrentPage(0); }}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                  >
                    <option value="">Todas</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Table — fills remaining space, body scrolls internally */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Producto</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-28 border-b border-slate-200">P. Compra</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-28 border-b border-slate-200">P. Venta</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-24 border-b border-slate-200">Stock</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide w-40 border-b border-slate-200">Categoría</th>
                    {!mostrandoInactivos && (
                      <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Total</th>
                    )}
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={mostrandoInactivos ? 6 : 7} className="text-center py-12">
                        <Loader2 size={24} className="animate-spin mx-auto text-[#4488ee]" />
                        <p className="mt-2 text-sm text-slate-500">Cargando productos…</p>
                      </td>
                    </tr>
                  ) : productos.length === 0 ? (
                    <tr>
                      <td colSpan={mostrandoInactivos ? 6 : 7} className="text-center py-12">
                        <Package size={32} className="mx-auto text-slate-300" />
                        <p className="mt-2 text-sm text-slate-500">No hay productos para mostrar</p>
                      </td>
                    </tr>
                  ) : (
                    productos.map((p) => {
                      const lowStock = p.alertaStock > 0 && p.cantidad <= p.alertaStock;
                      const noStock = p.cantidad === 0;
                      return (
                        <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800 truncate max-w-[420px]" title={p.nombre?.toUpperCase()}>
                              {p.nombre?.toUpperCase()}
                            </div>
                            {p.sku && <div className="text-[11px] text-slate-400 font-mono">{p.sku}</div>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">${formatNumber(p.precioComprado)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">${formatNumber(p.precioVendido)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 rounded-full text-xs font-bold border ${noStock ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : lowStock ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                              {p.cantidad}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold truncate max-w-[150px]" title={p.categoria?.nombre || ''}>
                              {p.categoria?.nombre || '—'}
                            </span>
                          </td>
                          {!mostrandoInactivos && (
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-bold">
                              ${formatNumber(p.total)}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => verInformacion(p.id)}
                                title="Ver información"
                                className="inline-flex items-center justify-center w-8 h-8 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-lg transition-colors"
                              >
                                <Info size={14} />
                              </button>
                              {!mostrandoInactivos && (
                                <>
                                  <button
                                    onClick={() => editarProducto(p.id)}
                                    title="Editar"
                                    className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => confirmarEliminar(p.id)}
                                    title="Desactivar"
                                    className="inline-flex items-center justify-center w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination — fixed at bottom, centered */}
          <div className="shrink-0 flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <label className="font-semibold">Mostrar:</label>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(0); }}
                className="border-2 border-slate-200 rounded-lg px-2 h-9 text-sm outline-none focus:border-[#4488ee] bg-white"
              >
                <option value="9">9</option>
                <option value="14">14</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <span className="text-slate-500">por página</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => irAPagina(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => irAPagina(pg)}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${pg === currentPage
                        ? 'bg-[#4488ee] text-white shadow-sm shadow-[#4488ee]/20'
                        : 'border border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                  >
                    {pg + 1}
                  </button>
                ))}
                <button
                  onClick={() => irAPagina(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-700 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODAL: Producto ──────────────────────────────────────────────── */}
      <Modal show={showProductoModal} onClose={() => setShowProductoModal(false)} size="lg">
        {/* Tabs header */}
        <div className="flex items-center bg-slate-900 text-white">
          <button
            onClick={() => setActiveTab('producto')}
            className={`px-5 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'producto'
                ? 'border-[#4488ee] text-white'
                : 'border-transparent text-slate-400 hover:text-white'
              }`}
          >
            {productoId ? 'Editar Producto' : 'Agregar Producto'}
          </button>
          {productoId && (
            <button
              onClick={() => setActiveTab('codigos')}
              className={`px-5 py-4 text-sm font-bold transition-colors border-b-2 ${activeTab === 'codigos'
                  ? 'border-[#4488ee] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
                }`}
            >
              Códigos
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowProductoModal(false)}
            className="px-4 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* TAB: Producto */}
          {activeTab === 'producto' && (
            <form onSubmit={guardarProducto} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre</label>
                  <input
                    type="text" required autoComplete="off"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
                    placeholder="Nombre del producto…"
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Categoría</label>
                  <select
                    required value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                  >
                    <option value="">Selecciona…</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Compra</label>
                  <input
                    type="text" required autoComplete="off"
                    value={form.precioComprado}
                    onChange={(e) => setForm({ ...form, precioComprado: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Venta</label>
                  <input
                    type="text" required autoComplete="off"
                    value={form.precioVendido}
                    onChange={(e) => setForm({ ...form, precioVendido: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Stock Inicial</label>
                  <input
                    type="number" required min="0" step="1" autoComplete="off"
                    value={form.cantidad}
                    onChange={(e) => { setForm({ ...form, cantidad: e.target.value }); setCantidadCodigos(parseInt(e.target.value) || 0); }}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Mayoreo</label>
                  <input
                    type="text" autoComplete="off"
                    value={form.precioMayoreo}
                    onChange={(e) => setForm({ ...form, precioMayoreo: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Garantía (meses)</label>
                  <input
                    type="number" min="0" step="1" autoComplete="off"
                    value={form.garantia}
                    onChange={(e) => setForm({ ...form, garantia: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Aviso Stock Bajo</label>
                  <input
                    type="number" min="0" step="1" autoComplete="off"
                    value={form.alertaStock}
                    onChange={(e) => setForm({ ...form, alertaStock: e.target.value })}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
              </div>

              {!productoId && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Códigos de Barras</label>
                  <div className="space-y-2">
                    {codigosBarras.map((val, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                          placeholder="Escanee el código de barras"
                          value={val}
                          onChange={(e) => actualizarBarras(i, e.target.value)}
                          className="flex-1 border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all font-mono"
                        />
                        {i === codigosBarras.length - 1 ? (
                          <button
                            type="button" onClick={agregarCampoBarras}
                            className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        ) : (
                          <button
                            type="button" onClick={() => eliminarBarras(i)}
                            className="inline-flex items-center justify-center w-10 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {mensajeCodigoErrorProducto && (
                    <p className="text-rose-600 text-xs mt-2 font-semibold">{mensajeCodigoErrorProducto}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Descripción</label>
                <textarea
                  rows={3}
                  placeholder="Especificaciones, modelo o detalles adicionales…"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-y"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
                >
                  Guardar
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="number" min="0"
                    value={cantidadCodigos}
                    onChange={(e) => setCantidadCodigos(parseInt(e.target.value) || 0)}
                    className="w-20 border-2 border-slate-200 rounded-lg px-2 h-10 text-sm outline-none focus:border-[#4488ee] tabular-nums text-center"
                    title="Cantidad de etiquetas a imprimir"
                  />
                  <button
                    type="button" onClick={imprimirCodigosYGuardar}
                    className="inline-flex items-center gap-1.5 px-4 h-10 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-bold transition-colors"
                  >
                    <Printer size={14} /> Imprimir y Guardar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB: Códigos */}
          {activeTab === 'codigos' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">SKU</label>
                  <input
                    type="text" readOnly value={skuInput}
                    className="w-full bg-slate-100 border-2 border-slate-200 rounded-lg px-3 h-10 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Cantidad</label>
                  <input
                    type="number" min="1"
                    value={cantidadCodigosTab}
                    onChange={(e) => setCantidadCodigosTab(parseInt(e.target.value) || 1)}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Código de Barras</label>
                  <input
                    type="text" autoComplete="off"
                    placeholder="Escanee el código de barra"
                    value={codigoBarrasInput}
                    onChange={(e) => setCodigoBarrasInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarCodigoBarra(); } }}
                    className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={guardarCodigoBarra}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors"
                  >
                    <Plus size={16} /> Guardar Código
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[44px] bg-slate-50 rounded-lg p-3 border border-slate-200">
                {codigosBarraDB.length === 0 ? (
                  <p className="text-xs text-slate-400 italic w-full text-center py-2">
                    Sin códigos registrados
                  </p>
                ) : (
                  codigosBarraDB.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-700 shadow-sm">
                      <BarcodeIcon size={14} className="text-slate-400" />
                      {c.codigoBarra}
                      <button
                        onClick={() => eliminarCodigo(c.id)}
                        className="text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {mensajeCodigoError && (
                <p className="text-rose-600 text-xs text-center font-semibold">{mensajeCodigoError}</p>
              )}

              <button
                onClick={imprimirCodigos}
                className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
              >
                <Printer size={14} /> Imprimir Códigos
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL: Categoría ─────────────────────────────────────────────── */}
      <Modal show={showCategoriaModal} onClose={() => setShowCategoriaModal(false)} size="md">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <h3 className="m-0 text-base font-black flex items-center gap-2">
            <Tag size={18} className="text-orange-400" /> Agregar Nueva Categoría
          </h3>
          <button onClick={() => setShowCategoriaModal(false)} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={guardarCategoria} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre</label>
            <input
              type="text" required autoComplete="off"
              value={catForm.nombre}
              onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
              className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Descripción</label>
              <textarea
                rows={4}
                placeholder="Finalidad de esta categoría…"
                value={catForm.descripcion}
                onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Términos de Garantía</label>
              <textarea
                rows={4}
                placeholder="Detalles sobre cobertura de garantía…"
                value={catForm.descripcionGarantia}
                onChange={(e) => setCatForm({ ...catForm, descripcionGarantia: e.target.value })}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button" onClick={() => setShowCategoriaModal(false)}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              <Plus size={16} /> Guardar Categoría
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Totales ───────────────────────────────────────────────── */}
      <Modal show={showTotalModal} onClose={() => setShowTotalModal(false)} size="lg">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div>
            <h3 className="m-0 text-base font-black flex items-center gap-2">
              <BarChart3 size={18} className="text-cyan-400" /> Resumen de Inventario
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">Distribución de valor por categoría</p>
          </div>
          <button onClick={() => setShowTotalModal(false)} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gradient-to-br from-[#4488ee] to-[#3672c9] rounded-2xl p-6 mb-6 text-white shadow-lg shadow-[#4488ee]/20 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)',
            }} />
            <div className="relative">
              <div className="flex items-center gap-2 opacity-90">
                <DollarSign size={16} />
                <span className="text-xs font-bold uppercase tracking-wide">Total Global en Inventario</span>
              </div>
              <h2 className="text-4xl font-black mt-1 tabular-nums drop-shadow">${formatNumber(totalGlobal)}</h2>
            </div>
          </div>

          <h4 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <span className="w-1 h-4 bg-[#4488ee] rounded-sm"></span>
            Por Categoría
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
            {totalCatEntries.length === 0 ? (
              <p className="col-span-full text-center text-slate-500 py-6">Sin categorías</p>
            ) : (
              totalCatEntries.map(([cat, total]) => (
                <div key={cat} className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-[#4488ee]/30 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate">{cat}</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums mt-0.5">${formatNumber(total)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => setShowTotalModal(false)}
            className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* ── MODAL: Info Producto ─────────────────────────────────────────── */}
      <Modal show={showInfoModal} onClose={() => setShowInfoModal(false)} size="md">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <h3 className="m-0 text-base font-black flex items-center gap-2">
            <Info size={18} className="text-cyan-400" /> Información del Producto
          </h3>
          <button onClick={() => setShowInfoModal(false)} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {infoProducto && (
            <>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</p>
                <p className="text-base font-semibold text-slate-900">{infoProducto.nombre?.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Descripción</p>
                <p className="text-sm text-slate-700">
                  {infoProducto.descripcion || <span className="text-slate-400 italic">No hay descripción para este producto.</span>}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => setShowInfoModal(false)}
            className="px-4 h-10 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* ── MODAL: Confirmar desactivar ──────────────────────────────────── */}
      <Modal show={showConfirmEliminar} onClose={() => setShowConfirmEliminar(false)} size="sm">
        <div className="flex items-center justify-between px-6 py-4 bg-rose-600 text-white">
          <h3 className="m-0 text-base font-black flex items-center gap-2">
            <AlertTriangle size={18} /> Confirmación
          </h3>
          <button onClick={() => setShowConfirmEliminar(false)} className="text-white/80 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-slate-700">¿Está seguro de que desea desactivar este producto?</p>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={() => setShowConfirmEliminar(false)}
            className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={ejecutarEliminar}
            className="px-4 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition-colors"
          >
            Sí, desactivar
          </button>
        </div>
      </Modal>
    </div>
  );
}
