import { useState, useEffect, useCallback, memo } from 'react';
import { toast } from 'sonner';
import {
  FileSearch, BarChart3, Warehouse, FolderTree, CircleDollarSign,
  TrendingUp, ClipboardList, UserCog, ArrowLeft, Plus, Pencil,
  Trash2, X, RefreshCw, Tag,
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import {
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
} from '../../api';

// ── Hub cards ───────────────────────────────────────────────────────────────
const SECCIONES = [
  { id: 'auditoria',  titulo: 'Auditoría',               icon: FileSearch,       color: 'from-[#8e44ad] to-[#6c3483]' },
  { id: 'estadisticas', titulo: 'Estadísticas',         icon: BarChart3,        color: 'from-[#2980b9] to-[#1f618d]' },
  { id: 'inventario', titulo: 'Configuración de Inventario', icon: Warehouse,   color: 'from-[#16a085] to-[#117864]' },
  { id: 'categorias', titulo: 'Categorías',              icon: FolderTree,       color: 'from-[#d35400] to-[#a04000]' },
  { id: 'caja',       titulo: 'Caja',                    icon: CircleDollarSign, color: 'from-[#27ae60] to-[#1e8449]' },
  { id: 'repVentas',  titulo: 'Reportes de ventas',      icon: TrendingUp,       color: 'from-[#c0392b] to-[#922b21]' },
  { id: 'repInv',     titulo: 'Reportes de inventario',  icon: ClipboardList,    color: 'from-[#f39c12] to-[#b9770e]' },
  { id: 'usuario',    titulo: 'Configuración de usuario', icon: UserCog,         color: 'from-[#34495e] to-[#212f3d]' },
];

function HubCard({ titulo, icon: Icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        bg-gradient-to-br ${color} text-white rounded-xl shadow-sm
        hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out
        p-6 flex flex-col items-center justify-center gap-3 text-center
        focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40
        cursor-pointer select-none min-h-[160px]
      `}
    >
      <Icon size={44} strokeWidth={1.75} />
      <span className="font-semibold text-base leading-tight">{titulo}</span>
    </button>
  );
}

// ── Fila de categoría ───────────────────────────────────────────────────────
const FilaCategoria = memo(function FilaCategoria({ categoria, onEditar, onEliminar }) {
  return (
    <tr className="even:bg-gray-50 hover:bg-orange-50/40 transition-colors">
      <td className="border border-gray-300 px-3 py-2 font-medium">{categoria.nombre}</td>
      <td className="border border-gray-300 px-3 py-2">{categoria.descripcion || <span className="text-gray-400 italic">No tiene</span>}</td>
      <td className="border border-gray-300 px-3 py-2">
        {categoria.descripcionGarantia || <span className="text-gray-400 italic">No tiene</span>}
      </td>
      <td className="border border-gray-300 px-3 py-2">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onEditar(categoria)}
            title="Editar categoría"
            className="inline-flex items-center justify-center bg-[#28a745] hover:bg-[#218838] text-white rounded p-1.5 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onEliminar(categoria)}
            title="Eliminar categoría"
            className="inline-flex items-center justify-center bg-[#dc3545] hover:bg-[#c82333] text-white rounded p-1.5 transition-colors"
          >
            <Trash2 size={12} />
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
      className="fixed inset-0 z-[1050] bg-black/50 flex items-start justify-center pt-16 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-md shadow-xl mb-8 w-[520px] max-w-[96vw]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 bg-[#d35400] text-white rounded-t-md">
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
    <>
      <div className="flex items-center justify-between mb-5 gap-2">
        <button
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded px-3 py-1.5 text-sm transition-colors"
        >
          <ArrowLeft size={14} /> Volver
        </button>
        <h1 className="text-2xl font-semibold m-0 inline-flex items-center gap-2">
          <Tag size={24} className="text-[#d35400]" /> Listado de Categorías
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => cargar()}
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded px-3 py-1.5 text-sm transition-colors"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={abrirAgregar}
            className="inline-flex items-center gap-1.5 bg-[#d35400] hover:bg-[#a04000] text-white rounded px-3 py-1.5 text-sm transition-colors"
          >
            <Plus size={14} /> Agregar Categoría
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left w-48">Nombre</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Descripción</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Descripción de Garantía</th>
              <th className="border border-gray-300 px-3 py-2 text-center w-28">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="border border-gray-300 text-center text-gray-500 py-6">
                  Cargando categorías…
                </td>
              </tr>
            ) : categorias.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-gray-300 text-center text-gray-500 py-6">
                  No hay categorías registradas
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

      <Modal
        show={showModal}
        onClose={cerrarModal}
        title={editingId ? 'Editar Categoría' : 'Agregar Categoría'}
      >
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 font-medium">Nombre de la Categoría</label>
            <input
              type="text"
              autoComplete="off"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-[#d35400]"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Descripción</label>
            <textarea
              rows="2"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Agregue una descripción de la categoría (Opcional)"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-[#d35400] resize-y"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 font-medium">Descripción de Garantía</label>
            <textarea
              rows="2"
              value={form.descripcionGarantia}
              onChange={(e) => setForm((f) => ({ ...f, descripcionGarantia: e.target.value }))}
              placeholder="Agregue una descripción de garantía (Opcional)"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:border-[#d35400] resize-y"
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#d35400] hover:bg-[#a04000] disabled:opacity-60 text-white rounded text-sm transition-colors"
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
        textoCancelar="Volver"
        onAceptar={confirm?.onAceptar}
        onCancelar={() => setConfirm(null)}
        danger={confirm?.danger}
      />
    </>
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

  return (
    <div className="pt-[55px] min-h-screen bg-white">
      <div className="w-[92%] max-w-[1500px] mx-auto px-4 py-5">
        {seccion === 'hub' ? (
          <>
            <h1 className="text-center text-2xl font-semibold select-none">Configuración</h1>
            <p className="text-center text-gray-500 mb-6">
              Administra los módulos, reportes y parámetros del sistema
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {SECCIONES.map((s) => (
                <HubCard
                  key={s.id}
                  titulo={s.titulo}
                  icon={s.icon}
                  color={s.color}
                  onClick={() => onCardClick(s.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <SeccionCategorias onVolver={() => setSeccion('hub')} />
        )}
      </div>
    </div>
  );
}
