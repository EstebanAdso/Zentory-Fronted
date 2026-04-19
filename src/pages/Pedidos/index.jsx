import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Check, Package, X, RefreshCw, DollarSign, Boxes,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { formatNumber, parseFormattedNumber } from '../../utils/formatters';
import {
  getPedidos, crearPedido, eliminarPedido, recibirPedido, getCategorias,
} from '../../api';

// ── Fila de tabla ───────────────────────────────────────────────────────────
const FilaPedido = memo(function FilaPedido({ pedido, onEliminar, onRecibir }) {
  const total = pedido.precioComprado * pedido.cantidad;
  return (
    <tr className="even:bg-gray-50 hover:bg-blue-50/40 transition-colors">
      <td className="border border-gray-300 px-3 py-2 font-medium uppercase">{pedido.nombre}</td>
      <td className="border border-gray-300 px-3 py-2 text-right">${formatNumber(pedido.precioComprado)}</td>
      <td className="border border-gray-300 px-3 py-2 text-right">${formatNumber(pedido.precioVendido)}</td>
      <td className="border border-gray-300 px-3 py-2 text-center">{pedido.cantidad}</td>
      <td className="border border-gray-300 px-3 py-2">{pedido.categoria?.nombre || 'Sin categoría'}</td>
      <td className="border border-gray-300 px-3 py-2 text-right font-semibold">${formatNumber(total)}</td>
      <td className="border border-gray-300 px-3 py-2">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onRecibir(pedido)}
            title="Recibir pedido (mover a inventario)"
            className="inline-flex items-center justify-center gap-1 bg-[#28a745] hover:bg-[#218838] text-white rounded px-2 py-1 text-xs transition-colors"
          >
            <Check size={12} /> Recibir
          </button>
          <button
            onClick={() => onEliminar(pedido)}
            title="Eliminar pedido"
            className="inline-flex items-center justify-center bg-[#dc3545] hover:bg-[#c82333] text-white rounded p-1.5 transition-colors"
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 bg-[#007bff] text-white rounded-t-md">
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
const FORM_INICIAL = { nombre: '', precioComprado: '', precioVendido: '', cantidad: '1', categoriaId: '' };

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPedidos();
      // El backend devuelve respuesta paginada: {content: [...]}
      const lista = Array.isArray(data) ? data : (data?.content ?? []);
      setPedidos(lista);
    } catch {
      toast.error('Error al cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarCategorias = useCallback(async () => {
    try {
      const { data } = await getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar las categorías.');
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
    cargarCategorias();
  }, [cargarPedidos, cargarCategorias]);

  // ── Total global ──────────────────────────────────────────────────────────
  const totalGlobal = useMemo(
    () => pedidos.reduce((s, p) => s + (p.precioComprado * p.cantidad), 0),
    [pedidos],
  );
  const cantidadTotal = useMemo(
    () => pedidos.reduce((s, p) => s + p.cantidad, 0),
    [pedidos],
  );

  // ── Form ──────────────────────────────────────────────────────────────────
  const abrirModal = () => {
    setForm(FORM_INICIAL);
    setShowModal(true);
  };
  const cerrarModal = () => {
    setShowModal(false);
    setForm(FORM_INICIAL);
  };

  const onChangeMoney = (campo) => (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    setForm((f) => ({ ...f, [campo]: raw ? Number(raw).toLocaleString('es-CO') : '' }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (!form.categoriaId) {
      toast.error('Selecciona una categoría.');
      return;
    }
    const cant = parseInt(form.cantidad, 10);
    if (!cant || cant <= 0) {
      toast.error('La cantidad debe ser mayor a cero.');
      return;
    }
    setSaving(true);
    try {
      await crearPedido({
        nombre: form.nombre.trim(),
        precioComprado: parseFormattedNumber(form.precioComprado),
        precioVendido: parseFormattedNumber(form.precioVendido),
        cantidad: cant,
        categoria: { id: Number(form.categoriaId) },
      });
      toast.success('Pedido agregado.');
      cerrarModal();
      cargarPedidos();
    } catch (err) {
      toast.error('Error al guardar el pedido: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Acciones de fila ──────────────────────────────────────────────────────
  const confirmarEliminar = useCallback((pedido) => setConfirm({
    mensaje: `¿Estás seguro de eliminar el pedido "${pedido.nombre}"?`,
    textoAceptar: 'Sí, eliminar',
    danger: true,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await eliminarPedido(pedido.id);
        toast.success('Pedido eliminado.');
        cargarPedidos();
      } catch {
        toast.error('Error al eliminar el pedido.');
      }
    },
  }), [cargarPedidos]);

  const confirmarRecibir = useCallback((pedido) => setConfirm({
    mensaje: `¿Confirmas que recibiste el pedido "${pedido.nombre}"? Se moverá al inventario.`,
    textoAceptar: 'Sí, recibir',
    danger: false,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await recibirPedido(pedido.id);
        toast.success('Producto recibido y movido a inventario.');
        cargarPedidos();
      } catch {
        toast.error('Error al recibir el pedido.');
      }
    },
  }), [cargarPedidos]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4 py-5">
        <h1 className="text-center text-2xl font-semibold select-none">Inventario de Pedidos</h1>
        <p className="text-center text-gray-500 mb-5">
          Gestiona los pedidos pendientes de recepción
        </p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Stat icon={Package} title="Pedidos pendientes" value={pedidos.length}
            bg="bg-[#17a2b8]" text="text-white" />
          <Stat icon={Boxes} title="Unidades totales" value={cantidadTotal}
            bg="bg-[#ffc107]" text="text-black" />
          <Stat icon={DollarSign} title="Total invertido" value={`$${formatNumber(totalGlobal)}`}
            bg="bg-[#28a745]" text="text-white" />
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <button
            onClick={() => cargarPedidos()}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded px-3 py-1.5 text-sm transition-colors"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={abrirModal}
            className="inline-flex items-center gap-1.5 bg-[#007bff] hover:bg-[#0069d9] text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            <Plus size={14} /> Agregar Pedido
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Nombre del Pedido</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-32">$Comprado</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-32">$Vendido</th>
                <th className="border border-gray-300 px-3 py-2 text-center w-24">Cantidad</th>
                <th className="border border-gray-300 px-3 py-2 text-left w-48">Categoría</th>
                <th className="border border-gray-300 px-3 py-2 text-right w-32">Total</th>
                <th className="border border-gray-300 px-3 py-2 text-center w-44">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="border border-gray-300 text-center text-gray-500 py-6">
                    Cargando pedidos…
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-gray-300 text-center text-gray-500 py-6">
                    No hay pedidos pendientes
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <FilaPedido
                    key={p.id}
                    pedido={p}
                    onEliminar={confirmarEliminar}
                    onRecibir={confirmarRecibir}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal agregar ─────────────────────────────────────────────────────── */}
      <Modal show={showModal} onClose={cerrarModal} title="Agregar Pedido">
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 font-medium">Nombre</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 font-medium">Precio Comprado</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precioComprado}
                onChange={onChangeMoney('precioComprado')}
                placeholder="$0"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">Precio Vendido</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precioVendido}
                onChange={onChangeMoney('precioVendido')}
                placeholder="$0"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-sm mb-1 font-medium">Categoría</label>
              <select
                value={form.categoriaId}
                onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                required
              >
                <option value="">Selecciona una categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#007bff] hover:bg-[#0069d9] disabled:opacity-60 text-white rounded text-sm transition-colors"
            >
              <Plus size={14} /> {saving ? 'Guardando...' : 'Guardar'}
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
