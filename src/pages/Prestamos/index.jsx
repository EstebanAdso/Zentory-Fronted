import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Search, RefreshCw, Printer, FileText, FileCheck, Ban, Receipt,
  Package, ChevronDown, HandCoins, Bookmark, DollarSign, TrendingDown,
  X, CreditCard, Loader2,
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
  PRESTAMO: 'bg-amber-100 text-amber-800 border-amber-200',
  APARTADO: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

const ESTADO_BADGE = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PAGADO: { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CANCELADO: { label: 'Pagado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ANULADO: { label: 'Anulado', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// ── Card de préstamo ────────────────────────────────────────────────────────
const PrestamoCard = memo(function PrestamoCard({ prestamo, productos, onClick, onHoverPrefetch }) {
  const porcentaje = prestamo.total > 0
    ? Math.round((prestamo.totalAbonado / prestamo.total) * 100)
    : 0;
  const porcentajeMostrar =
    prestamo.estado === 'CANCELADO' || prestamo.estado === 'PAGADO' ? 100 : porcentaje;
  const fecha = new Date(prestamo.fechaCreacion).toLocaleDateString('es-CO');
  const estado = ESTADO_BADGE[prestamo.estado] || { label: prestamo.estado, cls: 'bg-slate-100 text-slate-700 border-slate-200' };

  const totalItems = productos?.reduce((s, p) => s + (p.cantidad || 0), 0) ?? 0;
  const loading = productos === null;
  const empty = Array.isArray(productos) && productos.length === 0;

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
          relative bg-white rounded-xl border border-slate-200 shadow-sm
          hover:shadow-lg hover:-translate-y-0.5 hover:border-[#4488ee]/40
          cursor-pointer transition-all duration-200 ease-out p-4
          outline-none focus-visible:ring-2 focus-visible:ring-[#4488ee]
          ${open ? 'z-20 ring-2 ring-[#4488ee]/30 border-[#4488ee]/40' : ''}
        `}
      >
        {/* Header: serial + badges */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h6 className="font-bold text-sm m-0 truncate text-slate-800" title={prestamo.serial}>
            {prestamo.serial}
          </h6>
          <div className="flex gap-1 flex-wrap justify-end shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${TIPO_BADGE[prestamo.tipo]}`}>
              {prestamo.tipo === 'PRESTAMO' ? 'Préstamo' : 'Apartado'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${estado.cls}`}>
              {estado.label}
            </span>
          </div>
        </div>

        {/* Cliente + fecha */}
        <p className="text-sm font-semibold mb-0.5 truncate text-slate-900" title={prestamo.clienteNombre}>
          {prestamo.clienteNombre}
        </p>
        <p className="text-slate-500 text-xs mb-3">{fecha}</p>

        {/* Progreso */}
        <div className="relative w-full bg-slate-100 rounded-full h-5 mb-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
            style={{ width: `${porcentajeMostrar}%` }}
          >
            {porcentajeMostrar > 8 && `${porcentajeMostrar}%`}
          </div>
          {porcentajeMostrar <= 8 && (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-600">
              {porcentajeMostrar}%
            </span>
          )}
        </div>

        {/* Montos */}
        <div className="flex justify-between text-xs mb-2">
          <span className="text-slate-500">Abonado: <span className="text-emerald-600 font-bold tabular-nums">${formatNumber(prestamo.totalAbonado)}</span></span>
          <span className="text-slate-500">Pendiente: <span className="text-rose-600 font-bold tabular-nums">${formatNumber(prestamo.saldoPendiente)}</span></span>
        </div>

        <p className="text-right font-black text-base text-slate-900 tabular-nums">
          ${formatNumber(prestamo.total)}
        </p>

        {/* Indicador: productos */}
        <div className={`mt-2 pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors ${open ? 'text-[#4488ee]' : 'text-slate-400'}`}>
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
                    <div className="h-3 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-3/5" />
                  </div>
                ) : empty ? (
                  <p className="text-xs text-slate-400 italic text-center">Sin productos</p>
                ) : productos ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Productos
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}
                      </span>
                    </div>
                    <ul className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {productos.map((p, i) => (
                        <li key={i} className="flex items-center justify-between text-xs gap-2 py-0.5">
                          <span className="truncate flex-1 text-slate-700" title={p.nombreProducto}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4488ee] mr-1.5 align-middle" />
                            {p.nombreProducto || 'N/A'}
                          </span>
                          <span className="text-slate-600 whitespace-nowrap tabular-nums">
                            <span className="bg-slate-100 rounded px-1.5 py-0.5 mr-1 font-bold text-[10px]">
                              x{p.cantidad}
                            </span>
                            ${formatNumber(p.cantidad * p.precioVenta)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-slate-400 text-center mt-2 italic">
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

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, iconBg, iconFg }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg ${iconBg} ${iconFg} flex items-center justify-center shrink-0`}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-black text-slate-900 tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Modal base ──────────────────────────────────────────────────────────────
function Modal({ show, onClose, children, wide = true }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-8 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl mb-8 max-w-[96vw] overflow-hidden ${wide ? 'w-[960px]' : 'w-[540px]'}`}>
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

  const [showDetalle, setShowDetalle] = useState(false);
  const [prestamoSel, setPrestamoSel] = useState(null);
  const [productos, setProductos] = useState([]);
  const [abonos, setAbonos] = useState([]);

  const [montoAbono, setMontoAbono] = useState('');
  const [metodoAbono, setMetodoAbono] = useState('EFECTIVO');
  const [obsAbono, setObsAbono] = useState('');

  const [confirm, setConfirm] = useState(null);

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

  const prestamosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return prestamos;
    return prestamos.filter((p) =>
      (p.clienteNombre || '').toLowerCase().includes(q) ||
      (p.cliente?.identificacion || '').includes(q)
    );
  }, [prestamos, busqueda]);

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
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <HandCoins size={26} className="text-[#4488ee]" /> Préstamos y Apartados
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading ? 'Cargando…' : `${prestamosFiltrados.length} ${prestamosFiltrados.length === 1 ? 'registro' : 'registros'}`}
            </p>
          </div>
          <button
            onClick={() => { cargarPrestamos(); cargarResumen(); }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#4488ee] hover:bg-[#3672c9] disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[1800px] mx-auto w-full">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard icon={HandCoins} label="Préstamos Pendientes" value={resumen.prestamosPend} iconBg="bg-amber-50" iconFg="text-amber-600" />
            <StatCard icon={Bookmark} label="Apartados Pendientes" value={resumen.apartadosPend} iconBg="bg-cyan-50" iconFg="text-cyan-600" />
            <StatCard icon={TrendingDown} label="Total Por Cobrar" value={`$${formatNumber(resumen.totalPorCobrar)}`} iconBg="bg-rose-50" iconFg="text-rose-600" />
            <StatCard icon={DollarSign} label="Total Abonado" value={`$${formatNumber(resumen.totalAbonado)}`} iconBg="bg-emerald-50" iconFg="text-emerald-600" />
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                >
                  <option value="">Todos</option>
                  <option value="PRESTAMO">Préstamos</option>
                  <option value="APARTADO">Apartados</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                >
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="PAGADO">Pagados (Facturados)</option>
                  <option value="ANULADO">Anulados</option>
                  <option value="">Todos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Buscar Cliente</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre o cédula..."
                    className="w-full pl-9 pr-3 h-10 border-2 border-slate-200 rounded-lg text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-16">
              <Loader2 size={32} className="animate-spin text-[#4488ee] mx-auto" />
              <p className="mt-2 text-slate-500 text-sm">Cargando préstamos…</p>
            </div>
          ) : prestamosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <HandCoins size={40} className="mx-auto text-slate-300" />
              <p className="mt-2 text-slate-500 text-sm">
                No hay préstamos o apartados con los filtros seleccionados
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      </main>

      {/* ── Modal Detalle ───────────────────────────────────────────────────── */}
      <Modal show={showDetalle} onClose={() => setShowDetalle(false)}>
        {prestamoSel && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div>
                <h5 className="m-0 text-lg font-black flex items-center gap-2">
                  {prestamoSel.tipo === 'PRESTAMO' ? <HandCoins size={20} className="text-amber-400" /> : <Bookmark size={20} className="text-cyan-400" />}
                  {tipoTexto} · {prestamoSel.serial}
                </h5>
                <p className="text-xs text-slate-300 mt-0.5">{prestamoSel.clienteNombre}</p>
              </div>
              <button
                onClick={() => setShowDetalle(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            <div className="px-6 py-5 max-h-[75vh] overflow-y-auto">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total</p>
                  <p className="text-xl font-black text-slate-900 tabular-nums">${formatNumber(prestamoSel.total)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Abonado</p>
                  <p className="text-xl font-black text-emerald-700 tabular-nums">${formatNumber(prestamoSel.totalAbonado)}</p>
                </div>
                <div className="bg-rose-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Pendiente</p>
                  <p className="text-xl font-black text-rose-700 tabular-nums">${formatNumber(prestamoSel.saldoPendiente)}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-1">
                <strong className="text-slate-700">Fecha:</strong> {new Date(prestamoSel.fechaCreacion).toLocaleString('es-CO')}
              </p>

              {/* Barra de progreso */}
              <div className="relative w-full bg-slate-100 rounded-full h-6 mb-4 mt-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full flex items-center justify-center text-white text-sm font-bold transition-all"
                  style={{ width: `${porcentajeDetMostrar}%` }}
                >
                  {porcentajeDetMostrar > 8 && `${porcentajeDetMostrar}%`}
                </div>
                {porcentajeDetMostrar <= 8 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-600">
                    {porcentajeDetMostrar}%
                  </span>
                )}
              </div>

              {prestamoSel.observaciones && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-0.5">Observaciones</p>
                  <p className="text-sm text-amber-900">{prestamoSel.observaciones}</p>
                </div>
              )}

              {/* Productos */}
              <h6 className="font-bold text-sm mb-2 text-slate-700 flex items-center gap-1.5">
                <Package size={14} /> Productos
              </h6>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide">Producto</th>
                      <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-20">Cantidad</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-28">Precio</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((d, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-slate-800">{d.nombreProducto || 'N/A'}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{d.cantidad}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${formatNumber(d.precioVenta)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">${formatNumber(d.cantidad * d.precioVenta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Abonos */}
              <h6 className="font-bold text-sm mb-2 text-slate-700 flex items-center gap-1.5">
                <Receipt size={14} /> Historial de Abonos
              </h6>
              <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide">Fecha</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-600 text-xs uppercase tracking-wide w-28">Monto</th>
                      <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32">Método</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide">Observación</th>
                      <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-20">Recibo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-slate-500 py-6 text-sm">
                          Sin abonos registrados
                        </td>
                      </tr>
                    ) : (
                      abonos.map((a, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-700">{new Date(a.fechaAbono).toLocaleString('es-CO')}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-bold tabular-nums">${formatNumber(a.monto)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                              {a.metodoPago || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{a.observacion || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => imprimirRecibo(a, i)}
                              title="Imprimir recibo"
                              className="inline-flex items-center justify-center w-8 h-8 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-lg transition-colors"
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
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
                  <h6 className="font-bold text-sm mb-3 text-slate-700 flex items-center gap-1.5">
                    <CreditCard size={14} /> Registrar Nuevo Abono
                  </h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Monto</label>
                      <input
                        type="text"
                        value={montoAbono}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          setMontoAbono(raw ? Number(raw).toLocaleString('es-CO') : '');
                        }}
                        placeholder="$0"
                        className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Método</label>
                      <select
                        value={metodoAbono}
                        onChange={(e) => setMetodoAbono(e.target.value)}
                        className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                      >
                        {METODOS_PAGO.map((m) => (
                          <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Observación</label>
                      <input
                        type="text"
                        value={obsAbono}
                        onChange={(e) => setObsAbono(e.target.value)}
                        placeholder="Opcional"
                        className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                      />
                    </div>
                  </div>
                  <button
                    onClick={registrarAbono}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 h-10 text-sm font-bold transition-colors shadow-sm shadow-emerald-600/20"
                  >
                    <DollarSign size={16} /> Registrar Abono
                  </button>
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={imprimirPOS}
                className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-3 h-9 text-sm font-semibold transition-colors"
              >
                <Printer size={14} /> POS
              </button>
              <button
                onClick={imprimirPDF}
                className="inline-flex items-center gap-1.5 border-2 border-cyan-600 text-cyan-600 hover:bg-cyan-50 rounded-lg px-3 h-9 text-sm font-semibold transition-colors"
              >
                <FileText size={14} /> PDF
              </button>
              {esPendiente && (
                <>
                  <button
                    onClick={confirmarConvertirFactura}
                    className="inline-flex items-center gap-1.5 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg px-3 h-9 text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
                  >
                    <FileCheck size={14} /> Convertir a Factura
                  </button>
                  <button
                    onClick={confirmarAnular}
                    className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3 h-9 text-sm font-semibold transition-colors"
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
