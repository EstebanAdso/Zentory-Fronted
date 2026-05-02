import { useState, useEffect, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  FileSearch, BarChart3, Warehouse, FolderTree, CircleDollarSign,
  TrendingUp, ClipboardList, UserCog, ArrowLeft, Plus, Pencil,
  Trash2, X, RefreshCw, Tag, Settings, ChevronRight, Loader2,
  Wallet, Banknote, LockOpen, Lock, Receipt, TrendingDown,
  ArrowDownCircle, ArrowUpCircle, Calculator, History,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  getCuentasRecaudo, crearCuentaRecaudo, actualizarCuentaRecaudo, eliminarCuentaRecaudo,
  getCajaAbierta, getCajaResumen, getCajaMovimientos, getCajaHistorial,
  abrirCaja, cerrarCaja, registrarGastoCaja,
} from '../../api';
import { formatMoney, formatMoneyCOP, parseFormattedNumber, onChangeMoney } from '../../utils/formatters';

// ── Hub cards ───────────────────────────────────────────────────────────────
const SECCIONES = [
  { id: 'auditoria', titulo: 'Auditoría', desc: 'Consulta el historial de cambios y eventos del sistema', icon: FileSearch, accent: 'violet' },
  { id: 'estadisticas', titulo: 'Estadísticas', desc: 'Gráficas y métricas del negocio en tiempo real', icon: BarChart3, accent: 'sky' },
  { id: 'inventario', titulo: 'Configuración de Inventario', desc: 'Parámetros de stock, alertas y ajustes', icon: Warehouse, accent: 'teal' },
  { id: 'categorias', titulo: 'Categorías', desc: 'Administra las categorías y sus garantías', icon: FolderTree, accent: 'orange' },
  { id: 'cuentasRecaudo', titulo: 'Cuentas de recaudo', desc: 'Administra dónde recibes el dinero (efectivo, Nequi, Daviplata, bancos)', icon: Wallet, accent: 'sky' },
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

// ── Sección Cuentas de recaudo ─────────────────────────────────────────────
const FORM_CUENTA = { nombre: '', activo: true, esEfectivo: false };

function SeccionCuentasRecaudo({ onVolver }) {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_CUENTA);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCuentasRecaudo(false);
      setCuentas(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar las cuentas de recaudo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirAgregar = () => {
    setEditingId(null);
    setForm(FORM_CUENTA);
    setShowModal(true);
  };

  const abrirEditar = useCallback((c) => {
    setEditingId(c.id);
    setForm({ nombre: c.nombre || '', activo: c.activo, esEfectivo: c.esEfectivo });
    setShowModal(true);
  }, []);

  const cerrarModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(FORM_CUENTA);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      activo: form.activo,
      esEfectivo: form.esEfectivo,
    };
    setSaving(true);
    try {
      if (editingId) {
        await actualizarCuentaRecaudo(editingId, payload);
        toast.success('Cuenta actualizada.');
      } else {
        await crearCuentaRecaudo(payload);
        toast.success('Cuenta agregada.');
      }
      cerrarModal();
      cargar();
    } catch (err) {
      toast.error('Error al guardar: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = useCallback((c) => setConfirm({
    mensaje: `Al eliminar "${c.nombre}" se desactivará pero se conservará el histórico de recaudos que la usaron. ¿Continuar?`,
    textoAceptar: 'Sí, desactivar',
    danger: true,
    onAceptar: async () => {
      setConfirm(null);
      try {
        await eliminarCuentaRecaudo(c.id);
        toast.success('Cuenta desactivada.');
        cargar();
      } catch {
        toast.error('Error al desactivar la cuenta.');
      }
    },
  }), [cargar]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
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
                <Wallet size={26} className="text-sky-500" /> Cuentas de recaudo
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {loading ? 'Cargando…' : `${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'} configurada${cuentas.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cargar}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 hover:bg-slate-100 disabled:opacity-60 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
            <button
              onClick={abrirAgregar}
              className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#4488ee] hover:bg-[#3672c9] text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20"
            >
              <Plus size={16} /> Agregar cuenta
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Nombre</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Efectivo</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Estado</th>
                  <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-32 border-b border-slate-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center text-slate-500 py-12">
                    <Loader2 size={24} className="animate-spin mx-auto text-[#4488ee]" />
                    <p className="mt-2 text-sm">Cargando…</p>
                  </td></tr>
                ) : cuentas.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-slate-500 py-12">
                    <Wallet size={32} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-sm">No hay cuentas configuradas</p>
                  </td></tr>
                ) : (
                  cuentas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        {c.esEfectivo ? <Banknote size={16} className="text-emerald-500" /> : <Wallet size={16} className="text-slate-400" />}
                        {c.nombre}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.esEfectivo ? (
                          <span className="inline-flex items-center px-2 h-6 rounded-full bg-emerald-50 text-emerald-700 text-[0.7rem] font-bold uppercase tracking-wide">Sí</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 h-6 rounded-full text-[0.7rem] font-bold uppercase tracking-wide ${
                          c.activo ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => abrirEditar(c)}
                            title="Editar"
                            className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          {c.activo && (
                            <button
                              onClick={() => confirmarEliminar(c)}
                              title="Desactivar"
                              className="inline-flex items-center justify-center w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
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
        title={editingId ? 'Editar cuenta de recaudo' : 'Agregar cuenta de recaudo'}
      >
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Nequi, Daviplata, Bancolombia..."
              className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-[#4488ee] focus:ring-2 focus:ring-[#4488ee]/20 transition-all"
              required
              autoFocus
            />
          </div>

          <label className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.esEfectivo}
              onChange={(e) => setForm((f) => ({ ...f, esEfectivo: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#4488ee]"
            />
            <div>
              <div className="text-sm font-bold text-slate-800">Es la cuenta de "efectivo" físico</div>
              <div className="text-xs text-slate-500 mt-0.5">Solo una cuenta puede marcarse como efectivo. Es la que alimenta el arqueo de caja.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#4488ee]"
            />
            <div>
              <div className="text-sm font-bold text-slate-800">Activo</div>
              <div className="text-xs text-slate-500 mt-0.5">Las cuentas inactivas no aparecen al facturar pero se conservan en el histórico.</div>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrarModal}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-[#4488ee] hover:bg-[#3672c9] disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-[#4488ee]/20">
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

// ── Sección Caja ───────────────────────────────────────────────────────────
const fmtMoney = formatMoneyCOP;
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

function SeccionCaja({ onVolver }) {
  const [tab, setTab] = useState('actual'); // 'actual' | 'historial'
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState(null); // CajaResumenDTO o null
  const [movimientos, setMovimientos] = useState([]);

  const [cuentas, setCuentas] = useState([]);

  // Modales
  const [showAbrir, setShowAbrir] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [showGasto, setShowGasto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [formAbrir, setFormAbrir] = useState({ saldoInicialEfectivo: '', observaciones: '' });
  const [formCerrar, setFormCerrar] = useState({ saldoFinalContado: '', observaciones: '' });
  const [formGasto, setFormGasto] = useState({ cuentaRecaudoId: '', monto: '', descripcion: '' });

  // Historial
  const [historial, setHistorial] = useState([]);
  const [histPage, setHistPage] = useState(0);
  const [histTotal, setHistTotal] = useState(0);
  const [histLoading, setHistLoading] = useState(false);
  const HIST_SIZE = 20;

  const cargarActual = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCajaAbierta();
      if (res.status === 204 || !res.data) {
        setResumen(null);
        setMovimientos([]);
      } else {
        setResumen(res.data);
        const movsRes = await getCajaMovimientos(res.data.caja.id);
        setMovimientos(Array.isArray(movsRes.data) ? movsRes.data : []);
      }
    } catch {
      toast.error('Error al cargar la caja.');
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarCuentas = useCallback(async () => {
    try {
      const { data } = await getCuentasRecaudo(true);
      setCuentas(Array.isArray(data) ? data : []);
    } catch {
      /* silencioso */
    }
  }, []);

  const cargarHistorial = useCallback(async (page = 0) => {
    setHistLoading(true);
    try {
      const { data } = await getCajaHistorial(page, HIST_SIZE);
      setHistorial(Array.isArray(data?.content) ? data.content : []);
      setHistTotal(data?.totalPages ?? 0);
      setHistPage(data?.number ?? page);
    } catch {
      toast.error('Error al cargar el historial.');
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => { cargarActual(); cargarCuentas(); }, [cargarActual, cargarCuentas]);
  useEffect(() => {
    if (tab === 'historial') cargarHistorial(0);
  }, [tab, cargarHistorial]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const abrirCajaSubmit = async (e) => {
    e.preventDefault();
    const saldo = parseFormattedNumber(formAbrir.saldoInicialEfectivo);
    if (isNaN(saldo) || saldo < 0) {
      toast.error('Ingresa un saldo inicial válido (≥ 0).');
      return;
    }
    setSaving(true);
    try {
      await abrirCaja({
        saldoInicialEfectivo: saldo,
        observaciones: formAbrir.observaciones.trim(),
      });
      toast.success('Caja abierta.');
      setShowAbrir(false);
      setFormAbrir({ saldoInicialEfectivo: '', observaciones: '' });
      cargarActual();
    } catch (err) {
      toast.error('Error al abrir caja: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const cerrarCajaSubmit = async (e) => {
    e.preventDefault();
    const saldo = parseFormattedNumber(formCerrar.saldoFinalContado);
    if (isNaN(saldo) || saldo < 0) {
      toast.error('Ingresa el saldo contado válido (≥ 0).');
      return;
    }
    setSaving(true);
    try {
      await cerrarCaja({
        saldoFinalContado: saldo,
        observaciones: formCerrar.observaciones.trim(),
      });
      toast.success('Caja cerrada.');
      setShowCerrar(false);
      setFormCerrar({ saldoFinalContado: '', observaciones: '' });
      cargarActual();
    } catch (err) {
      toast.error('Error al cerrar caja: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const registrarGastoSubmit = async (e) => {
    e.preventDefault();
    const monto = parseFormattedNumber(formGasto.monto);
    if (!formGasto.cuentaRecaudoId) {
      toast.error('Selecciona una cuenta de recaudo.');
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }
    if (!formGasto.descripcion.trim()) {
      toast.error('Describe el gasto.');
      return;
    }
    setSaving(true);
    try {
      await registrarGastoCaja({
        cuentaRecaudoId: Number(formGasto.cuentaRecaudoId),
        monto,
        descripcion: formGasto.descripcion.trim(),
      });
      toast.success('Gasto registrado.');
      setShowGasto(false);
      setFormGasto({ cuentaRecaudoId: '', monto: '', descripcion: '' });
      cargarActual();
    } catch (err) {
      toast.error('Error al registrar gasto: ' + (err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const diferenciaPreview = (() => {
    if (!resumen) return null;
    if (!formCerrar.saldoFinalContado) return null;
    const saldo = parseFormattedNumber(formCerrar.saldoFinalContado);
    if (isNaN(saldo)) return null;
    return saldo - resumen.esperadoEfectivo;
  })();

  const cajaAbierta = !!resumen;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-50">
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
                <CircleDollarSign size={26} className="text-emerald-500" /> Caja
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {loading ? 'Cargando…'
                  : cajaAbierta ? `Turno abierto desde ${fmtDate(resumen.caja.fechaApertura)}`
                  : 'No hay un turno de caja abierto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                onClick={() => setTab('actual')}
                className={`px-3 h-8 text-xs font-bold rounded-md transition-colors ${
                  tab === 'actual' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Turno actual
              </button>
              <button
                onClick={() => setTab('historial')}
                className={`px-3 h-8 text-xs font-bold rounded-md transition-colors ${
                  tab === 'historial' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Historial
              </button>
            </div>
            {tab === 'actual' && (
              <button
                onClick={cargarActual}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-9 px-3 border border-slate-200 hover:bg-slate-100 disabled:opacity-60 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
              </button>
            )}
            {tab === 'actual' && !cajaAbierta && !loading && (
              <button
                onClick={() => setShowAbrir(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-emerald-500/20"
              >
                <LockOpen size={16} /> Abrir caja
              </button>
            )}
            {tab === 'actual' && cajaAbierta && (
              <>
                <button
                  onClick={() => setShowGasto(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-rose-500/20"
                >
                  <TrendingDown size={14} /> Registrar gasto
                </button>
                <button
                  onClick={() => setShowCerrar(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                  <Lock size={14} /> Cerrar caja
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        <div className="max-w-[1800px] mx-auto w-full">
          {tab === 'actual' ? (
            loading ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <Loader2 size={28} className="animate-spin mx-auto text-emerald-500" />
                <p className="mt-3 text-sm text-slate-500">Cargando turno…</p>
              </div>
            ) : !cajaAbierta ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <CircleDollarSign size={48} className="mx-auto text-slate-300" />
                <h2 className="mt-4 text-lg font-bold text-slate-800">Aún no hay un turno abierto</h2>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  Abre caja para empezar a registrar ventas y gastos del turno. El saldo inicial es el efectivo físico que tienes al iniciar el día.
                </p>
                <button
                  onClick={() => setShowAbrir(true)}
                  className="mt-6 inline-flex items-center gap-1.5 h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm shadow-emerald-500/20"
                >
                  <LockOpen size={16} /> Abrir caja
                </button>
              </div>
            ) : (
              <DashboardCaja resumen={resumen} movimientos={movimientos} />
            )
          ) : (
            <HistorialCajas
              historial={historial}
              loading={histLoading}
              page={histPage}
              totalPages={histTotal}
              onPage={cargarHistorial}
            />
          )}
        </div>
      </main>

      {/* Modal Abrir */}
      <Modal show={showAbrir} onClose={() => setShowAbrir(false)} title="Abrir caja">
        <form onSubmit={abrirCajaSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Saldo inicial en efectivo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">$</span>
              <input
                type="text" inputMode="numeric" autoFocus
                value={formAbrir.saldoInicialEfectivo}
                onChange={onChangeMoney(setFormAbrir, 'saldoInicialEfectivo')}
                placeholder="Ej. 100.000"
                className="w-full border-2 border-slate-200 rounded-lg pl-7 pr-3 h-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all tabular-nums"
                required
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Cuánto efectivo físico hay en la caja al iniciar el turno.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Observaciones (opcional)
            </label>
            <textarea
              rows="2"
              value={formAbrir.observaciones}
              onChange={(e) => setFormAbrir((f) => ({ ...f, observaciones: e.target.value }))}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAbrir(false)}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <LockOpen size={14} />}
              {saving ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Cerrar */}
      <Modal show={showCerrar} onClose={() => setShowCerrar(false)} title="Cerrar caja">
        <form onSubmit={cerrarCajaSubmit} className="space-y-4">
          {resumen && (() => {
            const movidosNoEfectivo = (resumen.totales || []).filter(
              t => !t.esEfectivo && (t.ingresos > 0 || t.gastos > 0)
            );
            const recaudoNoEfectivoEsperado = movidosNoEfectivo.reduce((s, t) => s + t.neto, 0);
            return (
              <div className="space-y-2">
                {/* Totales esperados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[0.65rem] font-black text-emerald-700 uppercase tracking-wider">
                      <Banknote size={12} /> Efectivo esperado
                    </div>
                    <div className="text-lg font-black text-emerald-800 tabular-nums mt-1">
                      {fmtMoney(resumen.esperadoEfectivo)}
                    </div>
                    <p className="text-[0.65rem] text-emerald-700/80 mt-1 leading-snug">
                      Inicial {fmtMoney(resumen.caja.saldoInicialEfectivo)} + ventas − gastos en efectivo
                    </p>
                  </div>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[0.65rem] font-black text-sky-700 uppercase tracking-wider">
                      <Wallet size={12} /> Recaudo no-efectivo esperado
                    </div>
                    <div className="text-lg font-black text-sky-800 tabular-nums mt-1">
                      {fmtMoney(recaudoNoEfectivoEsperado)}
                    </div>
                    <p className="text-[0.65rem] text-sky-700/80 mt-1 leading-snug">
                      Total entrante en cuentas distintas a efectivo
                    </p>
                  </div>
                </div>

                {/* Desglose por cuenta con movimiento */}
                {movidosNoEfectivo.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-[0.65rem] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Desglose por cuenta
                    </div>
                    <div className="space-y-1">
                      {movidosNoEfectivo.map(t => (
                        <div key={t.cuentaRecaudoId} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 font-semibold">{t.nombre}</span>
                          <div className="flex items-center gap-2 text-xs tabular-nums">
                            {t.ingresos > 0 && (
                              <span className="text-sky-700">+{fmtMoney(t.ingresos)}</span>
                            )}
                            {t.gastos > 0 && (
                              <span className="text-rose-700">-{fmtMoney(t.gastos)}</span>
                            )}
                            <span className="font-bold text-slate-900 min-w-[80px] text-right">
                              = {fmtMoney(t.neto)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Saldo contado en efectivo
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">$</span>
              <input
                type="text" inputMode="numeric" autoFocus
                value={formCerrar.saldoFinalContado}
                onChange={onChangeMoney(setFormCerrar, 'saldoFinalContado')}
                placeholder="Lo que realmente hay en la caja"
                className="w-full border-2 border-slate-200 rounded-lg pl-7 pr-3 h-10 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all tabular-nums"
                required
              />
            </div>
            {diferenciaPreview !== null && (
              <div className={`mt-2 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 ${
                Math.abs(diferenciaPreview) < 1 ? 'bg-emerald-50 text-emerald-700' :
                diferenciaPreview > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'
              }`}>
                Diferencia: {diferenciaPreview > 0 ? '+' : ''}{fmtMoney(diferenciaPreview)}
                {Math.abs(diferenciaPreview) < 1 ? ' · ¡cuadrado!' :
                  diferenciaPreview > 0 ? ' · sobrante' : ' · faltante'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Observaciones (opcional)
            </label>
            <textarea
              rows="2"
              value={formCerrar.observaciones}
              onChange={(e) => setFormCerrar((f) => ({ ...f, observaciones: e.target.value }))}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCerrar(false)}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {saving ? 'Cerrando...' : 'Cerrar caja'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Gasto */}
      <Modal show={showGasto} onClose={() => setShowGasto(false)} title="Registrar gasto / egreso">
        <form onSubmit={registrarGastoSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Cuenta de recaudo
            </label>
            <select
              value={formGasto.cuentaRecaudoId}
              onChange={(e) => setFormGasto((f) => ({ ...f, cuentaRecaudoId: e.target.value }))}
              className="w-full border-2 border-slate-200 rounded-lg px-3 h-10 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
              required autoFocus
            >
              <option value="">Selecciona…</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.esEfectivo ? ' (Efectivo)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Monto
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">$</span>
              <input
                type="text" inputMode="numeric"
                value={formGasto.monto}
                onChange={onChangeMoney(setFormGasto, 'monto')}
                placeholder="Ej. 50.000"
                className="w-full border-2 border-slate-200 rounded-lg pl-7 pr-3 h-10 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all tabular-nums"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Descripción
            </label>
            <textarea
              rows="2"
              value={formGasto.descripcion}
              onChange={(e) => setFormGasto((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej. Pago de arriendo, compra de bolsas, transporte..."
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-y"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowGasto(false)}
              className="px-4 h-10 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-10 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <TrendingDown size={14} />}
              {saving ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function DashboardCaja({ resumen, movimientos }) {
  const { caja, totales, esperadoEfectivo, totalIngresos, totalGastos, cantidadVentas, cantidadGastos } = resumen;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Efectivo esperado"
          value={fmtMoney(esperadoEfectivo)}
          icon={Calculator}
          accent="emerald"
          hint={`Inicial ${fmtMoney(caja.saldoInicialEfectivo)}`}
        />
        <KpiCard
          label="Ingresos (ventas)"
          value={fmtMoney(totalIngresos)}
          icon={ArrowUpCircle}
          accent="sky"
          hint={`${cantidadVentas} venta${cantidadVentas === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="Gastos"
          value={fmtMoney(totalGastos)}
          icon={ArrowDownCircle}
          accent="rose"
          hint={`${cantidadGastos} gasto${cantidadGastos === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="Neto del turno"
          value={fmtMoney(totalIngresos - totalGastos)}
          icon={Receipt}
          accent="violet"
          hint="Ingresos − gastos"
        />
      </div>

      {/* Totales por cuenta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <Wallet size={16} className="text-sky-500" />
          <h3 className="text-sm font-bold text-slate-800">Totales por cuenta</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Cuenta</th>
                <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Ingresos</th>
                <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Gastos</th>
                <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Neto</th>
              </tr>
            </thead>
            <tbody>
              {totales.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-500 py-6">Sin cuentas configuradas.</td></tr>
              ) : totales.map((t) => (
                <tr key={t.cuentaRecaudoId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-semibold text-slate-800 flex items-center gap-2">
                    {t.esEfectivo ? <Banknote size={14} className="text-emerald-500" /> : <Wallet size={14} className="text-slate-400" />}
                    {t.nombre}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sky-700 font-semibold tabular-nums">{fmtMoney(t.ingresos)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-700 font-semibold tabular-nums">{fmtMoney(t.gastos)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{fmtMoney(t.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movimientos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <History size={16} className="text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800">Movimientos del turno</h3>
          <span className="ml-auto text-xs text-slate-500">{movimientos.length} registro{movimientos.length === 1 ? '' : 's'}</span>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Fecha</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Tipo</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Cuenta</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Descripción / Factura</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Monto</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-500 py-10">
                  <History size={24} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm">Aún no hay movimientos en este turno.</p>
                </td></tr>
              ) : movimientos.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                  <td className="px-4 py-2.5">
                    <TipoBadge tipo={m.tipo} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-800">
                    {m.cuentaRecaudo?.nombre || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.facturaId ? <span className="font-mono text-xs text-sky-700">Factura #{m.facturaId}</span> : (m.descripcion || <span className="italic text-slate-400">—</span>)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                    m.tipo === 'VENTA' ? 'text-sky-700' : m.tipo === 'GASTO' ? 'text-rose-700' : 'text-slate-700'
                  }`}>
                    {m.tipo === 'GASTO' ? '-' : '+'}{fmtMoney(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, hint }) {
  const a = ACCENTS[accent] ?? ACCENTS.slate;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-11 h-11 rounded-xl ${a.bg} ${a.fg} flex items-center justify-center shrink-0`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-black text-slate-900 tabular-nums mt-0.5">{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}

function TipoBadge({ tipo }) {
  const map = {
    VENTA: { cls: 'bg-sky-50 text-sky-700', icon: ArrowUpCircle },
    GASTO: { cls: 'bg-rose-50 text-rose-700', icon: ArrowDownCircle },
    AJUSTE: { cls: 'bg-amber-50 text-amber-700', icon: Receipt },
  };
  const info = map[tipo] || map.AJUSTE;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-[0.7rem] font-bold uppercase tracking-wide ${info.cls}`}>
      <Icon size={12} /> {tipo}
    </span>
  );
}

function HistorialCajas({ historial, loading, page, totalPages, onPage }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        <History size={16} className="text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Cajas cerradas</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Apertura</th>
              <th className="bg-slate-50 px-4 py-2.5 text-left font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Cierre</th>
              <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Saldo inicial</th>
              <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Saldo contado</th>
              <th className="bg-slate-50 px-4 py-2.5 text-right font-bold text-slate-600 text-xs uppercase tracking-wide border-b border-slate-200">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center text-slate-500 py-10">
                <Loader2 size={22} className="animate-spin mx-auto text-slate-400" />
              </td></tr>
            ) : historial.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-500 py-10">
                <History size={24} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm">Aún no hay cajas cerradas.</p>
              </td></tr>
            ) : historial.map((c) => {
              const dif = c.diferencia ?? 0;
              const difCls = Math.abs(dif) < 1 ? 'text-emerald-700' : dif > 0 ? 'text-sky-700' : 'text-rose-700';
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{fmtDate(c.fechaApertura)}</td>
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{fmtDate(c.fechaCierre)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">{fmtMoney(c.saldoInicialEfectivo)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">{fmtMoney(c.saldoFinalContado)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${difCls}`}>
                    {dif > 0 ? '+' : ''}{fmtMoney(dif)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm">
          <span className="text-slate-500">Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="px-3 h-8 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => onPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="px-3 h-8 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 rounded-lg text-xs font-semibold transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
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
    if (id === 'categorias' || id === 'cuentasRecaudo' || id === 'caja') {
      setSeccion(id);
    } else {
      toast.info('Sección en construcción');
    }
  };

  if (seccion === 'categorias') {
    return <SeccionCategorias onVolver={() => setSeccion('hub')} />;
  }
  if (seccion === 'cuentasRecaudo') {
    return <SeccionCuentasRecaudo onVolver={() => setSeccion('hub')} />;
  }
  if (seccion === 'caja') {
    return <SeccionCaja onVolver={() => setSeccion('hub')} />;
  }
  return <Hub onCardClick={onCardClick} />;
}
