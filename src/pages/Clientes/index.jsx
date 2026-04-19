import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Search, Trophy, X, RefreshCw, Users, Award,
  IdCard, Phone, MapPin, Mail,
} from 'lucide-react';
import { formatNumber } from '../../utils/formatters';
import {
  getClientes, crearCliente, actualizarCliente, getTopClientes,
} from '../../api';

// ── Fila de tabla ───────────────────────────────────────────────────────────
const FilaCliente = memo(function FilaCliente({ cliente, onEditar }) {
  return (
    <tr className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">{cliente.id}</td>
      <td className="px-4 py-3 font-semibold uppercase text-slate-800">{cliente.nombre}</td>
      <td className="px-4 py-3 text-slate-600">{cliente.identificacion || <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3 text-slate-600">{cliente.telefono || <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3 text-slate-600 truncate">{cliente.direccion || <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3 text-slate-600 truncate">{cliente.correo || <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onEditar(cliente)}
          title="Editar cliente"
          className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-sm"
        >
          <Pencil size={12} /> Editar
        </button>
      </td>
    </tr>
  );
});

// ── Stat card ───────────────────────────────────────────────────────────────
function Stat({ icon: Icon, title, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">{title}</p>
        <p className="text-2xl font-black text-slate-900 mt-0.5 truncate tabular-nums">{value}</p>
      </div>
    </div>
  );
}

// ── Modal base ──────────────────────────────────────────────────────────────
function Modal({ show, onClose, title, wide = false, children, headerCls = 'bg-slate-900' }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-2xl shadow-2xl mb-8 max-w-[96vw] overflow-hidden ${wide ? 'w-[760px]' : 'w-[540px]'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 ${headerCls} text-white`}>
          <h5 className="m-0 text-base font-bold">{title}</h5>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
const FORM_INICIAL = { nombre: '', identificacion: '', telefono: '', direccion: '', correo: '' };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  const [showTop, setShowTop] = useState(false);
  const [top, setTop] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  const cargarClientes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getClientes();
      const lista = Array.isArray(data) ? data : (data?.content ?? []);
      lista.sort((a, b) => b.id - a.id);
      setClientes(lista);
    } catch {
      toast.error('Error al cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.identificacion || '').toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  const abrirAgregar = () => {
    setEditingId(null);
    setForm(FORM_INICIAL);
    setShowModal(true);
  };

  const abrirEditar = useCallback((c) => {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre || '',
      identificacion: c.identificacion || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      correo: c.correo || '',
    });
    setShowModal(true);
  }, []);

  const cerrarModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(FORM_INICIAL);
  };

  const onChange = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    const payload = {
      nombre: form.nombre.trim() || null,
      identificacion: form.identificacion.trim() || null,
      telefono: form.telefono.trim() || null,
      direccion: form.direccion.trim() || null,
      correo: form.correo.trim() || null,
    };
    setSaving(true);
    try {
      if (editingId) {
        await actualizarCliente(editingId, payload);
        toast.success('Cliente actualizado.');
      } else {
        await crearCliente(payload);
        toast.success('Cliente agregado.');
      }
      cerrarModal();
      cargarClientes();
    } catch (err) {
      const msg = String(err.response?.data?.message || err.response?.data || err.message);
      if (msg.includes('Duplicate entry')) {
        toast.error('La identificación del cliente ya existe.');
      } else {
        toast.error('Error al guardar el cliente. Puede que algún campo esté duplicado.');
      }
    } finally {
      setSaving(false);
    }
  };

  const verTop = async () => {
    setShowTop(true);
    setLoadingTop(true);
    try {
      const { data } = await getTopClientes();
      setTop(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al obtener clientes top.');
    } finally {
      setLoadingTop(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clientes</h1>
            <p className="text-sm text-slate-500 mt-0.5">Administra la base de datos de clientes del negocio</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cargarClientes()}
              className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-3.5 h-9 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            <button
              onClick={verTop}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 h-9 text-sm font-semibold transition-colors shadow-sm shadow-amber-500/20"
            >
              <Trophy size={14} /> Clientes Top
            </button>
            <button
              onClick={abrirAgregar}
              className="inline-flex items-center gap-1.5 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg px-4 h-9 text-sm font-semibold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              <Plus size={14} /> Agregar Cliente
            </button>
          </div>
        </div>
      </header>

      {/* Content — no page scroll, only table scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full flex flex-col gap-4">
          {/* Stats + search — fixed */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Stat icon={Users} title="Clientes registrados" value={clientes.length}
              accent="bg-blue-50 text-blue-600" />
            <Stat icon={Search} title="Coincidencias" value={clientesFiltrados.length}
              accent="bg-cyan-50 text-cyan-600" />
          </div>

          <div className="shrink-0">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                placeholder="Buscar por nombre o identificación..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 shadow-sm transition-all"
              />
            </div>
          </div>

          {/* Tabla — fills remaining space, scrolls internally */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-16 border-b border-slate-200">ID</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs border-b border-slate-200">Nombre</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs w-36 border-b border-slate-200">Identificación</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs w-32 border-b border-slate-200">Teléfono</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs border-b border-slate-200">Dirección</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs w-52 border-b border-slate-200">Correo</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-28 border-b border-slate-200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-12">Cargando clientes…</td></tr>
                  ) : clientesFiltrados.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-12">
                      <Users size={32} className="mx-auto mb-2 text-slate-300" />
                      {busqueda ? 'Sin coincidencias para la búsqueda' : 'No hay clientes registrados'}
                    </td></tr>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <FilaCliente key={c.id} cliente={c} onEditar={abrirEditar} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal agregar/editar */}
      <Modal
        show={showModal}
        onClose={cerrarModal}
        title={editingId ? 'Editar Cliente' : 'Agregar Cliente'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              <Users size={12} /> Nombre del cliente
            </label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={onChange('nombre')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                <IdCard size={12} /> Cédula / NIT
              </label>
              <input
                type="text"
                autoComplete="off"
                value={form.identificacion}
                onChange={onChange('identificacion')}
                pattern="^[0-9,.]*$"
                title="Ingrese un número válido"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                <Phone size={12} /> Teléfono
              </label>
              <input
                type="tel"
                autoComplete="off"
                value={form.telefono}
                onChange={onChange('telefono')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              <MapPin size={12} /> Dirección
            </label>
            <input
              type="text"
              autoComplete="off"
              value={form.direccion}
              onChange={onChange('direccion')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              <Mail size={12} /> Correo
            </label>
            <input
              type="email"
              autoComplete="off"
              value={form.correo}
              onChange={onChange('correo')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={cerrarModal}
              className="px-4 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-[#4488ee] hover:bg-[#3672c9] disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {editingId ? <Pencil size={14} /> : <Plus size={14} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal clientes top */}
      <Modal
        show={showTop}
        onClose={() => setShowTop(false)}
        title="Top Clientes"
        wide
        headerCls="bg-amber-500"
      >
        {loadingTop ? (
          <p className="text-center text-slate-400 py-6">Cargando…</p>
        ) : top.length === 0 ? (
          <p className="text-center text-slate-400 py-6">Sin datos de compras todavía</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-16">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs w-24">ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">Nombre</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-40">Total Compras</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.clienteId} className="hover:bg-slate-50/70 border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 text-center">
                      {i < 3
                        ? <Award size={18} className={`inline ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-700'}`} />
                        : <span className="text-slate-500 font-bold">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{c.clienteId}</td>
                    <td className="px-4 py-2.5 font-semibold uppercase text-slate-800">{c.clienteNombre}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600 tabular-nums">
                      ${formatNumber(c.totalCompras)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
