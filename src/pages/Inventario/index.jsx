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

// ── Shared input style ──────────────────────────────────────────────────────
const iSt = {
  width: '100%',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '0.9em',
  color: '#000',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimary = {
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnDark = {
  backgroundColor: '#343a40',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnInfo = {
  backgroundColor: '#17a2b8',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnWarning = {
  backgroundColor: '#ffc107',
  color: '#212529',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnSuccess = {
  backgroundColor: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnDanger = {
  backgroundColor: '#dc3545',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};
const btnSecondary = {
  backgroundColor: '#6c757d',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 12px',
  fontSize: '0.9em',
  cursor: 'pointer',
};

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ show, onClose, children, wide }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1050,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '60px', overflowY: 'auto',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '6px',
          width: wide ? '700px' : '520px',
          maxWidth: '95vw',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          marginBottom: '30px',
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
      <div style={{ width: '90%', maxWidth: '2200px', margin: '0 auto', padding: '0 15px' }}>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '2.5em', fontWeight: 'bold', margin: '15px 0 5px', userSelect: 'none', color: '#1a1a1a' }}>
          {mostrandoInactivos ? 'Inventario de Productos Inactivos' : 'Inventario de Productos'}
        </h1>

        {/* Control bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value.toUpperCase())}
            disabled={mostrandoInactivos && !searchQuery}
            style={{ ...iSt, width: '600px', fontSize: '0.95em', padding: '6px 14px', borderRadius: '6px' }}
          />
          <div style={{ flex: 1 }} />
          {!mostrandoInactivos && (
            <>
              <button style={{ ...btnPrimary, padding: '5px 12px', fontSize: '0.95em' }} onClick={abrirModalNuevo}>Agregar Producto</button>
              <button style={{ ...btnDark, padding: '5px 12px', fontSize: '0.95em' }} onClick={() => { setCatForm(CAT_FORM_INIT); setShowCategoriaModal(true); }}>Agregar Categoría</button>
              <button style={{ ...btnInfo, padding: '5px 12px', fontSize: '0.95em' }} onClick={() => { cargarTotales(); setShowTotalModal(true); }}>Ver Totales</button>
            </>
          )}
          <button
            style={mostrandoInactivos ? btnSuccess : btnWarning}
            onClick={toggleInactivos}
          >
            {mostrandoInactivos ? 'Productos Activos' : 'Productos Inactivos'}
          </button>
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
                      <button
                        onClick={() => verInformacion(p.id)}
                        style={{ ...btnInfo, padding: '3px 10px', marginRight: '5px' }}
                        title="Info"
                      >i</button>
                      {!mostrandoInactivos && (
                        <>
                          <button
                            onClick={() => editarProducto(p.id)}
                            style={{ ...btnDark, padding: '3px 10px', marginRight: '5px' }}
                            title="Editar"
                          >&#9998;</button>
                          <button
                            onClick={() => confirmarEliminar(p.id)}
                            style={{ ...btnDanger, padding: '3px 10px' }}
                            title="Desactivar"
                          >&#128465;</button>
                        </>
                      )}
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
      <Modal show={showProductoModal} onClose={() => setShowProductoModal(false)}>
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
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Nombre</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })}
                  style={iSt}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Precio Comprado</label>
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
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Precio Vendido</label>
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
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Cantidad</label>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Precio Mayoreo</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={form.precioMayoreo}
                    onChange={(e) => setForm({ ...form, precioMayoreo: e.target.value })}
                    style={iSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Garantía (Meses)</label>
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
                  <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Alerta Stock</label>
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

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Descripción</label>
                <textarea
                  rows={2}
                  placeholder="Agregue una descripción del producto (Opcional)"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  style={{ ...iSt, resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Categoría</label>
                <select
                  required
                  value={form.categoriaId}
                  onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                  style={iSt}
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
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
      <Modal show={showCategoriaModal} onClose={() => setShowCategoriaModal(false)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em' }}>Agregar Categoría</h5>
          <button onClick={() => setShowCategoriaModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ padding: '16px' }}>
          <form onSubmit={guardarCategoria}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Nombre de la Categoría</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={catForm.nombre}
                onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
                style={iSt}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Descripción</label>
              <textarea
                rows={2}
                placeholder="Agregue una descripción de la categoría (Opcional)"
                value={catForm.descripcion}
                onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
                style={{ ...iSt, resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.85em', display: 'block', marginBottom: '3px' }}>Descripción de Garantía</label>
              <textarea
                rows={2}
                placeholder="Agregue una descripción de Garantía (Opcional)"
                value={catForm.descripcionGarantia}
                onChange={(e) => setCatForm({ ...catForm, descripcionGarantia: e.target.value })}
                style={{ ...iSt, resize: 'vertical' }}
              />
            </div>
            <button type="submit" style={btnDark}>Guardar</button>
          </form>
        </div>
      </Modal>

      {/* ── MODAL: Totales ───────────────────────────────────────────────── */}
      <Modal show={showTotalModal} onClose={() => setShowTotalModal(false)} wide>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em' }}>Totales de Categorías y Global</h5>
          <button onClick={() => setShowTotalModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <tbody>
              {totalCatEntries.map(([cat, total]) => (
                <tr key={cat} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '8px 16px', fontWeight: 600, textAlign: 'center' }}>{cat}</td>
                  <td style={{ padding: '8px 16px', fontWeight: 600, textAlign: 'center' }}>${formatNumber(total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: '#007bff', textAlign: 'center' }}>TOTAL INVENTARIO</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: '#007bff', textAlign: 'center' }}>${formatNumber(totalGlobal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #dee2e6', textAlign: 'right' }}>
          <button onClick={() => setShowTotalModal(false)} style={btnInfo}>Cerrar</button>
        </div>
      </Modal>

      {/* ── MODAL: Info Producto ─────────────────────────────────────────── */}
      <Modal show={showInfoModal} onClose={() => setShowInfoModal(false)} wide>
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
