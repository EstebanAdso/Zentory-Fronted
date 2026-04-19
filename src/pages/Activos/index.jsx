import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, X, RefreshCw, DollarSign, Boxes, Landmark,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import {
  getActivos, crearActivo, actualizarActivo, eliminarActivo,
} from '../../api';

// ── Fila de tabla ───────────────────────────────────────────────────────────
const FilaActivo = memo(function FilaActivo({ activo, onEditar, onEliminar }) {
  const total = activo.precio * activo.cantidad;
  return (
    <tr className="even:bg-gray-50 hover:bg-blue-50/40 transition-colors">
      <td className="border border-gray-300 px-3 py-2 font-medium uppercase">{activo.nombre}</td>
      <td className="border border-gray-300 px-3 py-2 text-right">${formatNumber(activo.precio)}</td>
      <td className="border border-gray-300 px-3 py-2 text-center">{activo.cantidad}</td>
      <td className="border border-gray-300 px-3 py-2 text-right font-semibold">${formatNumber(total)}</td>
      <td className="border border-gray-300 px-3 py-2">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onEditar(activo)}
            title="Editar activo"
            className="inline-flex items-center justify-center bg-[#28a745] hover:bg-[#218838] text-white rounded p-1.5 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onEliminar(activo)}
            title="Eliminar activo"
            className="inline-flex items-center justify-center bg-[#343a40] hover:bg-black text-white rounded p-1.5 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
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
function Modal({ show, onClose, title, children }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-black/50 flex items-start justify-center pt-16 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-md shadow-xl mb-8 w-[480px] max-w-[96vw]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 bg-[#343a40] text-white rounded-t-md">
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
const FORM_INICIAL = { nombre: '', precio: '', cantidad: '1' };

export default function Activos() {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargarActivos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getActivos();
      const lista = Array.isArray(data) ? data : (data?.content ?? []);
      setActivos(lista);
    } catch {
      toast.error('Error al cargar los activos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarActivos(); }, [cargarActivos]);

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalGlobal = useMemo(
    () => activos.reduce((s, a) => s + (a.precio * a.cantidad), 0),
    [activos],
  );
  const cantidadTotal = useMemo(
    () => activos.reduce((s, a) => s + a.cantidad, 0),
    [activos],
  );

  // ── Form ──────────────────────────────────────────────────────────────────
  const abrirAgregar = () => {
    setEditingId(null);
    setForm(FORM_INICIAL);
    setShowModal(true);
  };

  const abrirEditar = useCallback((activo) => {
    setEditingId(activo.id);
    setForm({
      nombre: activo.nombre,
      precio: activo.precio ? Number(activo.precio).toLocaleString('es-CO') : '',
      cantidad: String(activo.cantidad),
    });
    setShowModal(true);
  }, []);

  const cerrarModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(FORM_INICIAL);
  };

  const onChangeMoney = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    setForm((f) => ({ ...f, precio: raw ? Number(raw).toLocaleString('es-CO') : '' }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    const cant = parseInt(form.cantidad, 10);
    if (!cant || cant <= 0) {
      toast.error('La cantidad debe ser mayor a cero.');
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      precio: parseFormattedNumber(form.precio),
      cantidad: cant,
    };
    setSaving(true);
    try {
      if (editingId) {
        await actualizarActivo(editingId, payload);
        toast.success('Activo actualizado.');
      } else {
        await crearActivo(payload);
        toast.success('Activo agregado.');
      }
      cerrarModal();
      cargarActivos();
    } catch (err) {
      toast.error('Error al guardar el activo: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const confirmarEliminar = useCallback((activo) => setConfirm({
    mensaje: `¿Estás seguro de eliminar el activo "${activo.nombre}"?`,
    textoAceptar: 'Sí, eliminar',
    danger: true,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await eliminarActivo(activo.id);
        toast.success('Activo eliminado.');
        cargarActivos();
      } catch {
        toast.error('Error al eliminar el activo.');
      }
    },
  }), [cargarActivos]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4 py-5">
        <h1 className="text-center text-2xl font-semibold select-none">Inventario de Activos</h1>
        <p className="text-center text-gray-500 mb-5">
          Gestiona los activos del negocio y su valorización
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Stat icon={Landmark} title="Activos registrados" value={activos.length}
            bg="bg-[#343a40]" text="text-white" />
          <Stat icon={Boxes} title="Unidades totales" value={cantidadTotal}
            bg="bg-[#17a2b8]" text="text-white" />
          <Stat icon={DollarSign} title="Valor total" value={`$${formatNumber(totalGlobal)}`}
            bg="bg-[#28a745]" text="text-white" />
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <button
            onClick={() => cargarActivos()}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded px-3 py-1.5 text-sm transition-colors"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={abrirAgregar}
            className="inline-flex items-center gap-1.5 bg-[#343a40] hover:bg-black text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            <Plus size={14} /> Agregar Activo
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Nombre del Activo</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-40">Precio de Compra</th>
                <th className="border border-gray-300 px-3 py-2 text-center w-28">Cantidad</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-40">Total</th>
                <th className="border border-gray-300 px-3 py-2 text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 text-center text-gray-500 py-6">
                    Cargando activos…
                  </td>
                </tr>
              ) : activos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 text-center text-gray-500 py-6">
                    No hay activos registrados
                  </td>
                </tr>
              ) : (
                activos.map((a) => (
                  <FilaActivo
                    key={a.id}
                    activo={a}
                    onEditar={abrirEditar}
                    onEliminar={confirmarEliminar}
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
        title={editingId ? 'Editar Activo' : 'Agregar Activo'}
      >
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 font-medium">Nombre del activo</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 font-medium">Precio Comprado</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precio}
                onChange={onChangeMoney}
                placeholder="$0"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">Cantidad</label>
              <input
                type="number"
                min="1"
                value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                required
              />
            </div>
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
