import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Search, RefreshCw, Printer, FileText, FileCheck, Ban, Receipt,
  Package, ChevronDown,
} from 'lucide-react';
import {
  useFloating, useHover, useFocus, useInteractions, useTransitionStyles,
  FloatingPortal, offset, flip, shift, arrow, FloatingArrow, safePolygon,
} from '@floating-ui/react';
import ConfirmModal from '../../components/ConfirmModal';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import {
  generarPrestamoHTMLPDF, generarPrestamoHTMLPOS, generarAbonoHTMLPOS,
  abrirVentanaImpresion, abrirVentanaPOS,
} from '../../utils/printing';
import {
  getPrestamos, getPrestamosPorEstado, getPrestamosPendientes,
  getPrestamo, getPrestamoDetalles, getPrestamoAbonos,
  agregarAbono, anularPrestamo, convertirPrestamoAFactura,
} from '../../api';

// ── Constants ───────────────────────────────────────────────────────────────
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'NEQUI', 'DAVIPLATA'];

const TIPO_BADGE = {
  PRESTAMO: 'bg-[#ffc107] text-black',
  APARTADO: 'bg-[#17a2b8] text-white',
};

const ESTADO_BADGE = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-[#6c757d] text-white' },
  PAGADO:    { label: 'Pagado',    cls: 'bg-[#28a745] text-white' },
  CANCELADO: { label: 'Pagado',    cls: 'bg-[#28a745] text-white' },
  ANULADO:   { label: 'Anulado',   cls: 'bg-[#dc3545] text-white' },
};

// ── Card de préstamo ────────────────────────────────────────────────────────
const PrestamoCard = memo(function PrestamoCard({ prestamo, productos, onClick, onHoverPrefetch }) {
  const porcentaje = prestamo.total > 0
    ? Math.round((prestamo.totalAbonado / prestamo.total) * 100)
    : 0;
  const porcentajeMostrar =
    prestamo.estado === 'CANCELADO' || prestamo.estado === 'PAGADO' ? 100 : porcentaje;
  const fecha = new Date(prestamo.fechaCreacion).toLocaleDateString('es-CO');
  const estado = ESTADO_BADGE[prestamo.estado] || { label: prestamo.estado, cls: 'bg-gray-500 text-white' };

  const totalItems = productos?.reduce((s, p) => s + (p.cantidad || 0), 0) ?? 0;
  const loading = productos === null;
  const empty = Array.isArray(productos) && productos.length === 0;

  // Floating UI: panel en portal con auto-flip + arrow + hover delay
  const [open, setOpen] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context, placement } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (next) onHoverPrefetch(prestamo.id);
    },
    placement: 'bottom',
    middleware: [
      offset(10),
      flip({ fallbackPlacements: ['top'], padding: 12 }),
      shift({ padding: 12 }),
      arrow({ element: arrowRef }),
    ],
  });

  const hover = useHover(context, {
    delay: { open: 80, close: 60 },
    handleClose: safePolygon({ blockPointerEvents: false }),
  });
  const focus = useFocus(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus]);

  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: { open: 200, close: 150 },
    initial: ({ side }) => ({
      opacity: 0,
      transform: side === 'top' ? 'translateY(6px) scale(0.97)' : 'translateY(-6px) scale(0.97)',
    }),
    open: { opacity: 1, transform: 'translateY(0) scale(1)' },
  });

  const isOpenPlacementTop = placement.startsWith('top');

  return (
    <>
      <div
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: () => onClick(prestamo.id),
          onMouseEnter: () => onHoverPrefetch(prestamo.id),
        })}
        tabIndex={0}
        className={`
          relative bg-white rounded-xl border border-gray-200 shadow-sm
          hover:shadow-xl hover:-translate-y-0.5 hover:border-[#4488ee]/40
          cursor-pointer transition-all duration-300 ease-out p-4
          outline-none focus-visible:ring-2 focus-visible:ring-[#4488ee]
          ${open ? 'z-20 ring-2 ring-[#4488ee]/30 border-[#4488ee]/40' : ''}
        `}
      >
        {/* Header: serial + badges */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h6 className="font-semibold text-sm m-0 truncate" title={prestamo.serial}>{prestamo.serial}</h6>
          <div className="flex gap-1 flex-wrap justify-end shrink-0">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${TIPO_BADGE[prestamo.tipo]}`}>
              {prestamo.tipo === 'PRESTAMO' ? 'Préstamo' : 'Apartado'}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${estado.cls}`}>
              {estado.label}
            </span>
          </div>
        </div>

        {/* Cliente + fecha */}
        <p className="text-sm font-semibold mb-0.5 truncate" title={prestamo.clienteNombre}>
          {prestamo.clienteNombre}
        </p>
        <p className="text-gray-500 text-xs mb-2">{fecha}</p>

        {/* Progreso */}
        <div className="relative w-full bg-gray-200 rounded h-5 mb-2 overflow-hidden">
          <div
            className="bg-[#28a745] h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
            style={{ width: `${porcentajeMostrar}%` }}
          >
            {porcentajeMostrar}%
          </div>
        </div>

        {/* Montos */}
        <div className="flex justify-between text-xs">
          <span>Abonado: <span className="text-[#28a745] font-semibold">${formatNumber(prestamo.totalAbonado)}</span></span>
          <span>Pendiente: <span className="text-[#dc3545] font-semibold">${formatNumber(prestamo.saldoPendiente)}</span></span>
        </div>

        <p className="mt-2 text-right font-bold text-sm">
          Total: ${formatNumber(prestamo.total)}
        </p>

        {/* Indicador: productos ocultos */}
        <div className={`mt-2 flex items-center justify-center gap-1 text-[11px] transition-colors ${open ? 'text-[#4488ee]' : 'text-gray-400'}`}>
          <Package size={12} />
          <span>
            {productos ? `${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}` : 'Ver productos'}
          </span>
          <ChevronDown size={12} className={`transition-transform duration-300 ${open ? (isOpenPlacementTop ? 'rotate-0' : 'rotate-180') : ''}`} />
        </div>
      </div>

      {isMounted && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 1000 }}
            {...getFloatingProps()}
          >
            <div style={transitionStyles}>
              <div className="w-72 bg-white rounded-xl border border-[#4488ee]/30 shadow-2xl p-4">
                <FloatingArrow
                  ref={arrowRef}
                  context={context}
                  fill="white"
                  stroke="rgba(68,136,238,0.3)"
                  strokeWidth={1}
                  tipRadius={1}
                  height={7}
                  width={12}
                />
                {loading ? (
                  <div className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/5" />
                  </div>
                ) : empty ? (
                  <p className="text-xs text-gray-400 italic text-center">Sin productos</p>
                ) : productos ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Productos
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}
                      </span>
                    </div>
                    <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {productos.map((p, i) => (
                        <li key={i} className="flex items-center justify-between text-xs gap-2 py-0.5">
                          <span className="truncate flex-1" title={p.nombreProducto}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4488ee] mr-1.5 align-middle" />
                            {p.nombreProducto || 'N/A'}
                          </span>
                          <span className="text-gray-600 whitespace-nowrap">
                            <span className="bg-gray-100 rounded px-1.5 py-0.5 mr-1 font-medium">
                              x{p.cantidad}
                            </span>
                            ${formatNumber(p.cantidad * p.precioVenta)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-gray-400 text-center mt-2 italic">
                      Clic para ver detalles completos
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
});

// ── Modal base ──────────────────────────────────────────────────────────────
function Modal({ show, onClose, children, wide = true }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/50 flex items-start justify-center pt-10 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-md shadow-xl mb-8 max-w-[96vw] ${wide ? 'w-[900px]' : 'w-[520px]'}`}>
        {children}
      </div>
    </div>
  );
}

// ── HTML builders para impresión ────────────────────────────────────────────
const filaProductoPrestamoPOS = (p) => `
  <tr style="font-size:11px">
    <td style="padding:2px 0;text-align:left;max-width:20mm;word-wrap:break-word">${p.nombreProducto || 'N/A'}</td>
    <td style="text-align:center">${p.cantidad}</td>
    <td style="text-align:center">${formatNumber(p.precioVenta)}</td>
    <td style="text-align:center">${formatNumber(p.cantidad * p.precioVenta)}</td>
  </tr>
`;

const filaProductoPrestamoPDF = (p) => `
  <tr>
    <td style="border:1px solid #ddd;padding:8px">${p.nombreProducto || 'N/A'}</td>
    <td style="border:1px solid #ddd;padding:8px;text-align:center">${p.cantidad}</td>
    <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatNumber(p.precioVenta)}</td>
    <td style="border:1px solid #ddd;padding:8px">${p.garantia || '1 Mes'}</td>
    <td style="border:1px solid #ddd;padding:8px">${p.descripcion || ''}</td>
    <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatNumber(p.cantidad * p.precioVenta)}</td>
  </tr>
`;

const filaAbonoPDF = (a) => `
  <tr>
    <td style="border:1px solid #ddd;padding:6px">${new Date(a.fechaAbono).toLocaleString('es-CO')}</td>
    <td style="border:1px solid #ddd;padding:6px;text-align:right;color:green">$${formatNumber(a.monto)}</td>
    <td style="border:1px solid #ddd;padding:6px">${a.metodoPago || 'N/A'}</td>
    <td style="border:1px solid #ddd;padding:6px">${a.observacion || '-'}</td>
  </tr>
`;

// ── Main ────────────────────────────────────────────────────────────────────
export default function Prestamos() {
  const [prestamos, setPrestamos] = useState([]);
  const [resumen, setResumen] = useState({
    prestamosPend: 0, apartadosPend: 0, totalPorCobrar: 0, totalAbonado: 0,
  });
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal detalle
  const [showDetalle, setShowDetalle] = useState(false);
  const [prestamoSel, setPrestamoSel] = useState(null);
  const [productos, setProductos] = useState([]);
  const [abonos, setAbonos] = useState([]);

  // Form abono
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState('EFECTIVO');
  const [obsAbono, setObsAbono] = useState('');

  // Confirm modal
  const [confirm, setConfirm] = useState(null);

  // Cache de productos por préstamo (para hover-expand en las cards)
  // Estados por id: undefined = no pedido, null = cargando, [] = cargado
  const [productosCache, setProductosCache] = useState({});
  const inFlightRef = useRef(new Set());

  const prefetchProductos = useCallback((id) => {
    if (inFlightRef.current.has(id)) return;
    inFlightRef.current.add(id);
    setProductosCache((prev) => (id in prev ? prev : { ...prev, [id]: null }));
    getPrestamoDetalles(id)
      .then(({ data }) => {
        setProductosCache((prev) => ({ ...prev, [id]: data }));
      })
      .catch(() => {
        setProductosCache((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      })
      .finally(() => {
        inFlightRef.current.delete(id);
      });
  }, []);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargarPrestamos = useCallback(async () => {
    setLoading(true);
    try {
      const req = filtroEstado && filtroEstado !== 'PAGADO'
        ? getPrestamosPorEstado(filtroEstado)
        : getPrestamos();
      let { data } = await req;
      if (filtroEstado === 'PAGADO') {
        data = data.filter((p) => p.estado === 'PAGADO' || p.estado === 'CANCELADO');
      }
      if (filtroTipo) data = data.filter((p) => p.tipo === filtroTipo);
      setPrestamos(data);
    } catch {
      toast.error('Error al cargar los préstamos.');
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, filtroEstado]);

  const cargarResumen = useCallback(async () => {
    try {
      const { data } = await getPrestamosPendientes();
      setResumen({
        prestamosPend: data.filter((p) => p.tipo === 'PRESTAMO').length,
        apartadosPend: data.filter((p) => p.tipo === 'APARTADO').length,
        totalPorCobrar: data.reduce((s, p) => s + p.saldoPendiente, 0),
        totalAbonado: data.reduce((s, p) => s + p.totalAbonado, 0),
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { cargarPrestamos(); }, [cargarPrestamos]);
  useEffect(() => { cargarResumen(); }, [cargarResumen]);

  // ── Filtrado por cliente ──────────────────────────────────────────────────
  const prestamosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return prestamos;
    return prestamos.filter((p) =>
      (p.clienteNombre || '').toLowerCase().includes(q) ||
      (p.cliente?.identificacion || '').includes(q)
    );
  }, [prestamos, busqueda]);

  // ── Ver detalle ───────────────────────────────────────────────────────────
  const verDetalle = useCallback(async (id) => {
    try {
      const cached = productosCache[id];
      const productosPromise = Array.isArray(cached)
        ? Promise.resolve({ data: cached })
        : getPrestamoDetalles(id);
      const [resPres, resDet, resAbo] = await Promise.all([
        getPrestamo(id),
        productosPromise,
        getPrestamoAbonos(id),
      ]);
      setPrestamoSel(resPres.data);
      setProductos(resDet.data);
      setAbonos(resAbo.data);
      setMontoAbono('');
      setObsAbono('');
      setMetodoAbono('EFECTIVO');
      setShowDetalle(true);
    } catch {
      toast.error('Error al cargar el detalle del préstamo.');
    }
  }, [productosCache]);

  const recargarDetalle = useCallback(async () => {
    if (!prestamoSel) return;
    try {
      const [resPres, resAbo] = await Promise.all([
        getPrestamo(prestamoSel.id),
        getPrestamoAbonos(prestamoSel.id),
      ]);
      setPrestamoSel(resPres.data);
      setAbonos(resAbo.data);
    } catch { /* silent */ }
  }, [prestamoSel]);

  // ── Registrar abono ───────────────────────────────────────────────────────
  const registrarAbono = async () => {
    if (!prestamoSel) return;
    const monto = parseFormattedNumber(montoAbono);
    if (!monto || monto <= 0) {
      toast.error('El monto del abono debe ser mayor a cero.');
      return;
    }
    if (monto > prestamoSel.saldoPendiente) {
      toast.error('El monto del abono no puede ser mayor al saldo pendiente.');
      return;
    }
    try {
      await agregarAbono({
        prestamoId: prestamoSel.id,
        monto,
        metodoPago: metodoAbono,
        observacion: obsAbono.trim() || null,
      });
      toast.success('Abono registrado exitosamente.');
      setMontoAbono('');
      setObsAbono('');
      await recargarDetalle();
      cargarPrestamos();
      cargarResumen();
    } catch (err) {
      toast.error('Error al registrar el abono: ' + (err.response?.data || err.message));
    }
  };

  // ── Convertir a factura ───────────────────────────────────────────────────
  const confirmarConvertirFactura = () => setConfirm({
    mensaje: '¿Está seguro de convertir este préstamo a factura? Esta acción no se puede deshacer.',
    textoAceptar: 'Sí, convertir',
    danger: false,
    onAceptar: async () => {
      setConfirm(null);
      try {
        const { data } = await convertirPrestamoAFactura(prestamoSel.id);
        toast.success(`Factura #${data.serial} generada. El préstamo quedó como PAGADO.`);
        setShowDetalle(false);
        cargarPrestamos();
        cargarResumen();
      } catch (err) {
        toast.error('Error al convertir a factura: ' + (err.response?.data || err.message));
      }
    },
  });

  // ── Anular ────────────────────────────────────────────────────────────────
  const confirmarAnular = () => setConfirm({
    mensaje: '¿Está seguro de anular este préstamo? Los productos volverán al inventario. Esta acción no se puede deshacer.',
    textoAceptar: 'Sí, anular',
    danger: true,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await anularPrestamo(prestamoSel.id);
        toast.success('Préstamo anulado. Los productos volvieron al inventario.');
        setShowDetalle(false);
        cargarPrestamos();
        cargarResumen();
      } catch (err) {
        toast.error('Error al anular el préstamo: ' + (err.response?.data || err.message));
      }
    },
  });

  // ── Imprimir POS ──────────────────────────────────────────────────────────
  const imprimirPOS = () => {
    if (!prestamoSel) return;
    const html = generarPrestamoHTMLPOS({
      prestamoId: prestamoSel.serial,
      tipoDocumento: prestamoSel.tipo,
      nombreCliente: prestamoSel.clienteNombre,
      cedulaNit: prestamoSel.cliente?.identificacion || 'N/A',
      telefonoCliente: prestamoSel.cliente?.telefono || null,
      productosHTML: productos.map(filaProductoPrestamoPOS).join(''),
      totalPrestamo: prestamoSel.total,
      totalAbonado: prestamoSel.totalAbonado,
      saldoPendiente: prestamoSel.saldoPendiente,
      fechaActual: new Date(prestamoSel.fechaCreacion).toLocaleString('es-CO'),
      observaciones: prestamoSel.observaciones,
    });
    abrirVentanaPOS(html);
  };

  // ── Imprimir PDF ──────────────────────────────────────────────────────────
  const imprimirPDF = () => {
    if (!prestamoSel) return;
    const html = generarPrestamoHTMLPDF({
      prestamoId: prestamoSel.serial,
      tipoDocumento: prestamoSel.tipo,
      nombreCliente: prestamoSel.clienteNombre,
      cedulaNit: prestamoSel.cliente?.identificacion || 'N/A',
      telefonoCliente: prestamoSel.cliente?.telefono || null,
      correoCliente: prestamoSel.cliente?.correo || null,
      direccionCliente: prestamoSel.cliente?.direccion || null,
      productosHTML: productos.map(filaProductoPrestamoPDF).join(''),
      totalPrestamo: prestamoSel.total,
      totalAbonado: prestamoSel.totalAbonado,
      saldoPendiente: prestamoSel.saldoPendiente,
      fechaActual: new Date(prestamoSel.fechaCreacion).toLocaleString('es-CO'),
      observaciones: prestamoSel.observaciones,
      abonosHTML: abonos.map(filaAbonoPDF).join(''),
    });
    abrirVentanaImpresion(html);
  };

  // ── Imprimir recibo de abono ──────────────────────────────────────────────
  const imprimirRecibo = (abono, index) => {
    if (!prestamoSel) return;
    const html = generarAbonoHTMLPOS({
      prestamoId: prestamoSel.serial,
      tipoDocumento: prestamoSel.tipo,
      nombreCliente: prestamoSel.clienteNombre,
      cedulaNit: prestamoSel.cliente?.identificacion || 'N/A',
      montoAbono: abono.monto,
      metodoPago: abono.metodoPago,
      observacion: abono.observacion,
      totalPrestamo: prestamoSel.total,
      totalAbonado: prestamoSel.totalAbonado,
      saldoPendiente: prestamoSel.saldoPendiente,
      fechaAbono: new Date(abono.fechaAbono).toLocaleString('es-CO'),
      numeroAbono: index + 1,
    });
    abrirVentanaPOS(html);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const porcentajeDet = prestamoSel
    ? (prestamoSel.total > 0
        ? Math.round((prestamoSel.totalAbonado / prestamoSel.total) * 100)
        : 0)
    : 0;
  const porcentajeDetMostrar = prestamoSel && (prestamoSel.estado === 'CANCELADO' || prestamoSel.estado === 'PAGADO')
    ? 100 : porcentajeDet;

  const esPendiente = prestamoSel?.estado === 'PENDIENTE';
  const tipoTexto = prestamoSel?.tipo === 'PRESTAMO' ? 'Préstamo' : 'Apartado';

  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4 py-5">
        <h1 className="text-center text-2xl font-semibold select-none">
          Inventario de préstamos y apartados
        </h1>
        <p className="text-center text-gray-500 mb-5">
          Gestiona los préstamos y apartados pendientes
        </p>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <div>
            <label className="block text-sm mb-1">Tipo:</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Todos</option>
              <option value="PRESTAMO">Préstamos</option>
              <option value="APARTADO">Apartados</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Estado:</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              <option value="PENDIENTE">Pendientes</option>
              <option value="PAGADO">Pagados (Facturados)</option>
              <option value="ANULADO">Anulados</option>
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Buscar Cliente:</label>
            <div className="flex items-center border border-gray-300 rounded overflow-hidden focus-within:border-blue-400">
              <span className="px-2 text-gray-500"><Search size={14} /></span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o cédula..."
                className="flex-1 px-1 py-1.5 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { cargarPrestamos(); cargarResumen(); }}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[#007bff] hover:bg-[#0069d9] text-white rounded px-3 py-1.5 text-sm transition-colors"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat title="Préstamos Pendientes" value={resumen.prestamosPend} bg="bg-[#ffc107]" text="text-black" />
          <Stat title="Apartados Pendientes" value={resumen.apartadosPend} bg="bg-[#17a2b8]" text="text-white" />
          <Stat title="Total Por Cobrar" value={`$${formatNumber(resumen.totalPorCobrar)}`} bg="bg-[#dc3545]" text="text-white" />
          <Stat title="Total Abonado" value={`$${formatNumber(resumen.totalAbonado)}`} bg="bg-[#28a745]" text="text-white" />
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-center text-gray-500 my-10">Cargando préstamos…</p>
        ) : prestamosFiltrados.length === 0 ? (
          <p className="text-center text-gray-500 my-10">
            No hay préstamos o apartados con los filtros seleccionados
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prestamosFiltrados.map((p) => (
              <PrestamoCard
                key={p.id}
                prestamo={p}
                productos={productosCache[p.id]}
                onClick={verDetalle}
                onHoverPrefetch={prefetchProductos}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Detalle ───────────────────────────────────────────────────── */}
      <Modal show={showDetalle} onClose={() => setShowDetalle(false)}>
        {prestamoSel && (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300">
              <h5 className="m-0 text-base font-semibold">
                Detalle del {tipoTexto} - {prestamoSel.serial}
              </h5>
              <button
                onClick={() => setShowDetalle(false)}
                className="border-0 bg-transparent text-2xl leading-none cursor-pointer text-gray-500 hover:text-gray-700"
              >×</button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {/* Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <p className="m-0"><strong>Serial:</strong> {prestamoSel.serial}</p>
                  <p className="m-0"><strong>Cliente:</strong> {prestamoSel.clienteNombre}</p>
                  <p className="m-0"><strong>Fecha:</strong> {new Date(prestamoSel.fechaCreacion).toLocaleString('es-CO')}</p>
                </div>
                <div>
                  <p className="m-0"><strong>Total:</strong> <span className="text-[#007bff]">${formatNumber(prestamoSel.total)}</span></p>
                  <p className="m-0"><strong>Abonado:</strong> <span className="text-[#28a745]">${formatNumber(prestamoSel.totalAbonado)}</span></p>
                  <p className="m-0"><strong>Pendiente:</strong> <span className="text-[#dc3545]">${formatNumber(prestamoSel.saldoPendiente)}</span></p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="relative w-full bg-gray-200 rounded h-6 mb-3 overflow-hidden">
                <div
                  className="bg-[#28a745] h-full flex items-center justify-center text-white text-sm font-semibold transition-all"
                  style={{ width: `${porcentajeDetMostrar}%` }}
                >
                  {porcentajeDetMostrar}%
                </div>
              </div>

              {prestamoSel.observaciones && (
                <p className="mb-3 text-sm">
                  <strong>Observaciones:</strong> {prestamoSel.observaciones}
                </p>
              )}

              {/* Productos */}
              <h6 className="font-semibold text-sm mb-1">Productos:</h6>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Producto</th>
                      <th className="border border-gray-300 px-2 py-1 text-center w-20">Cantidad</th>
                      <th className="border border-gray-300 px-2 py-1 text-right w-28">Precio</th>
                      <th className="border border-gray-300 px-2 py-1 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((d, i) => (
                      <tr key={i} className="even:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1">{d.nombreProducto || 'N/A'}</td>
                        <td className="border border-gray-300 px-2 py-1 text-center">{d.cantidad}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">${formatNumber(d.precioVenta)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">${formatNumber(d.cantidad * d.precioVenta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Abonos */}
              <h6 className="font-semibold text-sm mb-1">Historial de Abonos:</h6>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1 text-left">Fecha</th>
                      <th className="border border-gray-300 px-2 py-1 text-right w-28">Monto</th>
                      <th className="border border-gray-300 px-2 py-1 text-center w-32">Método</th>
                      <th className="border border-gray-300 px-2 py-1 text-left">Observación</th>
                      <th className="border border-gray-300 px-2 py-1 text-center w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-gray-300 text-center text-gray-500 py-3">
                          Sin abonos registrados
                        </td>
                      </tr>
                    ) : (
                      abonos.map((a, i) => (
                        <tr key={i} className="even:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1">{new Date(a.fechaAbono).toLocaleString('es-CO')}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right text-[#28a745] font-semibold">${formatNumber(a.monto)}</td>
                          <td className="border border-gray-300 px-2 py-1 text-center">{a.metodoPago || 'N/A'}</td>
                          <td className="border border-gray-300 px-2 py-1">{a.observacion || '-'}</td>
                          <td className="border border-gray-300 px-2 py-1 text-center">
                            <button
                              onClick={() => imprimirRecibo(a, i)}
                              title="Imprimir recibo"
                              className="inline-flex items-center justify-center border border-[#17a2b8] text-[#17a2b8] hover:bg-[#17a2b8] hover:text-white rounded p-1 transition-colors"
                            >
                              <Receipt size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Formulario de abono */}
              {esPendiente && (
                <>
                  <hr className="my-4 border-gray-200" />
                  <h6 className="font-semibold text-sm mb-2">Registrar Nuevo Abono:</h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-sm mb-1">Monto:</label>
                      <input
                        type="text"
                        value={montoAbono}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          setMontoAbono(raw ? Number(raw).toLocaleString('es-CO') : '');
                        }}
                        placeholder="$0"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Método:</label>
                      <select
                        value={metodoAbono}
                        onChange={(e) => setMetodoAbono(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Observación:</label>
                      <input
                        type="text"
                        value={obsAbono}
                        onChange={(e) => setObsAbono(e.target.value)}
                        placeholder="Opcional"
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <button
                    onClick={registrarAbono}
                    className="bg-[#28a745] hover:bg-[#218838] text-white rounded px-4 py-1.5 text-sm transition-colors"
                  >
                    Registrar Abono
                  </button>
                </>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-gray-300">
              <button
                onClick={imprimirPOS}
                className="inline-flex items-center gap-1.5 bg-[#17a2b8] hover:bg-[#138496] text-white rounded px-3 py-1.5 text-sm transition-colors"
              >
                <Printer size={14} /> Imprimir POS
              </button>
              <button
                onClick={imprimirPDF}
                className="inline-flex items-center gap-1.5 border border-[#17a2b8] text-[#17a2b8] hover:bg-[#17a2b8] hover:text-white rounded px-3 py-1.5 text-sm transition-colors"
              >
                <FileText size={14} /> Imprimir PDF
              </button>
              {esPendiente && (
                <>
                  <button
                    onClick={confirmarConvertirFactura}
                    className="inline-flex items-center gap-1.5 bg-[#007bff] hover:bg-[#0069d9] text-white rounded px-3 py-1.5 text-sm transition-colors"
                  >
                    <FileCheck size={14} /> Convertir a Factura
                  </button>
                  <button
                    onClick={confirmarAnular}
                    className="inline-flex items-center gap-1.5 bg-[#dc3545] hover:bg-[#c82333] text-white rounded px-3 py-1.5 text-sm transition-colors"
                  >
                    <Ban size={14} /> Anular
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirm}
        mensaje={confirm?.mensaje}
        textoAceptar={confirm?.textoAceptar}
        textoCancelar="Cancelar"
        onAceptar={confirm?.onAceptar}
        onCancelar={() => setConfirm(null)}
        danger={confirm?.danger}
      />
    </div>
  );
}

// ── Pequeño componente de stat card ────────────────────────────────────────
function Stat({ title, value, bg, text }) {
  return (
    <div className={`${bg} ${text} rounded-lg shadow-sm p-3 text-center`}>
      <h5 className="text-sm font-semibold m-0">{title}</h5>
      <h3 className="text-2xl font-bold m-0 mt-1">{value}</h3>
    </div>
  );
}
