import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Store,
  Banknote,
  ArrowLeftRight,
  ScanBarcode,
  Send,
  Building2,
  User,
  Settings,
  Lock,
  Unlock,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',          label: 'Facturación',   Icon: BookOpen       },
  { to: '/inventario',label: 'Inventario',    Icon: Store          },
  { to: '/ventas',    label: 'Ventas',        Icon: Banknote       },
  { to: '/prestamos', label: 'Préstamos',     Icon: ArrowLeftRight },
  { to: '/scan',      label: 'Escanear',      Icon: ScanBarcode    },
  { to: '/pedidos',   label: 'Pedidos',       Icon: Send           },
  { to: '/activos',   label: 'Activos',       Icon: Building2      },
  { to: '/clientes',  label: 'Clientes',      Icon: User           },
  { to: '/config',    label: 'Configuración', Icon: Settings       },
];

export default function Navbar({ locked, hovered, onHoverChange, onToggleLock }) {
  const expanded = locked || hovered;

  return (
    <aside
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-[#1e293b] text-white shadow-[2px_0_20px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out overflow-hidden ${
        expanded ? 'w-[240px]' : 'w-[72px]'
      }`}
    >
      {/* Brand */}
      <div className="h-[72px] flex items-center px-5 border-b border-white/5 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4488ee] to-[#6ba5ff] flex items-center justify-center font-black text-xl shrink-0 shadow-md shadow-[#4488ee]/30">
          Z
        </div>
        <span
          className={`ml-3 text-xl font-black whitespace-nowrap tracking-tight transition-opacity duration-150 ${
            expanded ? 'opacity-100 delay-75' : 'opacity-0'
          }`}
        >
          Zentory
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1 list-none m-0 p-0 px-3">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                title={expanded ? undefined : label}
                className={({ isActive }) =>
                  [
                    'relative flex items-center h-11 rounded-lg px-3 transition-colors overflow-hidden group',
                    isActive
                      ? 'bg-[#4488ee]/15 text-[#6ba5ff]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#4488ee]" />
                    )}
                    <Icon size={20} className="shrink-0" />
                    <span
                      className={`ml-3 text-sm font-semibold whitespace-nowrap transition-opacity duration-150 ${
                        expanded ? 'opacity-100 delay-75' : 'opacity-0'
                      }`}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2">
        <span
          className={`text-[11px] text-gray-500 whitespace-nowrap transition-opacity duration-150 ${
            expanded ? 'opacity-100 delay-75' : 'opacity-0'
          }`}
        >
          v1.0 · Zentory
        </span>
        <button
          onClick={onToggleLock}
          title={locked ? 'Desbloquear menú' : 'Bloquear menú'}
          aria-label={locked ? 'Desbloquear menú' : 'Bloquear menú'}
          className={`w-7 h-7 flex items-center justify-center rounded-md shrink-0 transition-all ${
            locked
              ? 'bg-[#4488ee]/20 text-[#6ba5ff] hover:bg-[#4488ee]/30'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
          } ${expanded ? 'opacity-100 delay-75' : 'opacity-0 pointer-events-none'}`}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
    </aside>
  );
}
