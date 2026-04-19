import { useState, useEffect, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  FileSearch, BarChart3, Warehouse, FolderTree, CircleDollarSign,
  TrendingUp, ClipboardList, UserCog, ArrowLeft, Plus, Pencil,
  Trash2, X, RefreshCw, Tag, Settings, ChevronRight, Loader2,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
} from '../../api';

// ── Hub cards ───────────────────────────────────────────────────────────────
const SECCIONES = [
  { id: 'auditoria', titulo: 'Auditoría', desc: 'Consulta el historial de cambios y eventos del sistema', icon: FileSearch, accent: 'violet' },
  { id: 'estadisticas', titulo: 'Estadísticas', desc: 'Gráficas y métricas del negocio en tiempo real', icon: BarChart3, accent: 'sky' },
  { id: 'inventario', titulo: 'Configuración de Inventario', desc: 'Parámetros de stock, alertas y ajustes', icon: Warehouse, accent: 'teal' },
  { id: 'categorias', titulo: 'Categorías', desc: 'Administra las categorías y sus garantías', icon: FolderTree, accent: 'orange' },
  { id: 'caja', titulo: 'Caja', desc: 'Apertura, cierre y movimientos de caja', icon: CircleDollarSign, accent: 'emerald' },
  { id: 'repVentas', titulo: 'Reportes de ventas', desc: 'Reportes diarios, semanales y por vendedor', icon: TrendingUp, accent: 'rose' },
  { id: 'repInv', titulo: 'Reportes de inventario', desc: 'Existencias, valorizados y rotación', icon: ClipboardList, accent: 'amber' },
  { id: 'usuario', titulo: 'Configuración de usuario', desc: 'Perfil, preferencias y credenciales', icon: UserCog, accent: 'slate' },
];

const ACCENTS = {
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600', ring: 'group-hover:ring-violet-200', bar: 'bg-violet-500' },
  sky: { bg: 'bg-sky-50', fg: 'text-sky-600', ring: 'group-hover:ring-sky-200', bar: 'bg-sky-500' },
  teal: { bg: 'bg-teal-50', fg: 'text-teal-600', ring: 'group-hover:ring-teal-200', bar: 'bg-teal-500' },
  orange: { bg: 'bg-orange-50', fg: 'text-orange-600', ring: 'group-hover:ring-orange-200', bar: 'bg-orange-500' },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600', ring: 'group-hover:ring-emerald-200', bar: 'bg-emerald-500' },
  rose: { bg: 'bg-rose-50', fg: 'text-rose-600', ring: 'group-hover:ring-rose-200', bar: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600', ring: 'group-hover:ring-amber-200', bar: 'bg-amber-500' },
  slate: { bg: 'bg-slate-100', fg: 'text-slate-600', ring: 'group-hover:ring-slate-200', bar: 'bg-slate-500' },
};

function HubCard({ titulo, desc, icon: Icon, accent, onClick }) {
  const a = ACCENTS[accent] ?? ACCENTS.slate;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col gap-3 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4488ee]/40"
    >
      <span className={`absolute top-0 left-0 w-1 h-full ${a.bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${a.bg} ${a.fg} flex items-center justify-center ring-4 ring-transparent transition-all ${a.ring}`}>
          <Icon size={24} strokeWidth={2} />
        </div>
        <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-base leading-tight">{titulo}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-snug">{desc}</p>
      </div>
    </button>
  );
}

// ── Fila de categoría ───────────────────────────────────────────────────────
const FilaCategoria = memo(function FilaCategoria({ categoria, onEditar, onEliminar }) {
  return (
    <tr className="hover:bg-slate-50/70 border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-semibold text-slate-800">{categoria.nombre}</td>
      <td className="px-4 py-3 text-slate-600">
        {categoria.descripcion || <span className="text-slate-400 italic">Sin descripción</span>}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {categoria.descripcionGarantia || <span className="text-slate-400 italic">Sin garantía</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center gap-1.5">
          <button
            onClick={() => onEditar(categoria)}
            title="Editar categoría"
            className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onEliminar(categoria)}
            title="Eliminar categoría"
            className="inline-flex items-center justify-center w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
});

// ── Modal base ──────────────────────────────────────────────────────────────
function Modal({ show, onClose, title, children }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[1050] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl mb-8 w-[540px] max-w-[96vw] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <h5 className="m-0 text-base font-bold inline-flex items-center gap-2">
            <Tag size={18} className="text-orange-400" /> {title}
          </h5>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Sección Categorías ──────────────────────────────────────────────────────
const FORM_INICIAL = { nombre: '', descripcion: '', descripcionGarantia: '' };

function SeccionCategorias({ onVolver }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCategorias();
      setCategorias(Array.isArray(data) ? data : (data?.content ?? []));
    } catch {
      toast.error('Error al cargar las categorías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirAgregar = () => {
    setEditingId(null);
    setForm(FORM_INICIAL);
    setShowModal(true);
  };

  const abrirEditar = useCallback((c) => {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre || '',
      descripcion: c.descripcion || '',
      descripcionGarantia: c.descripcionGarantia || '',
    });
    setShowModal(true);
  }, []);

  const cerrarModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(FORM_INICIAL);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    const payload = {
      nombre: form.nombre.toUpperCase().trim(),
      descripcion: form.descripcion.trim(),
      descripcionGarantia: form.descripcionGarantia.trim(),
    };
    setSaving(true);
    try {
      if (editingId) {
        await actualizarCategoria(editingId, payload);
        toast.success('Categoría actualizada.');
      } else {
        await crearCategoria(payload);
        toast.success('Categoría agregada.');
      }
      cerrarModal();
      cargar();
    } catch (err) {
      toast.error('Error al guardar la categoría: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = useCallback((c) => setConfirm({
    mensaje: `Si eliminas la categoría "${c.nombre}", perderás todos los productos que pertenecen a ella. ¿Deseas continuar?`,
    textoAceptar: 'Sí, eliminar',
    danger: true,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await eliminarCategoria(c.id);
        toast.success('Categoría eliminada.');
        cargar();
      } catch {
        toast.error('Error al eliminar la categoría.');
      }
    },
  }), [cargar]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Page header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={onVolver}
              className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg px-3 h-9 text-sm font-semibold transition-colors"
            >
              <ArrowLeft size={14} /> Volver
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Tag size={26} className="text-orange-500" /> Categorías
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {loading ? 'Cargando…' : `${categorias.length} categoría${categorias.length === 1 ? '' : 's'} registradas`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cargar()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 hover:bg-slate-100 disabled:opacity-60 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button
              onClick={abrirAgregar}
              className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              <Plus size={16} /> Agregar Categoría
            </button>
          </div>
        </div>
      </header>

      {/* Content — no page scroll, only table scrolls internally */}
      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide w-56 border-b border-slate-200">Nombre</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Descripción</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Descripción de Garantía</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-500 py-12">
                      <Loader2 size={24} className="animate-spin mx-auto text-[#4488ee]" />
                      <p className="mt-2 text-sm">Cargando categorías…</p>
                    </td>
                  </tr>
                ) : categorias.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-500 py-12">
                      <Tag size={32} className="mx-auto text-slate-300" />
                      <p className="mt-2 text-sm">No hay categorías registradas</p>
                    </td>
                  </tr>
                ) : (
                  categorias.map((c) => (
                    <FilaCategoria
                      key={c.id}
                      categoria={c}
                      onEditar={abrirEditar}
                      onEliminar={confirmarEliminar}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Modal
        show={showModal}
        onClose={cerrarModal}
        title={editingId ? 'Editar Categoría' : 'Agregar Categoría'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Nombre de la Categoría
            </label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))}
              className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Descripción
            </label>
            <textarea
              rows="2"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Agregue una descripción de la categoría (Opcional)"
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Descripción de Garantía
            </label>
            <textarea
              rows="2"
              value={form.descripcionGarantia}
              onChange={(e) => setForm((f) => ({ ...f, descripcionGarantia: e.target.value }))}
              placeholder="Agregue una descripción de garantía (Opcional)"
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cerrarModal}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : (editingId ? <Pencil size={14} /> : <Plus size={14} />)}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        mensaje={confirm?.mensaje}
        textoAceptar={confirm?.textoAceptar}
        textoCancelar="Volver"
        onAceptar={confirm?.onAceptar}
        onCancelar={() => setConfirm(null)}
        danger={confirm?.danger}
      />
    </div>
  );
}

// ── Hub ─────────────────────────────────────────────────────────────────────
function Hub({ onCardClick }) {
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-[1800px] mx-auto w-full">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings size={26} className="text-[#4488ee]" /> Configuración
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administra módulos, reportes y parámetros del sistema
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SECCIONES.map((s) => (
              <HubCard
                key={s.id}
                titulo={s.titulo}
                desc={s.desc}
                icon={s.icon}
                accent={s.accent}
                onClick={() => onCardClick(s.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Config() {
  const [seccion, setSeccion] = useState('hub');

  const onCardClick = (id) => {
    if (id === 'categorias') {
      setSeccion('categorias');
    } else {
      toast.info('Sección en construcción');
    }
  };

  if (seccion === 'categorias') {
    return <SeccionCategorias onVolver={() => setSeccion('hub')} />;
  }
  return <Hub onCardClick={onCardClick} />;
}
