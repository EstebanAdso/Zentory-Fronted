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

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white">
        <Navbar />
        <main>
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
        <Toaster richColors position="bottom-right" />
      </div>
    </BrowserRouter>
  );
}
