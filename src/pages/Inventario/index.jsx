import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import { generarHTMLParaCodigos } from '../../utils/printing';
import {
  getProductos,
  getProducto,
  getProductosPorCategoria,
  getProductosInactivos,
  buscarProductosPorNombre,
  buscarProductosPorNombreInactivo,
  getTotalGlobal,
  getTotalPorCategoria,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  getCategorias,
  crearCategoria,
  getCodigosBarraPorProducto,
  crearCodigoBarra,
  eliminarCodigoBarra,
} from '../../api/index';
import { Search } from 'lucide-react';

// ── Shared input style ──────────────────────────────────────────────────────
const iSt = {
  width: '100%',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '0.95em',
  color: '#1e293b',
  backgroundColor: '#f8fafc',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'all 0.2s ease',
};

const btnBase = {
  border: 'none',
  borderRadius: '8px',
  padding: '10px 18px',
  fontSize: '0.95em',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
};

const btnPrimary = {
  ...btnBase,
  backgroundColor: '#3b82f6',
  color: '#fff',
};
const btnDark = {
  ...btnBase,
  backgroundColor: '#1e293b',
  color: '#fff',
};
const btnInfo = {
  ...btnBase,
  backgroundColor: '#0ea5e9',
  color: '#fff',
};
const btnWarning = {
  ...btnBase,
  backgroundColor: '#f59e0b',
  color: '#fff',
};
const btnSuccess = {
  ...btnBase,
  backgroundColor: '#10b981',
  color: '#fff',
};
const btnDanger = {
  ...btnBase,
  backgroundColor: '#ef4444',
  color: '#fff',
};
const btnSecondary = {
  ...btnBase,
  backgroundColor: '#64748b',
  color: '#fff',
};
const btnDisabled = {
  ...btnBase,
  backgroundColor: '#f1f5f9',
  color: '#94a3b8',
  cursor: 'not-allowed',
  opacity: 0.7,
};

// Action buttons for table (square)
const actionBtn = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  fontSize: '1.1em',
  marginRight: '6px',
};

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ show, onClose, children, size = 'md' }) {
  if (!show) return null;

  const widths = {
    sm: '450px',
    md: '600px',
    lg: '850px',
    xl: '1100px',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1050,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 20px', overflowY: 'auto',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: widths[size] || widths.md,
          maxWidth: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          marginBottom: '30px',
          border: '1px solid #f1f5f9',
          animation: 'modalFadeIn 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const FORM_INIT = {
  nombre: '',
  precioComprado: '',
  precioVendido: '',
  cantidad: '',
  precioMayoreo: '',
  garantia: '',
  alertaStock: '0',
  descripcion: '',
  categoriaId: '',
};

const CAT_FORM_INIT = { nombre: '', descripcion: '', descripcionGarantia: '' };

export default function Inventario() {
  // ── Data ────────────────────────────────────────────────────────────────
  const [productos, setProductos] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(14);
  const [totalPages, setTotalPages] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mostrandoInactivos, setMostrandoInactivos] = useState(false);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [totalCategorias, setTotalCategorias] = useState({});

  // ── Modals ──────────────────────────────────────────────────────────────
  const [showProductoModal, setShowProductoModal] = useState(false);
  const [showCategoriaModal, setShowCategoriaModal] = useState(false);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(false);
  const [confirmarId, setConfirmarId] = useState(null);
  const [infoProducto, setInfoProducto] = useState(null);

  // ── Product form ────────────────────────────────────────────────────────
  const [productoId, setProductoId] = useState('');
  const [activeTab, setActiveTab] = useState('producto');
  const [form, setForm] = useState(FORM_INIT);
  const [codigosBarras, setCodigosBarras] = useState(['']); // for new product
  const [codigosBarraDB, setCodigosBarraDB] = useState([]); // from DB (edit mode)
  const [codigoBarrasInput, setCodigoBarrasInput] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [cantidadCodigosTab, setCantidadCodigosTab] = useState(1);
  const [cantidadCodigos, setCantidadCodigos] = useState(0);
  const [mensajeCodigoError, setMensajeCodigoError] = useState('');
  const [mensajeCodigoErrorProducto, setMensajeCodigoErrorProducto] = useState('');

  // ── Category form ───────────────────────────────────────────────────────
  const [catForm, setCatForm] = useState(CAT_FORM_INIT);

  // ── Load initial data ───────────────────────────────────────────────────
  useEffect(() => {
    cargarCategorias();
    cargarTotales();
  }, []);

  useEffect(() => {
    cargarProductosActual(0);
  }, [filtroCategoria, mostrandoInactivos]);

  useEffect(() => {
    cargarProductosActual(currentPage);
  }, [pageSize]);

  // ── Debounced search ────────────────────────────────────────────────────
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
    try {
      let res;
      if (mostrandoInactivos) {
        res = await buscarProductosPorNombreInactivo(nombre.trim(), page, pageSize);
      } else {
        res = await buscarProductosPorNombre(nombre.trim(), page, pageSize);
      }
      setProductos(res.data.content);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error( 'Error al buscar productos.');
    }
  }

  // ── Load products ───────────────────────────────────────────────────────
  const cargarProductosActual = useCallback(async (page) => {
    setCurrentPage(page);
    if (searchQuery.trim()) {
      ejecutarBusqueda(searchQuery, page);
      return;
    }
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
      toast.error( 'Error al cargar productos.');
    }
  }, [filtroCategoria, mostrandoInactivos, pageSize, searchQuery]);

  const cargarCategorias = async () => {
    try {
      const res = await getCategorias();
      setCategorias(res.data);
    } catch {
      toast.error( 'Error al cargar categorías.');
    }
  };

  const cargarTotales = async () => {
    try {
      const [resGlobal, resCat] = await Promise.all([getTotalGlobal(), getTotalPorCategoria()]);
      setTotalGlobal(resGlobal.data);
      setTotalCategorias(resCat.data);
    } catch {
      // silencioso
    }
  };

  // ── Toggle inactivos ────────────────────────────────────────────────────
  const toggleInactivos = () => {
    const nuevoEstado = !mostrandoInactivos;
    setMostrandoInactivos(nuevoEstado);
    setSearchQuery('');
    setCurrentPage(0);
    setFiltroCategoria('');
  };

  // ── Open product modal (new) ────────────────────────────────────────────
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

  // ── Open product modal (edit) ───────────────────────────────────────────
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
      // Load barcodes from DB
      const resCod = await getCodigosBarraPorProducto(id);
      setCodigosBarraDB(resCod.data);
      setShowProductoModal(true);
    } catch {
      toast.error( 'Error al cargar el producto.');
    }
  };

  // ── Save product ────────────────────────────────────────────────────────
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
      toast.error( 'El precio de venta debe ser mayor que el precio de compra.');
      return;
    }
    if (precioMayorista !== 0 && precioMayorista <= precioComprado) {
      toast.error( 'El precio de mayoreo debe ser mayor que el precio de compra.');
      return;
    }
    if (precioMayorista !== 0 && precioVendido < precioMayorista) {
      toast.error( 'El precio de venta debe ser mayor que el precio de mayoreo.');
      return;
    }

    const codigosDeBarra = codigosBarras
      .filter((c) => c.trim() !== '')
      .map((c) => ({ codigoBarra: c.trim() }));

    const payload = {
      nombre,
      precioComprado,
      precioVendido,
      cantidad,
      alertaStock,
      precioMayorista,
      garantia,
      codigosDeBarra,
      categoria: { id: parseInt(form.categoriaId) },
      total: precioComprado * cantidad,
      descripcion: form.descripcion.trim(),
    };

    try {
      if (productoId) {
        await actualizarProducto(productoId, payload);
        toast.success( 'Producto actualizado satisfactoriamente.');
      } else {
        await crearProducto(payload);
        toast.success( 'Producto agregado satisfactoriamente.');
      }
      setShowProductoModal(false);
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Error al guardar el producto.';
      toast.error( msg);
    }
  };

  // ── Save + print barcodes ───────────────────────────────────────────────
  const imprimirCodigosYGuardar = async (e) => {
    e.preventDefault();
    if (!cantidadCodigos || cantidadCodigos == 0) {
      toast.error( 'Debes agregar una cantidad de codigos.');
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
      nombre,
      precioComprado,
      precioVendido,
      cantidad,
      alertaStock,
      precioMayorista,
      garantia,
      codigosDeBarra,
      categoria: { id: parseInt(form.categoriaId) },
      total: precioComprado * cantidad,
      descripcion: form.descripcion.trim(),
    };

    try {
      let res;
      if (productoId) {
        res = await actualizarProducto(productoId, payload);
      } else {
        res = await crearProducto(payload);
      }
      const codigoGenerado = res.data?.sku;
      if (!codigoGenerado) {
        toast.error( 'No se pudo obtener el SKU del producto.');
        return;
      }
      const htmlCodigos = await generarHTMLParaCodigos(cantidadCodigos, codigoGenerado);
      const ventana = window.open('', '', 'height=1200,width=940');
      ventana.document.write(htmlCodigos);
      ventana.document.close();
      ventana.onload = () => ventana.print();

      toast.success( productoId ? 'Producto actualizado satisfactoriamente.' : 'Producto agregado satisfactoriamente.');
      setShowProductoModal(false);
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch {
      toast.error( 'Error al procesar la solicitud.');
    }
  };

  // ── Save barcode (codes tab) ────────────────────────────────────────────
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

  // ── Delete barcode (codes tab) ──────────────────────────────────────────
  const eliminarCodigo = async (codigoId) => {
    try {
      await eliminarCodigoBarra(codigoId);
      toast.success( 'Código de barra eliminado correctamente.');
      const res = await getCodigosBarraPorProducto(productoId);
      setCodigosBarraDB(res.data);
    } catch {
      toast.error( 'Error al eliminar el código de barra.');
    }
  };

  // ── Print barcodes (codes tab) ──────────────────────────────────────────
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

  // ── Deactivate product ──────────────────────────────────────────────────
  const confirmarEliminar = (id) => {
    setConfirmarId(id);
    setShowConfirmEliminar(true);
  };

  const ejecutarEliminar = async () => {
    setShowConfirmEliminar(false);
    try {
      await eliminarProducto(confirmarId);
      toast.success( 'Producto desactivado satisfactoriamente.');
      cargarProductosActual(currentPage);
      cargarTotales();
    } catch {
      toast.error( 'Error al desactivar el producto.');
    }
  };

  // ── Ver información ─────────────────────────────────────────────────────
  const verInformacion = async (id) => {
    try {
      const res = await getProducto(id);
      setInfoProducto(res.data);
      setShowInfoModal(true);
    } catch {
      toast.error( 'No se pudo cargar la información del producto.');
    }
  };

  // ── Save category ───────────────────────────────────────────────────────
  const guardarCategoria = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: catForm.nombre.toUpperCase(),
      descripcion: catForm.descripcion.toUpperCase(),
      descripcionGarantia: catForm.descripcionGarantia.toUpperCase(),
    };
    try {
      await crearCategoria(payload);
      toast.success( 'Categoría agregada satisfactoriamente.');
      setCatForm(CAT_FORM_INIT);
      setShowCategoriaModal(false);
      cargarCategorias();
      cargarProductosActual(currentPage);
    } catch {
      toast.error( 'Error al agregar la categoría.');
    }
  };

  // ── Pagination helpers ──────────────────────────────────────────────────
  const irAPagina = (page) => {
    if (page < 0 || page >= totalPages) return;
    cargarProductosActual(page);
  };

  const maxVisible = 6;
  const startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

  // ── Barcode field helpers ───────────────────────────────────────────────
  const agregarCampoBarras = () => setCodigosBarras((prev) => [...prev, '']);
  const actualizarBarras = (i, val) =>
    setCodigosBarras((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  const eliminarBarras = (i) =>
    setCodigosBarras((prev) => prev.filter((_, idx) => idx !== i));

  // ── Sorted category totals ──────────────────────────────────────────────
  const totalCatEntries = Object.entries(totalCategorias).sort((a, b) => b[1] - a[1]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: '55px', minHeight: '100vh', backgroundColor: '#fff' }}>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .search-input {
          width: 100%;
          border: 2px solid #cbd5e1;
          border-radius: 14px;
          padding: 14px 16px 14px 52px;
          font-size: 1.05em;
          color: #0f172a;
          background-color: #f8fafc;
          box-sizing: border-box;
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
        }
        .search-input:focus {
          border-color: #3b82f6;
          background-color: #ffffff;
          box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.15), 0 4px 6px -4px rgba(59, 130, 246, 0.1);
          transform: translateY(-1px);
        }
        .search-input::placeholder {
          color: #64748b;
          font-weight: 500;
        }
        .search-icon {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
          transition: all 0.3s ease;
        }
        .search-container:focus-within .search-icon {
          color: #3b82f6;
          transform: translateY(-50%) scale(1.1);
        }
        .control-btn {
          padding: 10px 20px;
          font-weight: 600;
          border-radius: 10px;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .control-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          filter: brightness(1.05);
        }
        .control-btn:active {
          transform: translateY(0);
        }
      `}</style>

      <div style={{ width: '95%', maxWidth: '2200px', margin: '0 auto', padding: '0 15px' }}>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '2.5em', fontWeight: '800', margin: '20px 0 25px', color: '#0f172a', letterSpacing: '-0.025em' }}>
          {mostrandoInactivos ? 'Inventario de Productos Inactivos' : 'Inventario de Productos'}
        </h1>

        {/* Control bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px', flexWrap: 'nowrap' }}>
          <div className="search-container" style={{ position: 'relative', flex: '0 1 700px', minWidth: '320px' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Escribe el nombre del producto para buscar..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value.toUpperCase())}
            />
            <div className="search-icon">
              <Search size={22} />
            </div>
          </div>
          
          <div style={{ flex: 1 }} />
          
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <button 
              className="control-btn"
              style={{ backgroundColor: mostrandoInactivos ? '#f1f5f9' : '#3b82f6', color: mostrandoInactivos ? '#94a3b8' : '#fff', cursor: mostrandoInactivos ? 'not-allowed' : 'pointer' }}
              onClick={mostrandoInactivos ? null : abrirModalNuevo}
            >
              Agregar Producto
            </button>
            <button 
              className="control-btn"
              style={{ backgroundColor: mostrandoInactivos ? '#f1f5f9' : '#1e293b', color: mostrandoInactivos ? '#94a3b8' : '#fff', cursor: mostrandoInactivos ? 'not-allowed' : 'pointer' }}
              onClick={mostrandoInactivos ? null : () => { setCatForm(CAT_FORM_INIT); setShowCategoriaModal(true); }}
            >
              Agregar Categoría
            </button>
            <button 
              className="control-btn"
              style={{ backgroundColor: mostrandoInactivos ? '#f1f5f9' : '#0ea5e9', color: mostrandoInactivos ? '#94a3b8' : '#fff', cursor: mostrandoInactivos ? 'not-allowed' : 'pointer' }}
              onClick={mostrandoInactivos ? null : () => { cargarTotales(); setShowTotalModal(true); }}
            >
              Ver Totales
            </button>
            
            <button
              className="control-btn"
              style={{
                backgroundColor: mostrandoInactivos ? '#10b981' : '#f59e0b',
                color: '#fff',
              }}
              onClick={toggleInactivos}
            >
              {mostrandoInactivos ? '✓ Ver Activos' : '⊘ Ver Inactivos'}
            </button>
          </div>
        </div>

        {/* Category filter */}
        {!mostrandoInactivos && (
          <div style={{ marginBottom: '0' }}>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#495057', marginBottom: '6px' }}>Filtrar por Categoría:</label>
            <select
              value={filtroCategoria}
              onChange={(e) => { setFiltroCategoria(e.target.value); setCurrentPage(0); }}
              style={{ ...iSt, width: '100%', padding: '8px 12px', fontSize: '0.95em', borderRadius: '4px 4px 0 0', border: '1px solid #dee2e6', borderBottom: 'none' }}
            >
              <option value="">Todos</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', tableLayout: 'fixed' }}>
            <thead>

              <tr style={{ backgroundColor: '#f1f3f5', color: '#212529' }}>
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'left', width: '35%', fontWeight: 600 }}>Nombre del Producto</th>
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'right', width: '10%', fontWeight: 600 }}>P.C</th>
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'right', width: '10%', fontWeight: 600 }}>$Vendido</th>
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'center', width: '8%', fontWeight: 600 }}>Cantidad</th>
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'center', width: '14%', fontWeight: 600 }}>Categoría</th>
                {!mostrandoInactivos && (
                  <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'right', width: '10%', fontWeight: 600 }}>Total</th>
                )}
                <th style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'center', width: '13%', fontWeight: 600 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.length === 0 ? (
                <tr>
                  <td colSpan={mostrandoInactivos ? 6 : 7} style={{ border: '1px solid #dee2e6', textAlign: 'center', padding: '20px', color: '#888' }}>
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                productos.map((p, i) => (
                  <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? '#f8f9fa' : '#fff' }}>
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', verticalAlign: 'middle' }}>
                      <div title={p.nombre.toUpperCase()} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.nombre.toUpperCase()}
                      </div>
                    </td>
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'right', verticalAlign: 'middle' }}>{formatNumber(p.precioComprado)}</td>
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'right', verticalAlign: 'middle' }}>{formatNumber(p.precioVendido)}</td>
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>{p.cantidad}</td>
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div title={p.categoria?.nombre || ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.categoria?.nombre}
                      </div>
                    </td>
                    {!mostrandoInactivos && (
                      <td style={{ border: '1px solid #dee2e6', padding: '6px 8px', textAlign: 'right', color: '#28a745', fontWeight: 600, verticalAlign: 'middle' }}>
                        ${formatNumber(p.total)}
                      </td>
                    )}
                    <td style={{ border: '1px solid #dee2e6', padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => verInformacion(p.id)}
                          style={{ ...actionBtn, backgroundColor: '#0ea5e9', color: '#fff' }}
                          title="Ver Información"
                        >ⓘ</button>
                        {!mostrandoInactivos && (
                          <>
                            <button
                              onClick={() => editarProducto(p.id)}
                              style={{ ...actionBtn, backgroundColor: '#1e293b', color: '#fff' }}
                              title="Editar"
                            >✎</button>
                            <button
                              onClick={() => confirmarEliminar(p.id)}
                              style={{ ...actionBtn, backgroundColor: '#ef4444', color: '#fff', marginRight: 0 }}
                              title="Desactivar"
                            >🗑</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '12px 0 6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => irAPagina(currentPage - 1)}
              disabled={currentPage === 0}
              style={{ ...btnSecondary, padding: '4px 10px', opacity: currentPage === 0 ? 0.5 : 1 }}
            >Anterior</button>
            {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pg) => (
              <button
                key={pg}
                onClick={() => irAPagina(pg)}
                style={{
                  ...btnSecondary,
                  padding: '4px 10px',
                  backgroundColor: pg === currentPage ? '#007bff' : '#6c757d',
                }}
              >{pg + 1}</button>
            ))}
            <button
              onClick={() => irAPagina(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              style={{ ...btnSecondary, padding: '4px 10px', opacity: currentPage >= totalPages - 1 ? 0.5 : 1 }}
            >Siguiente</button>
          </div>
        )}

        {/* Page size selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 20px' }}>
          <label style={{ fontSize: '0.9em' }}>Productos por página:</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(0); }}
            style={{ ...iSt, width: '80px' }}
          >
            <option value="9">9</option>
            <option value="14">14</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {/* ── MODAL: Producto ──────────────────────────────────────────────── */}
      <Modal show={showProductoModal} onClose={() => setShowProductoModal(false)} size="lg">
        {/* Tabs header */}
        <div style={{ borderBottom: '1px solid #dee2e6', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '0' }}>
          <button
            onClick={() => setActiveTab('producto')}
            style={{
              border: 'none', background: 'none', padding: '12px 16px',
              cursor: 'pointer', fontSize: '0.95em',
              borderBottom: activeTab === 'producto' ? '2px solid #007bff' : '2px solid transparent',
              color: activeTab === 'producto' ? '#007bff' : '#495057',
              fontWeight: activeTab === 'producto' ? 600 : 400,
            }}
          >
            {productoId ? 'Editar Producto' : 'Agregar Producto'}
          </button>
          {productoId && (
            <button
              onClick={() => setActiveTab('codigos')}
              style={{
                border: 'none', background: 'none', padding: '12px 16px',
                cursor: 'pointer', fontSize: '0.95em',
                borderBottom: activeTab === 'codigos' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'codigos' ? '#007bff' : '#495057',
                fontWeight: activeTab === 'codigos' ? 600 : 400,
              }}
            >Códigos</button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowProductoModal(false)}
            style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888', paddingRight: '4px' }}
          >&times;</button>
        </div>

        <div style={{ padding: '16px' }}>
          {/* TAB: Producto */}
          {activeTab === 'producto' && (
            <form onSubmit={guardarProducto}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
                    style={iSt}
                    placeholder="Escriba el nombre del producto..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Categoría</label>
                  <select
                    required
                    value={form.categoriaId}
                    onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                    style={iSt}
                  >
                    <option value="">Selecciona...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Precio Compra</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={form.precioComprado}
                    onChange={(e) => setForm({ ...form, precioComprado: e.target.value })}
                    style={iSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Precio Venta</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={form.precioVendido}
                    onChange={(e) => setForm({ ...form, precioVendido: e.target.value })}
                    style={iSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Stock Inicial</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    autoComplete="off"
                    value={form.cantidad}
                    onChange={(e) => { setForm({ ...form, cantidad: e.target.value }); setCantidadCodigos(parseInt(e.target.value) || 0); }}
                    style={iSt}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Precio Mayoreo</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.precioMayoreo}
                    onChange={(e) => setForm({ ...form, precioMayoreo: e.target.value })}
                    style={iSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Garantía (Meses)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    autoComplete="off"
                    value={form.garantia}
                    onChange={(e) => setForm({ ...form, garantia: e.target.value })}
                    style={iSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Aviso Stock Bajo</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    autoComplete="off"
                    value={form.alertaStock}
                    onChange={(e) => setForm({ ...form, alertaStock: e.target.value })}
                    style={iSt}
                  />
                </div>
              </div>

              {/* Barcode fields — only when creating new product */}
              {!productoId && (
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Códigos de Barras</label>
                  {codigosBarras.map((val, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                      <input
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        placeholder="Escanee el código de barras"
                        value={val}
                        onChange={(e) => actualizarBarras(i, e.target.value)}
                        style={{ ...iSt }}
                      />
                      {i === codigosBarras.length - 1 ? (
                        <button
                          type="button"
                          onClick={agregarCampoBarras}
                          style={{ ...btnSecondary, padding: '3px 10px', whiteSpace: 'nowrap' }}
                        >+</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => eliminarBarras(i)}
                          style={{ ...btnDanger, padding: '3px 10px', whiteSpace: 'nowrap' }}
                        >-</button>
                      )}
                    </div>
                  ))}
                  {mensajeCodigoErrorProducto && (
                    <p style={{ color: 'red', fontSize: '0.85em', margin: '4px 0' }}>{mensajeCodigoErrorProducto}</p>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px', fontWeight: '600', color: '#475569' }}>Descripción detallada</label>
                <textarea
                  rows={3}
                  placeholder="Proporcione especificaciones, modelo o detalles adicionales..."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  style={{ ...iSt, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button type="submit" style={btnPrimary}>Guardar</button>
                <input
                  type="number"
                  min="0"
                  value={cantidadCodigos}
                  onChange={(e) => setCantidadCodigos(parseInt(e.target.value) || 0)}
                  style={{ ...iSt, width: '70px' }}
                  title="Cantidad de etiquetas a imprimir"
                />
                <button type="button" onClick={imprimirCodigosYGuardar} style={btnInfo}>
                  Imprimir Códigos y Guardar
                </button>
              </div>
            </form>
          )}

          {/* TAB: Códigos */}
          {activeTab === 'codigos' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>SKU</label>
                  <input type="text" readOnly value={skuInput} style={{ ...iSt, backgroundColor: '#e9ecef' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Cantidad a Imprimir</label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadCodigosTab}
                    onChange={(e) => setCantidadCodigosTab(parseInt(e.target.value) || 1)}
                    style={iSt}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Código de Barras</label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Escanee el código de barra"
                    value={codigoBarrasInput}
                    onChange={(e) => setCodigoBarrasInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarCodigoBarra(); } }}
                    style={iSt}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <button onClick={guardarCodigoBarra} style={{ ...btnSuccess, width: '100%' }}>
                    Guardar Código
                  </button>
                </div>
              </div>

              {/* Barcode tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '40px', marginBottom: '8px' }}>
                {codigosBarraDB.map((c) => (
                  <span key={c.id} className="codigo-barras-item">
                    {c.codigoBarra}
                    <button className="eliminar-codigo" onClick={() => eliminarCodigo(c.id)}>X</button>
                  </span>
                ))}
              </div>

              {mensajeCodigoError && (
                <p style={{ color: 'red', fontSize: '0.85em', textAlign: 'center', margin: '4px 0' }}>
                  {mensajeCodigoError}
                </p>
              )}

              <button onClick={imprimirCodigos} style={btnPrimary}>Imprimir Códigos</button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── MODAL: Categoría ─────────────────────────────────────────────── */}
      <Modal show={showCategoriaModal} onClose={() => setShowCategoriaModal(false)} size="md">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: '1.25em', fontWeight: '700', color: '#1e293b' }}>Agregar Nueva Categoría</h3>
          <button onClick={() => setShowCategoriaModal(false)} style={{ border: 'none', background: '#f1f5f9', fontSize: '1.2em', cursor: 'pointer', color: '#64748b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </div>
        <div style={{ padding: '24px' }}>
          <form onSubmit={guardarCategoria}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569' }}>Nombre de la Categoría</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={catForm.nombre}
                onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                style={iSt}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569' }}>Descripción General</label>
                <textarea
                  rows={4}
                  placeholder="Finalidad de esta categoría..."
                  value={catForm.descripcion}
                  onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
                  style={{ ...iSt, resize: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569' }}>Términos de Garantía</label>
                <textarea
                  rows={4}
                  placeholder="Detalles sobre cobertura de garantía..."
                  value={catForm.descripcionGarantia}
                  onChange={(e) => setCatForm({ ...catForm, descripcionGarantia: e.target.value })}
                  style={{ ...iSt, resize: 'none' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setShowCategoriaModal(false)} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={btnDark}>Guardar Categoría</button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ── MODAL: Totales ───────────────────────────────────────────────── */}
      <Modal show={showTotalModal} onClose={() => setShowTotalModal(false)} size="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25em', fontWeight: '700', color: '#1e293b' }}>Resumen de Inventario</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.9em', color: '#64748b' }}>Distribución de valor por categoría</p>
          </div>
          <button onClick={() => setShowTotalModal(false)} style={{ border: 'none', background: '#f1f5f9', fontSize: '1.2em', cursor: 'pointer', color: '#64748b', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </div>
        
        <div style={{ padding: '24px' }}>
          {/* Global Total Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
            borderRadius: '12px', 
            padding: '24px', 
            marginBottom: '24px', 
            color: '#fff',
            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
          }}>
            <span style={{ fontSize: '0.9em', opacity: 0.9, fontWeight: '500' }}>TOTAL GLOBAL EN INVENTARIO</span>
            <h2 style={{ fontSize: '2.5em', margin: '4px 0 0', fontWeight: '800' }}>${formatNumber(totalGlobal)}</h2>
          </div>

          <h4 style={{ fontSize: '1em', fontWeight: '600', color: '#475569', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '16px', background: '#3b82f6', borderRadius: '2px' }}></span>
            Por Categoría
          </h4>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
            gap: '16px',
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '8px'
          }}>
            {totalCatEntries.map(([cat, total]) => (
              <div key={cat} style={{ 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                padding: '16px',
                transition: 'all 0.2s ease',
              }}>
                <div style={{ fontSize: '0.85em', color: '#64748b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{cat}</div>
                <div style={{ fontSize: '1.25em', color: '#1e293b', fontWeight: '700' }}>${formatNumber(total)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowTotalModal(false)} style={btnInfo}>Cerrar Resumen</button>
        </div>
      </Modal>

      {/* ── MODAL: Info Producto ─────────────────────────────────────────── */}
      <Modal show={showInfoModal} onClose={() => setShowInfoModal(false)} size="lg">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em' }}>Información del Producto</h5>
          <button onClick={() => setShowInfoModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ padding: '16px' }}>
          {infoProducto && (
            <>
              <p><strong>Nombre:</strong> {infoProducto.nombre?.toUpperCase()}</p>
              <p><strong>Descripción:</strong> {infoProducto.descripcion || 'No hay descripción para este producto.'}</p>
            </>
          )}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #dee2e6', textAlign: 'right' }}>
          <button onClick={() => setShowInfoModal(false)} style={btnInfo}>Cerrar</button>
        </div>
      </Modal>

      {/* ── MODAL: Confirmar desactivar ──────────────────────────────────── */}
      <Modal show={showConfirmEliminar} onClose={() => setShowConfirmEliminar(false)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em' }}>Confirmación</h5>
          <button onClick={() => setShowConfirmEliminar(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ padding: '16px' }}>
          <p>¿Está seguro de que desea desactivar este producto?</p>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #dee2e6', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={ejecutarEliminar} style={btnDanger}>Sí</button>
          <button onClick={() => setShowConfirmEliminar(false)} style={btnSecondary}>No</button>
        </div>
      </Modal>
    </div>
  );
}
