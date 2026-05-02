import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Search, X, Filter, List, Calendar, Eye, Printer, FileText, Receipt,
  ChevronLeft, ChevronRight, Wallet, Banknote,
} from 'lucide-react';
import { formatNumber, formatearFecha } from '../../utils/formatters';
import {
  generarFacturaHTMLPDF, generarFacturaHTMLPOS,
  abrirVentanaImpresion, abrirVentanaPOS,
} from '../../utils/printing';
import { getFacturas, buscarFacturas, getFacturaDetalles } from '../../api';

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ show, onClose, children, wide }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl mb-8 max-w-[96vw] overflow-hidden ${wide ? 'w-[1100px]' : 'w-[500px]'}`}
      >
        {children}
      </div>
    </div>
  );
}

function CopyCell({ value, className = '' }) {
  const handleClick = () => {
    navigator.clipboard
      .writeText(String(value))
      .then(() => toast.success('Copiado al portapapeles'))
      .catch(() => toast.error('No se pudo copiar'));
  };
  return (
    <td
      onClick={handleClick}
      title="Clic para copiar"
      className={`cursor-pointer px-3 py-2 border-b border-slate-100 hover:bg-[#4488ee]/5 transition-colors ${className}`}
    >
      {value}
    </td>
  );
}

// ── HTML fragments ──────────────────────────────────────────────────────────
const filaProductoPDF = (d) => `
  <tr>
    <td>${d.nombreProducto}</td>
    <td>${d.cantidad}</td>
    <td>${formatNumber(d.precioVenta)}</td>
    <td>${d.garantia}</td>
    <td>${d.descripcion || ''}</td>
    <td>${formatNumber(d.cantidad * d.precioVenta)}</td>
  </tr>
`;

const filaProductoPOS = (d) => `
  <tr style="font-size:12px;font-family:Arial,Helvetica,sans-serif;color:#000">
    <td style="padding:1px 0;text-align:left;max-width:20mm;word-wrap:break-word">${(d.nombreProducto || '').toUpperCase()} - ${d.descripcion || ''}</td>
    <td style="padding:1px 0;text-align:center;max-width:10mm">${d.cantidad}</td>
    <td style="padding:1px 0;text-align:center;max-width:15mm">${formatNumber(d.precioVenta)}</td>
    <td style="padding:1px 0;text-align:center;max-width:15mm">${d.garantia} Mes</td>
    <td style="padding:1px 0;text-align:center">${formatNumber(d.cantidad * d.precioVenta)}</td>
  </tr>
`;

const CLIENTE_PDF_DEFAULT = { nombre: 'Cliente no disponible', identificacion: 'N/A', telefono: '', correo: '', direccion: '' };
const CLIENTE_POS_DEFAULT = { nombre: 'CLIENTE NO REGISTRADO', identificacion: 'N/A', telefono: '', correo: '', direccion: '' };

const fmtHora = (fechaStr) =>
  new Date(fechaStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

function ColGroup({ agrupada }) {
  return (
    <colgroup>
      <col style={{ width: agrupada ? '10%' : '10%' }} />
      <col style={{ width: agrupada ? '22%' : '20%' }} />
      <col style={{ width: agrupada ? '14%' : '13%' }} />
      <col style={{ width: agrupada ? '12%' : '18%' }} />
      <col style={{ width: agrupada ? '16%' : '15%' }} />
      <col style={{ width: agrupada ? '14%' : '12%' }} />
      <col style={{ width: agrupada ? '12%' : '12%' }} />
    </colgroup>
  );
}

function TableHead({ agrupada, sticky }) {
  return (
    <thead className={sticky ? '' : 'bg-slate-50 border-b border-slate-200'}>
      <tr>
        {['Factura ID', 'Cliente', 'Cédula/NIT', agrupada ? 'Hora' : 'Fecha y Hora', 'Pago', 'Total', 'Acciones'].map((h) => (
          <th
            key={h}
            className={`px-3 py-3 font-semibold text-slate-600 uppercase tracking-wide text-xs text-left whitespace-nowrap ${sticky ? 'sticky top-0 z-10 bg-slate-50 border-b border-slate-200' : ''
              }`}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function PagoChip({ pagos }) {
  if (!Array.isArray(pagos) || pagos.length === 0) {
    return <span className="text-slate-300 text-xs italic">—</span>;
  }
  if (pagos.length === 1) {
    const p = pagos[0];
    const esEfectivo = p.cuentaRecaudo?.esEfectivo;
    return (
      <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[0.7rem] font-bold ${
        esEfectivo ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
      }`}>
        {esEfectivo ? <Banknote size={11} /> : <Wallet size={11} />}
        {p.cuentaRecaudo?.nombre || 'N/D'}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[0.7rem] font-bold bg-violet-50 text-violet-700"
      title={pagos.map(p => `${p.cuentaRecaudo?.nombre}: $${formatNumber(p.monto)}`).join(' · ')}
    >
      <Wallet size={11} /> Mixto · {pagos.length}
    </span>
  );
}

const FilaFactura = memo(function FilaFactura({ factura, agrupada, onVerDetalles, onImprimir }) {
  const nombre = factura.cliente ? factura.cliente.nombre : 'Cliente no disponible';
  const cedula = factura.cliente ? factura.cliente.identificacion : 'N/A';
  return (
    <tr className="hover:bg-slate-50/70 border-b border-slate-100 last:border-0 transition-colors">
      <td className="px-3 py-2.5 truncate text-slate-500 font-mono text-xs" title={factura.serial}>
        {factura.serial}
      </td>
      <td className="px-3 py-2.5 truncate font-semibold text-slate-800" title={nombre}>
        {nombre}
      </td>
      <td className="px-3 py-2.5 truncate text-slate-600" title={cedula}>
        {cedula}
      </td>
      <td className="px-3 py-2.5 truncate text-slate-600">
        {agrupada
          ? fmtHora(factura.fechaEmision)
          : formatearFecha(new Date(factura.fechaEmision))}
      </td>
      <td className="px-3 py-2.5 truncate">
        <PagoChip pagos={factura.pagos} />
      </td>
      <td className="px-3 py-2.5 text-[#4488ee] font-bold truncate tabular-nums">
        ${formatNumber(factura.total)}
      </td>
      <td className="px-3 py-2.5 text-center whitespace-nowrap">
        <button
          onClick={() => onVerDetalles(factura.id)}
          title="Ver detalles"
          className="inline-flex items-center justify-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-md p-1.5 mr-1 transition-colors shadow-sm"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={() => onImprimir(factura)}
          title="Imprimir"
          className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-md p-1.5 transition-colors shadow-sm"
        >
          <Printer size={14} />
        </button>
      </td>
    </tr>
  );
});

function agruparPorFecha(facturas) {
  const grupos = {};
  facturas.forEach((f) => {
    const d = new Date(f.fechaEmision);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    (grupos[key] ||= []).push(f);
  });
  return grupos;
}

const esHoy = (fechaKey) => {
  const [y, m, d] = fechaKey.split('-').map(Number);
  return new Date(y, m - 1, d).toDateString() === new Date().toDateString();
};

const fmtKeyFecha = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return formatearFecha(new Date(y, m - 1, d));
};

// ── Main ────────────────────────────────────────────────────────────────────
export default function Ventas() {
  const [todasFacturas, setTodasFacturas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [vistaAgrupada, setVistaAgrupada] = useState(true);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showDetalles, setShowDetalles] = useState(false);
  const [detallesFactura, setDetallesFactura] = useState([]);
  const [pagosFactura, setPagosFactura] = useState([]);
  const [showImprimir, setShowImprimir] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setLoading(true);
    const req = debouncedBusqueda
      ? buscarFacturas(debouncedBusqueda, currentPage, pageSize)
      : getFacturas(currentPage, pageSize);
    req
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => new Date(b.fechaEmision) - new Date(a.fechaEmision));
          setTodasFacturas(sorted);
          setTotalPages(1);
          setTotalElements(sorted.length);
        } else {
          setTodasFacturas(data.content || []);
          setTotalPages(data.totalPages || 0);
          setTotalElements(data.totalElements || 0);
        }
      })
      .catch(() => toast.error('Error al cargar las facturas.'))
      .finally(() => setLoading(false));
  }, [currentPage, pageSize, debouncedBusqueda]);

  const facturasFiltradas = todasFacturas;

  const limpiarBusqueda = useCallback(() => { setBusqueda(''); setCurrentPage(0); }, []);

  const verDetalles = useCallback(async (facturaId) => {
    try {
      const factura = todasFacturas.find(f => f.id === facturaId);
      setPagosFactura(Array.isArray(factura?.pagos) ? factura.pagos : []);
      const res = await getFacturaDetalles(facturaId);
      setDetallesFactura(res.data);
      setShowDetalles(true);
    } catch {
      toast.error('Error al cargar los detalles de la factura.');
    }
  }, [todasFacturas]);

  const abrirImprimir = useCallback((factura) => {
    setFacturaSeleccionada(factura);
    setShowImprimir(true);
  }, []);

  const imprimirPDF = async () => {
    if (!facturaSeleccionada) return;
    const f = facturaSeleccionada;
    const cliente = f.cliente || CLIENTE_PDF_DEFAULT;
    try {
      const { data: detalles } = await getFacturaDetalles(f.id);
      const html = generarFacturaHTMLPDF({
        facturaId: f.id,
        nombreCliente: cliente.nombre,
        cedulaNit: cliente.identificacion,
        telefonoCliente: cliente.telefono || '',
        correoCliente: cliente.correo || '',
        direccionCliente: cliente.direccion || '',
        productosHTML: detalles.map(filaProductoPDF).join(''),
        totalFactura: f.total,
        fechaActual: formatearFecha(new Date(f.fechaEmision)),
      });
      abrirVentanaImpresion(html);
      setShowImprimir(false);
    } catch {
      toast.error('Error al generar el PDF.');
    }
  };

  const imprimirPOS = async () => {
    if (!facturaSeleccionada) return;
    const f = facturaSeleccionada;
    const cliente = f.cliente || CLIENTE_POS_DEFAULT;
    try {
      const { data: detalles } = await getFacturaDetalles(f.id);
      const html = generarFacturaHTMLPOS({
        facturaId: f.id,
        nombreCliente: cliente.nombre,
        cedulaNit: cliente.identificacion,
        telefonoCliente: cliente.telefono || '',
        correoCliente: cliente.correo || '',
        direccionCliente: cliente.direccion || '',
        productosHTML: detalles.map(filaProductoPOS).join(''),
        totalFactura: f.total,
        fechaActual: formatearFecha(new Date(f.fechaEmision)),
      });
      abrirVentanaPOS(html);
      setShowImprimir(false);
    } catch {
      toast.error('Error al generar el ticket POS.');
    }
  };

  const totalGeneral = totalElements;
  const gruposFecha = useMemo(
    () => (vistaAgrupada ? Object.entries(agruparPorFecha(facturasFiltradas)) : []),
    [vistaAgrupada, facturasFiltradas]
  );

  const irAPagina = (page) => {
    if (page < 0 || page >= totalPages) return;
    setCurrentPage(page);
  };
  const maxVisible = 5;
  const startPage = Math.max(0, Math.min(currentPage - Math.floor(maxVisible / 2), totalPages - maxVisible));
  const endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Ventas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {debouncedBusqueda
                ? <><span className="font-bold text-slate-700">{totalGeneral}</span> coincidencias · Página {currentPage + 1} de {Math.max(1, totalPages)}</>
                : <>Total: <span className="font-bold text-slate-700">{totalGeneral}</span> facturas · Página {currentPage + 1} de {Math.max(1, totalPages)}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(0); }}
                placeholder="Buscar por nombre, cédula o serial..."
                autoCorrect="off"
                spellCheck={false}
                className="w-[300px] bg-white border border-slate-200 rounded-lg pl-10 pr-9 h-9 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
              {busqueda && (
                <button
                  onClick={limpiarBusqueda}
                  title="Limpiar"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setVistaAgrupada((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-[#4488ee] bg-white hover:bg-[#4488ee] text-[#4488ee] hover:text-white rounded-lg px-4 h-9 text-sm font-semibold transition-colors"
            >
              {vistaAgrupada ? <List size={14} /> : <Calendar size={14} />}
              {vistaAgrupada ? 'Vista Normal' : 'Agrupar por Fecha'}
            </button>
          </div>
        </div>
      </header>

      {/* Content — no page scroll, content scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full flex flex-col">
          {loading ? (
            <p className="text-center text-slate-400 mt-12">Cargando facturas…</p>
          ) : facturasFiltradas.length === 0 ? (
            <div className="text-center text-slate-400 mt-12">
              <Filter size={40} className="mx-auto mb-3 text-slate-300" />
              <p>{busqueda ? 'No se encontraron facturas para esa búsqueda.' : 'No hay facturas disponibles.'}</p>
            </div>
          ) : vistaAgrupada ? (
            <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
              {gruposFecha.map(([fechaKey, facturas]) => (
                <div key={fechaKey} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 sticky top-0 z-10">
                    <Calendar size={14} className="text-slate-500" />
                    <h4 className="m-0 text-sm font-bold text-slate-700">
                      {esHoy(fechaKey) && <span className="text-[#4488ee] mr-2">Hoy</span>}
                      {fmtKeyFecha(fechaKey)}
                    </h4>
                    <span className="ml-auto text-xs text-slate-500 font-semibold">{facturas.length} facturas</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-sm min-w-[1050px]">
                      <ColGroup agrupada />
                      <TableHead agrupada />
                      <tbody>
                        {facturas.map((f) => (
                          <FilaFactura
                            key={f.id}
                            factura={f}
                            agrupada
                            onVerDetalles={verDetalles}
                            onImprimir={abrirImprimir}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-full overflow-auto">
                <table className="w-full table-fixed text-sm min-w-[1200px]">
                  <ColGroup agrupada={false} />
                  <TableHead agrupada={false} sticky />
                  <tbody>
                    {facturasFiltradas.map((f) => (
                      <FilaFactura
                        key={f.id}
                        factura={f}
                        agrupada={false}
                        onVerDetalles={verDetalles}
                        onImprimir={abrirImprimir}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalElements > 0 && (
            <div className="shrink-0 mt-4 flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <label className="font-semibold">Mostrar:</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(0); }}
                  className="border-2 border-slate-200 rounded-lg px-2 h-9 text-sm outline-none focus:border-[#4488ee] bg-white"
                >
                  <option value="10">10</option>
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
          )}
        </div>
      </main>

      {/* MODAL: Detalles */}
      <Modal show={showDetalles} onClose={() => setShowDetalles(false)} wide>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <h5 className="m-0 text-base font-bold">Detalles de Factura</h5>
          <button onClick={() => setShowDetalles(false)} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        {pagosFactura.length > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-[0.65rem] font-black text-slate-500 uppercase tracking-wider mb-2">
              <Wallet size={12} /> Cuenta{pagosFactura.length === 1 ? '' : 's'} de recaudo
            </div>
            <div className="flex flex-wrap gap-2">
              {pagosFactura.map((p, i) => {
                const esEfectivo = p.cuentaRecaudo?.esEfectivo;
                return (
                  <div
                    key={i}
                    className={`inline-flex items-center gap-2 px-3 h-8 rounded-lg border ${
                      esEfectivo
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-sky-50 border-sky-200 text-sky-800'
                    }`}
                  >
                    {esEfectivo ? <Banknote size={14} /> : <Wallet size={14} />}
                    <span className="text-xs font-bold">{p.cuentaRecaudo?.nombre || 'N/D'}</span>
                    <span className="text-xs font-black tabular-nums">${formatNumber(p.monto)}</span>
                    {p.referencia && (
                      <span className="text-[0.65rem] text-slate-500 font-mono border-l border-slate-300 pl-2">
                        {p.referencia}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                {['Producto', 'Descripción', 'Cantidad', 'Garantía', 'P.C', 'P.V', 'Total P.C', 'Total P.V'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-semibold text-slate-600 uppercase tracking-wide text-xs text-left whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detallesFactura.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <CopyCell value={d.nombreProducto} className="font-semibold text-slate-800" />
                  <CopyCell value={d.descripcion || ''} />
                  <CopyCell value={d.cantidad} className="text-center" />
                  <CopyCell value={d.garantia} />
                  <CopyCell value={formatNumber(d.precioCompra)} className="text-right tabular-nums" />
                  <CopyCell value={formatNumber(d.precioVenta)} className="text-right tabular-nums" />
                  <CopyCell
                    value={formatNumber(d.cantidad * d.precioCompra)}
                    className="text-right tabular-nums text-emerald-600 font-bold"
                  />
                  <CopyCell
                    value={formatNumber(d.cantidad * d.precioVenta)}
                    className="text-right tabular-nums text-[#4488ee] font-bold"
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-200 text-right bg-slate-50">
          <button
            onClick={() => setShowDetalles(false)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg px-5 h-9 text-sm font-semibold transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      {/* MODAL: Formato impresión */}
      <Modal show={showImprimir} onClose={() => setShowImprimir(false)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <h5 className="m-0 text-base font-bold">Seleccione el formato de impresión</h5>
          <button onClick={() => setShowImprimir(false)} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-8 text-center flex justify-center gap-3 flex-wrap">
          <button
            onClick={imprimirPOS}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-6 h-11 text-sm font-semibold transition-colors shadow-sm"
          >
            <Receipt size={18} /> Imprimir POS
          </button>
          <button
            onClick={imprimirPDF}
            className="inline-flex items-center gap-2 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg px-6 h-11 text-sm font-semibold transition-colors shadow-sm"
          >
            <FileText size={18} /> Imprimir PDF
          </button>
        </div>
      </Modal>
    </div>
  );
}
