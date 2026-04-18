import { useState, useEffect } from 'react';
import { formatNumber, formatearFecha } from '../../utils/formatters';
import { generarFacturaHTMLPDF, generarFacturaHTMLPOS } from '../../utils/printing';
import { getFacturas, getFacturaDetalles } from '../../api/index';

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
      <div style={{
        background: '#fff', borderRadius: '6px',
        width: wide ? '900px' : '500px',
        maxWidth: '96vw',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        marginBottom: '30px',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Clickable copy cell ─────────────────────────────────────────────────────
function CopyCell({ value, extraStyle }) {
  const [copied, setCopied] = useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <td
      onClick={handleClick}
      title="Clic para copiar"
      style={{ cursor: 'pointer', padding: '6px 8px', border: '1px solid #dee2e6', ...extraStyle }}
    >
      {copied && (
        <span style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', padding: '5px 12px',
          borderRadius: '5px', fontSize: '0.85em', pointerEvents: 'none', zIndex: 9999,
        }}>Copiado</span>
      )}
      {value}
    </td>
  );
}

export default function Ventas() {
  const [todasFacturas, setTodasFacturas] = useState([]);
  const [facturasFiltradas, setFacturasFiltradas] = useState([]);
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
        setFacturasFiltradas(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtrar = (texto) => {
    setBusqueda(texto);
    if (!texto.trim()) {
      setFacturasFiltradas(todasFacturas);
      return;
    }
    const q = texto.trim().toUpperCase();
    setFacturasFiltradas(
      todasFacturas.filter((f) => {
        const nombre = (f.cliente?.nombre || f.clienteNombre || '').toUpperCase();
        const cedula = (f.cliente?.identificacion || '').toUpperCase();
        return nombre.includes(q) || cedula.includes(q);
      })
    );
  };

  const limpiarBusqueda = () => {
    setBusqueda('');
    setFacturasFiltradas(todasFacturas);
  };

  // ── Details modal ─────────────────────────────────────────────────────────
  const verDetalles = async (facturaId) => {
    try {
      const res = await getFacturaDetalles(facturaId);
      setDetallesFactura(res.data);
      setShowDetalles(true);
    } catch {
      alert('Error al cargar los detalles de la factura.');
    }
  };

  // ── Print modal ───────────────────────────────────────────────────────────
  const abrirImprimir = (factura) => {
    setFacturaSeleccionada(factura);
    setShowImprimir(true);
  };

  const imprimirPDF = async () => {
    if (!facturaSeleccionada) return;
    const f = facturaSeleccionada;
    const cliente = f.cliente || { nombre: 'Cliente no disponible', identificacion: 'N/A', telefono: '', correo: '', direccion: '' };
    try {
      const res = await getFacturaDetalles(f.id);
      const detalles = res.data;
      const productosHTML = detalles.map((d) => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px">${d.nombreProducto}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center">${d.cantidad}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatNumber(d.precioVenta)}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:center">${d.garantia}</td>
          <td style="border:1px solid #ddd;padding:8px">${d.descripcion || ''}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right">${formatNumber(d.cantidad * d.precioVenta)}</td>
        </tr>
      `).join('');
      const html = generarFacturaHTMLPDF({
        facturaId: f.id,
        nombreCliente: cliente.nombre,
        cedulaNit: cliente.identificacion,
        telefonoCliente: cliente.telefono || '',
        correoCliente: cliente.correo || '',
        direccionCliente: cliente.direccion || '',
        productosHTML,
        totalFactura: f.total,
        fechaActual: formatearFecha(new Date(f.fechaEmision)),
      });
      const ventana = window.open('', '_blank', 'height=1200,width=800');
      ventana.document.write(`<html><head><title>Factura</title><style>body{font-family:Arial,sans-serif}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px}th{background:#f2f2f2}h1,h2,h3{text-align:center}</style></head><body>${html}</body></html>`);
      ventana.document.close();
      ventana.onload = () => { ventana.focus(); ventana.print(); };
      setShowImprimir(false);
    } catch {
      alert('Error al generar el PDF.');
    }
  };

  const imprimirPOS = async () => {
    if (!facturaSeleccionada) return;
    const f = facturaSeleccionada;
    const cliente = f.cliente || { nombre: 'CLIENTE NO REGISTRADO', identificacion: 'N/A', telefono: '', correo: '', direccion: '' };
    try {
      const res = await getFacturaDetalles(f.id);
      const detalles = res.data;
      const productosHTML = detalles.map((d) => `
        <tr style="font-size:12px;font-family:Arial,Helvetica,sans-serif;color:#000">
          <td style="padding:1px 0;text-align:left;max-width:20mm;word-wrap:break-word">${d.nombreProducto.toUpperCase()} - ${d.descripcion || ''}</td>
          <td style="padding:1px 0;text-align:center;max-width:10mm">${d.cantidad}</td>
          <td style="padding:1px 0;text-align:center;max-width:15mm">${formatNumber(d.precioVenta)}</td>
          <td style="padding:1px 0;text-align:center;max-width:15mm">${d.garantia} Mes</td>
          <td style="padding:1px 0;text-align:center">${formatNumber(d.cantidad * d.precioVenta)}</td>
        </tr>
      `).join('');
      const html = generarFacturaHTMLPOS({
        facturaId: f.id,
        nombreCliente: cliente.nombre,
        cedulaNit: cliente.identificacion,
        telefonoCliente: cliente.telefono || '',
        correoCliente: cliente.correo || '',
        direccionCliente: cliente.direccion || '',
        productosHTML,
        totalFactura: f.total,
        fechaActual: formatearFecha(new Date(f.fechaEmision)),
      });
      const posStyle = `@page{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;color:#000;-webkit-print-color-adjust:exact}table{width:100%;border-collapse:collapse;color:#000}th,td{padding:2px 0;text-align:right;color:#000}th{text-align:center}h2,h3,h4{text-align:center;margin:2px 0;color:#000}`;
      const ventana = window.open('', '_blank', 'height=900,width=300');
      ventana.document.write(`<html><head><title>Factura POS</title><style>${posStyle}</style></head><body>${html}</body></html>`);
      ventana.document.close();
      ventana.onload = () => { ventana.focus(); ventana.print(); };
      setShowImprimir(false);
    } catch {
      alert('Error al generar el ticket POS.');
    }
  };

  // ── Group by date ─────────────────────────────────────────────────────────
  const agruparPorFecha = (facturas) => {
    const grupos = {};
    facturas.forEach((f) => {
      const d = new Date(f.fechaEmision);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(f);
    });
    return grupos;
  };

  const fmtHora = (fechaStr) =>
    new Date(fechaStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const esHoy = (fechaKey) => {
    const [y, m, d] = fechaKey.split('-').map(Number);
    return new Date(y, m - 1, d).toDateString() === new Date().toDateString();
  };

  const fmtKeyFecha = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return formatearFecha(new Date(y, m - 1, d));
  };

  // ── Table row ─────────────────────────────────────────────────────────────
  const FilaFactura = ({ factura, agrupada }) => (
    <tr>
      <td style={{ padding: '7px 10px', border: '1px solid #dee2e6' }}>{factura.serial}</td>
      <td style={{ padding: '7px 10px', border: '1px solid #dee2e6' }}>
        {factura.cliente ? factura.cliente.nombre : 'Cliente no disponible'}
      </td>
      <td style={{ padding: '7px 10px', border: '1px solid #dee2e6' }}>
        {factura.cliente ? factura.cliente.identificacion : 'N/A'}
      </td>
      <td style={{ padding: '7px 10px', border: '1px solid #dee2e6' }}>
        {agrupada
          ? fmtHora(factura.fechaEmision)
          : formatearFecha(new Date(factura.fechaEmision))}
      </td>
      <td style={{ padding: '7px 10px', border: '1px solid #dee2e6', color: '#4488ee', fontWeight: 'bold' }}>
        {formatNumber(factura.total)}
      </td>
      <td style={{ padding: '7px 6px', border: '1px solid #dee2e6', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <button
          onClick={() => verDetalles(factura.id)}
          style={{ backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.85em', cursor: 'pointer', marginRight: '4px' }}
        >Ver detalles</button>
        <button
          onClick={() => abrirImprimir(factura)}
          style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.85em', cursor: 'pointer' }}
        >Imprimir</button>
      </td>
    </tr>
  );

  const TableHead = ({ agrupada }) => (
    <thead>
      <tr style={{ backgroundColor: '#f1f3f5' }}>
        {['Factura ID', 'Cliente', 'Cédula/NIT', agrupada ? 'Hora' : 'Fecha y Hora', 'Total', 'Acciones'].map((h) => (
          <th key={h} style={{ padding: '8px 10px', border: '1px solid #dee2e6', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
        ))}
      </tr>
    </thead>
  );

  const totalMostradas = facturasFiltradas.length;
  const totalGeneral = todasFacturas.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: '55px', minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{ width: '90%', maxWidth: '2200px', margin: '0 auto', padding: '0 15px' }}>

        <h1 style={{ textAlign: 'center', fontSize: '1.6em', margin: '12px 0 14px', userSelect: 'none' }}>
          Ventas Generadas
        </h1>

        {/* Search + toggle bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 20%' }} />

          <div style={{ flex: '0 0 50%', minWidth: '260px' }}>
            <div style={{ display: 'flex', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => filtrar(e.target.value)}
                placeholder="Buscar por nombre o cédula del cliente..."
                autoCorrect="off"
                spellCheck={false}
                style={{
                  flex: 1, padding: '6px 10px', fontSize: '0.9em',
                  border: '1px solid #ced4da', borderRight: 'none',
                  borderRadius: '4px 0 0 4px', outline: 'none',
                }}
              />
              <button
                onClick={limpiarBusqueda}
                title="Limpiar búsqueda"
                style={{
                  padding: '6px 12px', border: '1px solid #ced4da',
                  borderRadius: '0 4px 4px 0', backgroundColor: '#fff',
                  cursor: 'pointer', fontSize: '0.85em', color: '#6c757d',
                }}
              >X</button>
            </div>
            <small style={{
              display: 'block', textAlign: 'center', marginTop: '6px',
              color: busqueda ? (totalMostradas > 0 ? '#28a745' : '#dc3545') : '#6c757d',
            }}>
              {busqueda
                ? `Mostrando ${totalMostradas} de ${totalGeneral} facturas`
                : `Total: ${totalGeneral} facturas`}
            </small>
          </div>

          <div style={{ flex: '0 0 20%', textAlign: 'right' }}>
            <button
              onClick={() => setVistaAgrupada((v) => !v)}
              style={{
                border: '1px solid #007bff', borderRadius: '4px', backgroundColor: '#fff',
                color: '#007bff', padding: '6px 14px', fontSize: '0.9em', cursor: 'pointer',
              }}
            >
              {vistaAgrupada ? 'Vista Normal' : 'Vista Agrupada'}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '30px' }}>Cargando facturas…</p>
        ) : facturasFiltradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#dc3545', marginTop: '20px' }}>No hay facturas disponibles.</p>
        ) : vistaAgrupada ? (
          Object.entries(agruparPorFecha(facturasFiltradas)).map(([fechaKey, facturas]) => (
            <div key={fechaKey} className="grupo-fecha" style={{ marginBottom: '2rem' }}>
              <h4 style={{ margin: 0, padding: '8px 12px', backgroundColor: '#f8f9fa', fontSize: '1em', fontWeight: 600 }}>
                {esHoy(fechaKey) ? 'Hoy - ' : ''}{fmtKeyFecha(fechaKey)}
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                  <TableHead agrupada={true} />
                  <tbody>
                    {facturas.map((f) => <FilaFactura key={f.id} factura={f} agrupada={true} />)}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ) : (
          <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <TableHead agrupada={false} />
              <tbody>
                {facturasFiltradas.map((f) => <FilaFactura key={f.id} factura={f} agrupada={false} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: Detalles de Factura ───────────────────────────────────── */}
      <Modal show={showDetalles} onClose={() => setShowDetalles(false)} wide>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em' }}>Detalles de Factura</h5>
          <button onClick={() => setShowDetalles(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f3f5' }}>
                {['Producto', 'Descripción', 'Cantidad', 'Garantía', 'P.C', 'P.V', 'Total P.C', 'Total P.V'].map((h) => (
                  <th key={h} style={{ padding: '8px', border: '1px solid #dee2e6', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detallesFactura.map((d, i) => (
                <tr key={i}>
                  <CopyCell value={d.nombreProducto} />
                  <CopyCell value={d.descripcion || ''} />
                  <CopyCell value={d.cantidad} />
                  <CopyCell value={d.garantia} />
                  <CopyCell value={formatNumber(d.precioCompra)} />
                  <CopyCell value={formatNumber(d.precioVenta)} />
                  <CopyCell value={formatNumber(d.cantidad * d.precioCompra)} extraStyle={{ color: '#0db423', fontWeight: 'bold' }} />
                  <CopyCell value={formatNumber(d.cantidad * d.precioVenta)} extraStyle={{ color: '#4488ee', fontWeight: 'bold' }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #dee2e6', textAlign: 'right' }}>
          <button
            onClick={() => setShowDetalles(false)}
            style={{ backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer' }}
          >Cerrar</button>
        </div>
      </Modal>

      {/* ── MODAL: Formato de impresión ──────────────────────────────────── */}
      <Modal show={showImprimir} onClose={() => setShowImprimir(false)}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #dee2e6' }}>
          <h5 style={{ margin: 0, fontSize: '1em', flex: 1, textAlign: 'center' }}>Seleccione el formato de impresión</h5>
          <button onClick={() => setShowImprimir(false)} style={{ border: 'none', background: 'none', fontSize: '1.3em', cursor: 'pointer', color: '#888' }}>&times;</button>
        </div>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <button
            onClick={imprimirPOS}
            style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 28px', fontSize: '1em', cursor: 'pointer', margin: '8px' }}
          >Imprimir POS</button>
          <button
            onClick={imprimirPDF}
            style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 28px', fontSize: '1em', cursor: 'pointer', margin: '8px' }}
          >Imprimir PDF</button>
        </div>
      </Modal>
    </div>
  );
}
