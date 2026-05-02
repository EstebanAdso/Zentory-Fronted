import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Check, Package, X, RefreshCw, DollarSign, Boxes,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { formatNumber, parseFormattedNumber, onChangeMoney } from '../../utils/formatters';
import {
  getPedidos, crearPedido, eliminarPedido, recibirPedido, getCategorias,
} from '../../api';

// ── Fila de tabla ───────────────────────────────────────────────────────────
const FilaPedido = memo(function FilaPedido({ pedido, onEliminar, onRecibir }) {
  const total = pedido.precioComprado * pedido.cantidad;
  return (
    <tr className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-semibold uppercase text-slate-800">{pedido.nombre}</td>
      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">${formatNumber(pedido.precioComprado)}</td>
      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">${formatNumber(pedido.precioVendido)}</td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-xs px-2">
          {pedido.cantidad}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{pedido.categoria?.nombre || <span className="text-slate-400 italic">—</span>}</td>
      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">${formatNumber(total)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1.5">
          <button
            onClick={() => onRecibir(pedido)}
            title="Recibir pedido (mover a inventario)"
            className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-sm"
          >
            <Check size={12} /> Recibir
          </button>
          <button
            onClick={() => onEliminar(pedido)}
            title="Eliminar pedido"
            className="inline-flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white rounded-md p-1.5 transition-colors shadow-sm"
          >
            <Trash2 size={12} />
          </button>
        </div>
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
function Modal({ show, onClose, title, children }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-20 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl mb-8 w-[480px] max-w-[96vw] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <h5 className="m-0 text-base font-bold">{title}</h5>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
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

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPedidos(currentPage, pageSize);
      if (Array.isArray(data)) {
        setPedidos(data);
        setTotalPages(1);
        setTotalElements(data.length);
      } else {
        setPedidos(data?.content ?? []);
        setTotalPages(data?.totalPages ?? 0);
        setTotalElements(data?.totalElements ?? 0);
      }
    } catch {
      toast.error('Error al cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

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

  const totalGlobal = useMemo(
    () => pedidos.reduce((s, p) => s + (p.precioComprado * p.cantidad), 0),
    [pedidos],
  );
  const cantidadTotal = useMemo(
    () => pedidos.reduce((s, p) => s + p.cantidad, 0),
    [pedidos],
  );

  const abrirModal = () => {
    setForm(FORM_INICIAL);
    setShowModal(true);
  };
  const cerrarModal = () => {
    setShowModal(false);
    setForm(FORM_INICIAL);
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
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pedidos</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestiona los pedidos pendientes de recepción al inventario</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cargarPedidos()}
              className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-3.5 h-9 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            <button
              onClick={abrirModal}
              className="inline-flex items-center gap-1.5 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg px-4 h-9 text-sm font-semibold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              <Plus size={14} /> Agregar Pedido
            </button>
          </div>
        </div>
      </header>

      {/* Content — no page scroll, only table scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full flex flex-col gap-4">
          {/* Stats — fixed */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat icon={Package} title="Pedidos pendientes" value={totalElements}
              accent="bg-cyan-50 text-cyan-600" />
            <Stat icon={Boxes} title="Unidades en página" value={cantidadTotal}
              accent="bg-amber-50 text-amber-600" />
            <Stat icon={DollarSign} title="Invertido en página" value={`$${formatNumber(totalGlobal)}`}
              accent="bg-emerald-50 text-emerald-600" />
          </div>

          {/* Tabla — fills remaining space, scrolls internally */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs border-b border-slate-200">Nombre del Pedido</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-32 border-b border-slate-200">$Comprado</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-32 border-b border-slate-200">$Vendido</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-24 border-b border-slate-200">Cantidad</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs w-48 border-b border-slate-200">Categoría</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-32 border-b border-slate-200">Total</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-44 border-b border-slate-200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400 py-12">
                        Cargando pedidos…
                      </td>
                    </tr>
                  ) : pedidos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400 py-12">
                        <Package size={32} className="mx-auto mb-2 text-slate-300" />
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

          {/* Paginación */}
          {!loading && totalElements > 0 && (() => {
            const maxVisible = 5;
            const startPage = Math.max(0, Math.min(currentPage - Math.floor(maxVisible / 2), totalPages - maxVisible));
            const endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);
            const irAPagina = (page) => {
              if (page < 0 || page >= totalPages) return;
              setCurrentPage(page);
            };
            return (
              <div className="shrink-0 flex items-center justify-center gap-6 flex-wrap">
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
                  <span className="text-slate-500">por página · Página {currentPage + 1} de {Math.max(1, totalPages)}</span>
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
            );
          })()}
        </div>
      </main>

      {/* Modal agregar */}
      <Modal show={showModal} onClose={cerrarModal} title="Agregar Pedido">
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Comprado</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precioComprado}
                onChange={onChangeMoney(setForm, 'precioComprado')}
                placeholder="$0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Vendido</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precioVendido}
                onChange={onChangeMoney(setForm, 'precioVendido')}
                placeholder="$0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Cantidad</label>
              <input
                type="number"
                min="1"
                value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Categoría</label>
              <select
                value={form.categoriaId}
                onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all bg-white"
                required
              >
                <option value="">Selecciona…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
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
