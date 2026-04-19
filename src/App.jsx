import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';

import Facturacion from './pages/Facturacion';
import Inventario from './pages/Inventario';
import Ventas from './pages/Ventas';
import Prestamos from './pages/Prestamos';
import Scan from './pages/Scan';
import Pedidos from './pages/Pedidos';
import Activos from './pages/Activos';
import Clientes from './pages/Clientes';
import Config from './pages/Config';

const LS_NAV_LOCK = 'navbarLocked';

export default function App() {
  const [locked, setLocked] = useState(() => localStorage.getItem(LS_NAV_LOCK) === 'true');
  const [hovered, setHovered] = useState(false);
  const expanded = locked || hovered;

  useEffect(() => {
    localStorage.setItem(LS_NAV_LOCK, String(locked));
  }, [locked]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white">
        <Navbar
          locked={locked}
          hovered={hovered}
          onHoverChange={setHovered}
          onToggleLock={() => setLocked(v => !v)}
        />
        <main
          className={`transition-[padding] duration-200 ease-out ${
            expanded ? 'pl-[240px]' : 'pl-[72px]'
          }`}
        >
          <Routes>
            <Route path="/" element={<Facturacion />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/prestamos" element={<Prestamos />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/activos" element={<Activos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </BrowserRouter>
  );
}
