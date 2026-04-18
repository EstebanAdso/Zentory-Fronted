/**
 * Generic confirmation modal.
 * Props:
 *   open         boolean
 *   mensaje      string
 *   textoAceptar string  (default: "Aceptar")
 *   textoCancelar string (default: "Cancelar")
 *   onAceptar    () => void
 *   onCancelar   () => void
 *   danger       boolean  – red header when true (default: true)
 */
export default function ConfirmModal({
  open,
  mensaje,
  textoAceptar = 'Aceptar',
  textoCancelar = 'Cancelar',
  onAceptar,
  onCancelar,
  danger = true,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} />
      {/* modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className={`${danger ? 'bg-red-600' : 'bg-gray-700'} text-white px-5 py-4 rounded-t-xl flex items-center justify-between`}>
          <h5 className="font-bold text-lg">Confirmación</h5>
          <button onClick={onCancelar} className="text-white opacity-80 hover:opacity-100 text-2xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 text-gray-700">{mensaje}</div>
        <div className="px-5 py-3 flex justify-end gap-3 border-t">
          <button
            onClick={onCancelar}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onAceptar}
            className={`px-4 py-2 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded text-sm`}
          >
            {textoAceptar}
          </button>
        </div>
      </div>
    </div>
  );
}
