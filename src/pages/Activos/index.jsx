import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, X, RefreshCw, DollarSign, Boxes, Landmark,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { formatNumber, parseFormattedNumber, formatMoneyInput } from '../../utils/formatters';
import {
  getActivos, crearActivo, actualizarActivo, eliminarActivo,
} from '../../api';

// ── Fila de tabla ───────────────────────────────────────────────────────────
const FilaActivo = memo(function FilaActivo({ activo, onEditar, onEliminar }) {
  const total = activo.precio * activo.cantidad;
  return (
    <tr className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-semibold uppercase text-slate-800">{activo.nombre}</td>
      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">${formatNumber(activo.precio)}</td>
      <td className="px-4 py-3 text-center">
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-xs px-2">
          {activo.cantidad}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">${formatNumber(total)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1.5">
          <button
            onClick={() => onEditar(activo)}
            title="Editar activo"
            className="inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-md p-1.5 transition-colors shadow-sm"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onEliminar(activo)}
            title="Eliminar activo"
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
const FORM_INICIAL = { nombre: '', precio: '', cantidad: '1' };

export default function Activos() {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);

  const [confirm, setConfirm] = useState(null);

  const cargarActivos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getActivos(currentPage, pageSize);
      if (Array.isArray(data)) {
        setActivos(data);
        setTotalPages(1);
        setTotalElements(data.length);
      } else {
        setActivos(data?.content ?? []);
        setTotalPages(data?.totalPages ?? 0);
        setTotalElements(data?.totalElements ?? 0);
      }
    } catch {
      toast.error('Error al cargar los activos.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => { cargarActivos(); }, [cargarActivos]);

  const irAPagina = (page) => {
    if (page < 0 || page >= totalPages) return;
    setCurrentPage(page);
  };
  const maxVisible = 5;
  const startPage = Math.max(0, Math.min(currentPage - Math.floor(maxVisible / 2), totalPages - maxVisible));
  const endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);

  const totalGlobal = useMemo(
    () => activos.reduce((s, a) => s + (a.precio * a.cantidad), 0),
    [activos],
  );
  const cantidadTotal = useMemo(
    () => activos.reduce((s, a) => s + a.cantidad, 0),
    [activos],
  );

  const abrirAgregar = () => {
    setEditingId(null);
    setForm(FORM_INICIAL);
    setShowModal(true);
  };

  const abrirEditar = useCallback((activo) => {
    setEditingId(activo.id);
    setForm({
      nombre: activo.nombre,
      precio: formatMoneyInput(activo.precio),
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
    setForm((f) => ({ ...f, precio: formatMoneyInput(e.target.value) }));
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

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Page Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Activos</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestiona los activos del negocio y su valorización</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cargarActivos()}
              className="inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-3.5 h-9 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} /> Actualizar
            </button>
            <button
              onClick={abrirAgregar}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white rounded-lg px-4 h-9 text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus size={14} /> Agregar Activo
            </button>
          </div>
        </div>
      </header>

      {/* Content — no page scroll, only table scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full flex flex-col gap-4">
          {/* Stats — fixed */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat icon={Landmark} title="Activos registrados" value={totalElements}
              accent="bg-slate-100 text-slate-700" />
            <Stat icon={Boxes} title="Unidades en página" value={cantidadTotal}
              accent="bg-cyan-50 text-cyan-600" />
            <Stat icon={DollarSign} title="Valor en página" value={`$${formatNumber(totalGlobal)}`}
              accent="bg-emerald-50 text-emerald-600" />
          </div>

          {/* Tabla — fills remaining space, scrolls internally */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-full overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs border-b border-slate-200">Nombre del Activo</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-40 border-b border-slate-200">Precio de Compra</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-28 border-b border-slate-200">Cantidad</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs w-40 border-b border-slate-200">Total</th>
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs w-32 border-b border-slate-200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-12">Cargando activos…</td>
                    </tr>
                  ) : activos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-12">
                        <Landmark size={32} className="mx-auto mb-2 text-slate-300" />
                        No hay activos registrados
                      </td>
                    </tr>
                  ) : (
                    activos.map((a) => (
                      <FilaActivo key={a.id} activo={a} onEditar={abrirEditar} onEliminar={confirmarEliminar} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          {!loading && totalElements > 0 && (
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
          )}
        </div>
      </main>

      <Modal show={showModal} onClose={cerrarModal} title={editingId ? 'Editar Activo' : 'Agregar Activo'}>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre del activo</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Precio Comprado</label>
              <input
                type="text"
                autoComplete="off"
                value={form.precio}
                onChange={onChangeMoney}
                placeholder="$0"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              />
            </div>
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
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-slate-900 hover:bg-black disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
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
