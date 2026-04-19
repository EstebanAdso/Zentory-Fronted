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
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',          label: 'Facturación', Icon: BookOpen     },
  { to: '/inventario',label: 'Inventario',  Icon: Store        },
  { to: '/ventas',    label: 'Ventas',      Icon: Banknote     },
  { to: '/prestamos', label: 'Préstamos',   Icon: ArrowLeftRight },
  { to: '/scan',      label: 'Escanear',    Icon: ScanBarcode  },
  { to: '/pedidos',   label: 'Pedidos',     Icon: Send         },
  { to: '/activos',   label: 'Activos',     Icon: Building2    },
  { to: '/clientes',  label: 'Clientes',    Icon: User         },
  { to: '/config',    label: 'Configuración',Icon: Settings    },
];

export default function Navbar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 h-[55px] flex items-center px-4"
      style={{ backgroundColor: '#343a40' }}
    >
      <nav className="w-full flex items-center justify-evenly">
        {/* Brand */}
        <h6
          className="text-white font-black text-2xl select-none ml-4 whitespace-nowrap"
          style={{ fontSize: '1.7em', fontWeight: 900 }}
        >
          Zentory
        </h6>

        {/* Nav icons */}
        <ul className="flex items-center gap-1 list-none m-0 p-0">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  [
                    'relative flex items-center justify-center h-10 w-10 rounded-[20px] ml-4 select-none transition-colors group',
                    isActive
                      ? 'bg-[#4488ee] text-white'
                      : 'text-gray-300 hover:text-gray-400',
                  ].join(' ')
                }
                title={label}
              >
                <Icon size={20} />
                {/* Tooltip */}
                <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity delay-200"
                  style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                  {label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
