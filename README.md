# Zentory — Frontend

Frontend del sistema de **inventario y facturación Zentory**. Gestiona productos, categorías, clientes, activos, pedidos, ventas/facturas, préstamos y apartados, con impresión POS/PDF y escaneo de códigos de barras.

Es una migración progresiva desde un frontend vanilla JS a **React + Vite + Tailwind v4**, página por página, conservando funcionalidad y estilos pero unificando el stack.

## Scripts

```bash
npm run dev       # servidor de desarrollo con HMR
npm run build     # build de producción a /dist
npm run preview   # sirve el build
npm run lint      # ESLint
```

El backend (Spring Boot) debe correr en `http://localhost:8082` — configurado en `src/api/index.js`.

## Estructura

```
src/
├── api/           → cliente axios + endpoints por recurso
├── components/    → UI compartida (Navbar, ConfirmModal)
├── pages/         → una carpeta por módulo del negocio
│   ├── Inventario/      (productos, categorías, códigos de barra)
│   ├── Facturacion/     (creación de ventas)
│   ├── Ventas/          (listado e historial de facturas)
│   ├── Prestamos/       (préstamos, apartados, abonos)
│   ├── Clientes/  Activos/  Pedidos/  Scan/  Config/
├── utils/         → formatters.js, printing.js
├── index.css      → tokens Tailwind v4 bajo @theme
├── App.jsx        → rutas (react-router) + <Toaster /> sonner
└── main.jsx       → entry
```

## Stack y librerías

### Core

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **React 18** | UI declarativa basada en componentes y hooks. | Componentes funcionales con `useState`, `useEffect`, `useMemo`, `useCallback`, `memo`, `useRef`. Subcomponentes a **nivel de módulo** (no dentro del componente padre) para evitar remounts en cada render. |
| **Vite 5** | Bundler/dev server con HMR instantáneo. | `npm run dev` / `npm run build`. Plugin oficial `@vitejs/plugin-react` para Fast Refresh. |
| **React Router v6** | Ruteo SPA del lado del cliente. | Rutas declaradas en `src/App.jsx` con `<BrowserRouter>` y `<Routes>`. Una ruta por módulo. |

### Estilos

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **Tailwind CSS v4** | Utility-first CSS, sin archivos `.css` por componente. | Clases utilitarias directo en el JSX. Tokens personalizados (colores de marca, espaciados) en `src/index.css` bajo `@theme`. Se evita `style={{}}` inline — en código nuevo es **puro Tailwind**. |
| **@tailwindcss/vite** | Plugin oficial de Tailwind v4 para Vite. | Registrado en `vite.config.js`. Procesa las clases sin necesidad de PostCSS config. |

### UI / UX

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **lucide-react** | Íconos SVG consistentes y tree-shakeable. | `import { Search, Printer, ... } from 'lucide-react'`. Tamaño por prop `size={14}`. Reemplaza FontAwesome del frontend original. |
| **sonner** | Notificaciones toast modernas. | `<Toaster richColors position="bottom-right" />` en `App.jsx`. Luego `toast.success(...)` / `toast.error(...)` en cualquier lugar. **Reemplaza a `alert()`** en todo el proyecto. |
| **@floating-ui/react** | Motor de posicionamiento para popovers, tooltips y dropdowns (base de Radix/shadcn). | Usado en las tarjetas de préstamos (`pages/Prestamos`) para el panel flotante que muestra los productos al hacer hover. Provee `FloatingPortal` (renderiza fuera del DOM local → resuelve z-index entre hermanos del grid), `flip` (se posiciona arriba si no hay espacio abajo), `shift` (no se sale del viewport), `FloatingArrow` (flecha conectora), `useHover` con `safePolygon` (delay + permite mover el cursor hacia el panel), `useTransitionStyles` (animaciones suaves). |

### Datos / HTTP

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **axios** | Cliente HTTP con interceptores, baseURL y transformers. | Única instancia en `src/api/index.js` con `baseURL = 'http://localhost:8082'`. Cada recurso expone funciones (`getProductos`, `crearFactura`, `agregarAbono`, etc.). **Los componentes nunca hacen `fetch` directo** — siempre pasan por este módulo. |

### Impresión / documentos

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **jspdf** | Generación de PDFs en el navegador. | Disponible para exportar documentos a PDF descargable cuando se requiera (facturas, préstamos, reportes). |
| **react-to-print** | Imprimir un subárbol React vía `window.print()`. | Para casos donde imprimimos un componente React ya renderizado. |
| *(nuestro)* `src/utils/printing.js` | Helpers propios para abrir ventanas de impresión POS (58 mm) y PDF A4. | `abrirVentanaImpresion(html)` y `abrirVentanaPOS(html)` abren una ventana nueva, esperan al `onload` y disparan `window.print()` automáticamente. Incluye plantillas HTML: `generarFacturaHTMLPDF`, `generarFacturaHTMLPOS`, `generarPrestamoHTML*`, `generarAbonoHTMLPOS`. |

### Códigos de barras

| Librería | Para qué | Cómo la usamos |
|---|---|---|
| **jsbarcode** | Renderiza códigos de barra en un canvas/SVG. | Para imprimir etiquetas de productos desde el módulo **Inventario**. |

## Convenciones del proyecto

- **Notificaciones** → `toast` de sonner. Nunca `alert()`.
- **Íconos** → `lucide-react`. Nunca inline SVG ni otra librería.
- **HTTP** → funciones de `src/api/index.js`. Agregar nuevos endpoints ahí, no fetch directo en componentes.
- **Formato de números y fechas** → `src/utils/formatters.js` (`formatNumber`, `parseFormattedNumber`, `formatearFecha`).
- **Impresión** → helpers de `src/utils/printing.js`, no llamar `window.open` manualmente.
- **Confirmaciones destructivas** → `src/components/ConfirmModal.jsx`, no `window.confirm`.
- **Estilos** → Tailwind puro en archivos nuevos. Las páginas ya migradas (Inventario, Facturación) aún tienen mezcla de inline + Tailwind por ser las primeras.
- **Performance** → subcomponentes a nivel de módulo + `memo` para listas largas (ej. `FilaFactura`, `PrestamoCard`).

## Módulos (páginas)

| Módulo | Estado | Descripción |
|---|---|---|
| Inventario | Migrado | CRUD de productos, categorías, códigos de barra, filtros por categoría, activar/inactivar. |
| Facturación | Migrado | Crear ventas/facturas con búsqueda de productos y clientes, cálculo de totales, impresión. |
| Ventas | Migrado | Historial de facturas con vista agrupada por fecha, búsqueda, ver detalles e imprimir. |
| Préstamos | Migrado | Préstamos y apartados con abonos parciales, panel flotante de productos al hover, conversión a factura, anulación, impresión POS/PDF y recibos de abono. |
| Clientes / Activos / Pedidos / Scan / Config | Pendientes | Placeholders — por migrar. |
