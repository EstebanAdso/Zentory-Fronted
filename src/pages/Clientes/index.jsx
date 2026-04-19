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
    <tr className="even:bg-gray-50 hover:bg-blue-50/40 transition-colors">
      <td className="border border-gray-300 px-3 py-2 text-center text-gray-500">{cliente.id}</td>
      <td className="border border-gray-300 px-3 py-2 font-medium uppercase">{cliente.nombre}</td>
      <td className="border border-gray-300 px-3 py-2">{cliente.identificacion || '—'}</td>
      <td className="border border-gray-300 px-3 py-2">{cliente.telefono || '—'}</td>
      <td className="border border-gray-300 px-3 py-2">{cliente.direccion || '—'}</td>
      <td className="border border-gray-300 px-3 py-2">{cliente.correo || '—'}</td>
      <td className="border border-gray-300 px-3 py-2 text-center">
        <button
          onClick={() => onEditar(cliente)}
          title="Editar cliente"
          className="inline-flex items-center justify-center gap-1 bg-[#28a745] hover:bg-[#218838] text-white rounded px-2 py-1 text-xs transition-colors"
        >
          <Pencil size={12} /> Editar
        </button>
      </td>
    </tr>
  );
});

// ── Stat card ───────────────────────────────────────────────────────────────
function Stat({ icon: Icon, title, value, bg, text }) {
  return (
    <div className={`${bg} ${text} rounded-lg shadow-sm p-4 flex items-center gap-3`}>
      <Icon size={32} className="opacity-80 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-semibold m-0 opacity-90 truncate">{title}</p>
        <p className="text-2xl font-bold m-0 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Modal base ──────────────────────────────────────────────────────────────
function Modal({ show, onClose, title, wide = false, children, headerCls = 'bg-[#343a40]' }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/50 flex items-start justify-center pt-16 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-md shadow-xl mb-8 max-w-[96vw] ${wide ? 'w-[720px]' : 'w-[520px]'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b border-gray-300 ${headerCls} text-white rounded-t-md`}>
          <h5 className="m-0 text-base font-semibold">{title}</h5>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white text-2xl leading-none"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
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

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargarClientes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getClientes();
      const lista = Array.isArray(data) ? data : (data?.content ?? []);
      // Mismo orden que el original: id desc (más recientes primero)
      lista.sort((a, b) => b.id - a.id);
      setClientes(lista);
    } catch {
      toast.error('Error al cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.identificacion || '').toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  // ── Form ──────────────────────────────────────────────────────────────────
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
    // Campos vacíos → null para el backend (como en el original)
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

  // ── Top clientes ──────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4 py-5">
        <h1 className="text-center text-2xl font-semibold select-none">Gestión de Clientes</h1>
        <p className="text-center text-gray-500 mb-5">
          Administra la base de datos de clientes del negocio
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <Stat icon={Users} title="Clientes registrados" value={clientes.length}
            bg="bg-[#007bff]" text="text-white" />
          <Stat icon={Search} title="Coincidencias" value={clientesFiltrados.length}
            bg="bg-[#17a2b8]" text="text-white" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex-1 min-w-[240px] flex items-center border border-gray-300 rounded overflow-hidden focus-within:border-blue-400">
            <span className="px-2 text-gray-500"><Search size={14} /></span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
              placeholder="Buscar por nombre o identificación..."
              className="flex-1 px-1 py-1.5 text-sm outline-none"
            />
          </div>
          <button
            onClick={() => cargarClientes()}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded px-3 py-1.5 text-sm transition-colors"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={verTop}
            className="inline-flex items-center gap-1.5 bg-[#007bff] hover:bg-[#0069d9] text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            <Trophy size={14} /> Clientes Top
          </button>
          <button
            onClick={abrirAgregar}
            className="inline-flex items-center gap-1.5 bg-[#343a40] hover:bg-black text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            <Plus size={14} /> Agregar Cliente
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-center w-16">ID</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Nombre</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-32">Identificación</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-32">Teléfono</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Dirección</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-52">Correo</th>
                <th className="border border-gray-300 px-3 py-2 text-center w-28">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="border border-gray-300 text-center text-gray-500 py-6">
                    Cargando clientes…
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-gray-300 text-center text-gray-500 py-6">
                    {busqueda ? 'Sin coincidencias para la búsqueda' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c) => (
                  <FilaCliente
                    key={c.id}
                    cliente={c}
                    onEditar={abrirEditar}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal agregar/editar ──────────────────────────────────────────────── */}
      <Modal
        show={showModal}
        onClose={cerrarModal}
        title={editingId ? 'Editar Cliente' : 'Agregar Cliente'}
      >
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 font-medium inline-flex items-center gap-1">
              <Users size={14} /> Nombre del cliente
            </label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={onChange('nombre')}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 font-medium inline-flex items-center gap-1">
                <IdCard size={14} /> Cédula o NIT
              </label>
              <input
                type="text"
                autoComplete="off"
                value={form.identificacion}
                onChange={onChange('identificacion')}
                pattern="^[0-9,.]*$"
                title="Ingrese un número válido"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium inline-flex items-center gap-1">
                <Phone size={14} /> Teléfono
              </label>
              <input
                type="tel"
                autoComplete="off"
                value={form.telefono}
                onChange={onChange('telefono')}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium inline-flex items-center gap-1">
              <MapPin size={14} /> Dirección
            </label>
            <input
              type="text"
              autoComplete="off"
              value={form.direccion}
              onChange={onChange('direccion')}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium inline-flex items-center gap-1">
              <Mail size={14} /> Correo
            </label>
            <input
              type="email"
              autoComplete="off"
              value={form.correo}
              onChange={onChange('correo')}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cerrarModal}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#343a40] hover:bg-black disabled:opacity-60 text-white rounded text-sm transition-colors"
            >
              {editingId ? <Pencil size={14} /> : <Plus size={14} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal clientes top ─────────────────────────────────────────────────── */}
      <Modal
        show={showTop}
        onClose={() => setShowTop(false)}
        title="Clientes Top"
        wide
        headerCls="bg-[#007bff]"
      >
        {loadingTop ? (
          <p className="text-center text-gray-500 py-4">Cargando…</p>
        ) : top.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Sin datos de compras todavía</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-center w-16">#</th>
                  <th className="border border-gray-300 px-3 py-2 text-left w-24">ID</th>
                  <th className="border border-gray-300 px-3 py-2 text-left">Nombre del Cliente</th>
                  <th className="border border-gray-300 px-3 py-2 text-right w-40">Total de Compras</th>
                </tr>
              </thead>
              <tbody>
                {top.map((c, i) => (
                  <tr key={c.clienteId} className="even:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      {i < 3
                        ? <Award size={16} className={`inline ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-700'}`} />
                        : i + 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-500">{c.clienteId}</td>
                    <td className="border border-gray-300 px-3 py-2 font-medium uppercase">{c.clienteNombre}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-[#28a745]">
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
