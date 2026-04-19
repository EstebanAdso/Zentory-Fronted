import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Search, X, Filter, List, Calendar, Eye, Printer, FileText, Receipt,
} from 'lucide-react';
import { formatNumber, formatearFecha } from '../../utils/formatters';
import {
  generarFacturaHTMLPDF, generarFacturaHTMLPOS,
  abrirVentanaImpresion, abrirVentanaPOS,
} from '../../utils/printing';
import { getFacturas, getFacturaDetalles } from '../../api';

// ── Modal overlay ───────────────────────────────────────────────────────────
function Modal({ show, onClose, children, wide }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/50 flex items-start justify-center pt-[60px] overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-md shadow-xl mb-8 max-w-[96vw] ${wide ? 'w-[1100px]' : 'w-[500px]'}`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Clickable copy cell ─────────────────────────────────────────────────────
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
      className={`cursor-pointer px-2 py-1.5 border border-gray-300 ${className}`}
    >
      {value}
    </td>
  );
}

// ── HTML fragments for print ────────────────────────────────────────────────
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

// ── Stable subcomponents (module-scope = no re-mount on parent re-render) ───
function ColGroup({ agrupada }) {
  return (
    <colgroup>
      <col style={{ width: agrupada ? '12%' : '11%' }} />
      <col style={{ width: agrupada ? '26%' : '22%' }} />
      <col style={{ width: agrupada ? '16%' : '15%' }} />
      <col style={{ width: agrupada ? '14%' : '22%' }} />
      <col style={{ width: agrupada ? '16%' : '15%' }} />
      <col style={{ width: agrupada ? '16%' : '15%' }} />
    </colgroup>
  );
}

function TableHead({ agrupada }) {
  return (
    <thead>
      <tr className="bg-gray-100">
        {['Factura ID', 'Cliente', 'Cédula/NIT', agrupada ? 'Hora' : 'Fecha y Hora', 'Total', 'Acciones'].map((h) => (
          <th key={h} className="px-2.5 py-2 border border-gray-300 font-semibold whitespace-nowrap text-left">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

const FilaFactura = memo(function FilaFactura({ factura, agrupada, onVerDetalles, onImprimir }) {
  const nombre = factura.cliente ? factura.cliente.nombre : 'Cliente no disponible';
  const cedula = factura.cliente ? factura.cliente.identificacion : 'N/A';
  return (
    <tr className="even:bg-gray-50 hover:bg-blue-50 transition-colors">
      <td className="px-2.5 py-1.5 border border-gray-300 truncate" title={factura.serial}>
        {factura.serial}
      </td>
      <td className="px-2.5 py-1.5 border border-gray-300 truncate" title={nombre}>
        {nombre}
      </td>
      <td className="px-2.5 py-1.5 border border-gray-300 truncate" title={cedula}>
        {cedula}
      </td>
      <td className="px-2.5 py-1.5 border border-gray-300 truncate">
        {agrupada
          ? fmtHora(factura.fechaEmision)
          : formatearFecha(new Date(factura.fechaEmision))}
      </td>
      <td className="px-2.5 py-1.5 border border-gray-300 text-[#4488ee] font-bold truncate">
        {formatNumber(factura.total)}
      </td>
      <td className="px-1 py-1 border border-gray-300 text-center whitespace-nowrap">
        <button
          onClick={() => onVerDetalles(factura.id)}
          title="Ver detalles"
          className="inline-flex items-center justify-center bg-[#17a2b8] hover:bg-[#138496] text-white rounded p-1.5 mr-1 transition-colors"
        >
          <Eye size={14} />
        </button>
        <button
          onClick={() => onImprimir(factura)}
          title="Imprimir"
          className="inline-flex items-center justify-center bg-[#28a745] hover:bg-[#218838] text-white rounded p-1.5 transition-colors"
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

// ── Main component ──────────────────────────────────────────────────────────
export default function Ventas() {
  const [todasFacturas, setTodasFacturas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [vistaAgrupada, setVistaAgrupada] = useState(true);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showDetalles, setShowDetalles] = useState(false);
  const [detallesFactura, setDetallesFactura] = useState([]);
  const [showImprimir, setShowImprimir] = useState(false);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getFacturas()
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.fechaEmision) - new Date(a.fechaEmision)
        );
        setTodasFacturas(sorted);
      })
      .catch(() => toast.error('Error al cargar las facturas.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived (filtered list) ──────────────────────────────────────────────
  const facturasFiltradas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    if (!q) return todasFacturas;
    return todasFacturas.filter((f) => {
      const nombre = (f.cliente?.nombre || f.clienteNombre || '').toUpperCase();
      const cedula = (f.cliente?.identificacion || '').toUpperCase();
      return nombre.includes(q) || cedula.includes(q);
    });
  }, [todasFacturas, busqueda]);

  const limpiarBusqueda = useCallback(() => setBusqueda(''), []);

  // ── Details modal ─────────────────────────────────────────────────────────
  const verDetalles = useCallback(async (facturaId) => {
    try {
      const res = await getFacturaDetalles(facturaId);
      setDetallesFactura(res.data);
      setShowDetalles(true);
    } catch {
      toast.error('Error al cargar los detalles de la factura.');
    }
  }, []);

  // ── Print modal ───────────────────────────────────────────────────────────
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

  const totalMostradas = facturasFiltradas.length;
  const totalGeneral = todasFacturas.length;
  const gruposFecha = useMemo(
    () => (vistaAgrupada ? Object.entries(agruparPorFecha(facturasFiltradas)) : []),
    [vistaAgrupada, facturasFiltradas]
  );

  const resultadosColor = busqueda
    ? (totalMostradas > 0 ? 'text-green-600' : 'text-red-600')
    : 'text-gray-500';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4">
        <h1 className="text-center text-2xl font-semibold my-3 select-none">
          Ventas Generadas
        </h1>

        {/* Search + toggle bar */}
        <div className="flex items-start justify-between mb-3.5 gap-2.5 flex-wrap">
          <div className="flex-[0_0_20%]" />

          <div className="flex-[0_0_50%] min-w-[260px]">
            <div className="flex shadow-sm rounded overflow-hidden">
              <span className="flex items-center px-3 bg-white border border-r-0 border-gray-300 text-gray-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o cédula del cliente..."
                autoCorrect="off"
                spellCheck={false}
                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 outline-none focus:border-blue-400"
              />
              <button
                onClick={limpiarBusqueda}
                title="Limpiar búsqueda"
                className="px-3 py-1.5 border border-l-0 border-gray-300 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <small className={`flex items-center justify-center gap-1 mt-1.5 ${resultadosColor}`}>
              {busqueda ? <Filter size={12} /> : <List size={12} />}
              {busqueda
                ? `Mostrando ${totalMostradas} de ${totalGeneral} facturas`
                : `Total: ${totalGeneral} facturas`}
            </small>
          </div>

          <div className="flex-[0_0_20%] text-right">
            <button
              onClick={() => setVistaAgrupada((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-[#007bff] rounded bg-white text-[#007bff] hover:bg-[#007bff] hover:text-white px-3.5 py-1.5 text-sm transition-colors"
            >
              {vistaAgrupada ? <List size={14} /> : <Calendar size={14} />}
              {vistaAgrupada ? 'Vista Normal' : 'Vista Agrupada'}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-center text-gray-500 mt-8">Cargando facturas…</p>
        ) : facturasFiltradas.length === 0 ? (
          <p className="text-center text-red-600 mt-5">
            {busqueda ? 'No se encontraron facturas para esa búsqueda.' : 'No hay facturas disponibles.'}
          </p>
        ) : vistaAgrupada ? (
          gruposFecha.map(([fechaKey, facturas]) => (
            <div key={fechaKey} className="grupo-fecha">
              <h4 className="m-0 px-3 py-2 bg-gray-50 text-base font-semibold border-b border-gray-300">
                {esHoy(fechaKey) ? 'Hoy — ' : ''}{fmtKeyFecha(fechaKey)}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-sm min-w-[900px]">
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
          ))
        ) : (
          <div className="overflow-x-auto mb-8 border border-gray-300 rounded shadow-sm">
            <table className="w-full table-fixed border-collapse text-sm min-w-[1050px]">
              <ColGroup agrupada={false} />
              <TableHead agrupada={false} />
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
        )}
      </div>

      {/* ── MODAL: Detalles de Factura ─────────────────────────────────────── */}
      <Modal show={showDetalles} onClose={() => setShowDetalles(false)} wide>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300">
          <h5 className="m-0 text-base font-semibold">Detalles de Factura</h5>
          <button
            onClick={() => setShowDetalles(false)}
            className="border-0 bg-transparent text-2xl leading-none cursor-pointer text-gray-500 hover:text-gray-700"
          >×</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.85rem]">
            <thead>
              <tr className="bg-gray-100">
                {['Producto', 'Descripción', 'Cantidad', 'Garantía', 'P.C', 'P.V', 'Total P.C', 'Total P.V'].map((h) => (
                  <th key={h} className="px-2 py-2 border border-gray-300 font-semibold whitespace-nowrap text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detallesFactura.map((d, i) => (
                <tr key={i} className="hover:bg-blue-50">
                  <CopyCell value={d.nombreProducto} />
                  <CopyCell value={d.descripcion || ''} />
                  <CopyCell value={d.cantidad} />
                  <CopyCell value={d.garantia} />
                  <CopyCell value={formatNumber(d.precioCompra)} />
                  <CopyCell value={formatNumber(d.precioVenta)} />
                  <CopyCell
                    value={formatNumber(d.cantidad * d.precioCompra)}
                    className="text-[#0db423] font-bold"
                  />
                  <CopyCell
                    value={formatNumber(d.cantidad * d.precioVenta)}
                    className="text-[#4488ee] font-bold"
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-300 text-right">
          <button
            onClick={() => setShowDetalles(false)}
            className="bg-[#17a2b8] hover:bg-[#138496] text-white rounded px-4 py-1.5 text-sm transition-colors"
          >Cerrar</button>
        </div>
      </Modal>

      {/* ── MODAL: Formato de impresión ────────────────────────────────────── */}
      <Modal show={showImprimir} onClose={() => setShowImprimir(false)}>
        <div className="flex items-center px-4 py-3 border-b border-gray-300">
          <h5 className="m-0 text-base flex-1 text-center font-semibold">
            Seleccione el formato de impresión
          </h5>
          <button
            onClick={() => setShowImprimir(false)}
            className="border-0 bg-transparent text-2xl leading-none cursor-pointer text-gray-500 hover:text-gray-700"
          >×</button>
        </div>
        <div className="px-6 py-6 text-center">
          <button
            onClick={imprimirPOS}
            className="inline-flex items-center gap-2 bg-[#28a745] hover:bg-[#218838] text-white rounded px-7 py-2.5 text-base cursor-pointer m-2 transition-colors"
          >
            <Receipt size={18} /> Imprimir POS
          </button>
          <button
            onClick={imprimirPDF}
            className="inline-flex items-center gap-2 bg-[#007bff] hover:bg-[#0069d9] text-white rounded px-7 py-2.5 text-base cursor-pointer m-2 transition-colors"
          >
            <FileText size={18} /> Imprimir PDF
          </button>
        </div>
      </Modal>
    </div>
  );
}
