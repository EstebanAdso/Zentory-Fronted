import axios from 'axios';

const BASE_URL = 'http://localhost:8083';

const api = axios.create({ baseURL: BASE_URL });

// ── Productos ──────────────────────────────────────────────────────────────
export const getProductos = (page = 0, size = 14) =>
  api.get(`/producto?page=${page}&size=${size}`);

export const getProducto = (id) =>
  api.get(`/producto/${id}`);

export const getProductosPorCategoria = (categoria, page = 0, size = 14) =>
  api.get(`/producto/categoria/${encodeURIComponent(categoria)}?page=${page}&size=${size}`);

export const getProductosInactivos = (page = 0, size = 14) =>
  api.get(`/producto/inactivos?page=${page}&size=${size}`);

export const buscarProductosPorNombre = (nombre, page = 0, size = 14) =>
  api.get(`/producto/nombre/${encodeURIComponent(nombre)}?page=${page}&size=${size}`);

export const buscarProductosPorNombreInactivo = (nombre, page = 0, size = 14) =>
  api.get(`/producto/nombreInactivo/${encodeURIComponent(nombre)}?page=${page}&size=${size}`);

export const getTotalGlobal = () =>
  api.get('/producto/totalGlobal');

export const getTotalPorCategoria = () =>
  api.get('/producto/totalPorCategoria');

export const buscarProductos = (query) =>
  api.get(`/producto/buscar?query=${encodeURIComponent(query)}`);

export const buscarProductoPorCodigo = (codigo) =>
  api.get(`/producto/buscar-codigo/${encodeURIComponent(codigo)}`);

export const crearProducto = (data) =>
  api.post('/producto', data);

export const actualizarProducto = (id, data) =>
  api.put(`/producto/${id}`, data);

export const eliminarProducto = (id) =>
  api.delete(`/producto/${id}`);

// ── Categorías ────────────────────────────────────────────────────────────
export const getCategorias = () => api.get('/categoria');
export const crearCategoria = (data) => api.post('/categoria', data);
export const actualizarCategoria = (id, data) => api.put(`/categoria/${id}`, data);
export const eliminarCategoria = (id) => api.delete(`/categoria/${id}`);

// ── Clientes ──────────────────────────────────────────────────────────────
export const getClientes = (page = 0, size = 20) =>
  api.get(`/cliente?page=${page}&size=${size}`);
export const buscarClientes = (query, page = 0, size = 20) =>
  api.get(`/cliente/buscar?query=${encodeURIComponent(query)}&page=${page}&size=${size}`);
export const crearCliente = (data) => api.post('/cliente', data);
export const actualizarCliente = (id, data) => api.put(`/cliente/${id}`, data);
export const getClienteSugerencias = (query) =>
  api.get(`/cliente/suggestions?query=${encodeURIComponent(query)}`);
export const getTopClientes = () => api.get('/cliente/top');

// ── Activos ───────────────────────────────────────────────────────────────
export const getActivos = (page = 0, size = 20) =>
  api.get(`/activos?page=${page}&size=${size}`);
export const crearActivo = (data) => api.post('/activos', data);
export const actualizarActivo = (id, data) => api.put(`/activos/${id}`, data);
export const eliminarActivo = (id) => api.delete(`/activos/${id}`);

// ── Pedidos ───────────────────────────────────────────────────────────────
export const getPedidos = (page = 0, size = 20) =>
  api.get(`/pedido?page=${page}&size=${size}`);
export const crearPedido = (data) => api.post('/pedido', data);
export const eliminarPedido = (id) => api.delete(`/pedido/${id}`);
export const recibirPedido = (id) => api.put(`/pedido/${id}/recibir`);

// ── Facturas ──────────────────────────────────────────────────────────────
export const getFacturas = (page = 0, size = 20) =>
  api.get(`/api/facturas?page=${page}&size=${size}`);
export const buscarFacturas = (query, page = 0, size = 20) =>
  api.get(`/api/facturas/buscar?query=${encodeURIComponent(query)}&page=${page}&size=${size}`);
export const getFactura = (id) => api.get(`/api/facturas/${id}`);
export const getFacturaDetalles = (id) => api.get(`/api/facturas/${id}/detalles`);
export const getFacturaPagos = (id) => api.get(`/api/facturas/${id}/pagos`);
export const crearFactura = (data) => api.post('/api/facturas/crear', data);
export const actualizarFactura = (id, data) => api.put(`/api/facturas/${id}`, data);
export const eliminarFactura = (id) => api.delete(`/api/facturas/${id}`);

// ── Cuentas de recaudo ────────────────────────────────────────────────────
export const getCuentasRecaudo = (soloActivos = true) =>
  api.get(`/api/cuentas-recaudo?soloActivos=${soloActivos}`);
export const crearCuentaRecaudo = (data) => api.post('/api/cuentas-recaudo', data);
export const actualizarCuentaRecaudo = (id, data) => api.put(`/api/cuentas-recaudo/${id}`, data);
export const eliminarCuentaRecaudo = (id) => api.delete(`/api/cuentas-recaudo/${id}`);

// ── Caja ──────────────────────────────────────────────────────────────────
export const getCajaAbierta = () => api.get('/api/caja/abierta');
export const getCajaResumen = (id) => api.get(`/api/caja/${id}/resumen`);
export const getCajaMovimientos = (id) => api.get(`/api/caja/${id}/movimientos`);
export const getCajaHistorial = (page = 0, size = 20) =>
  api.get(`/api/caja/historial?page=${page}&size=${size}`);
export const abrirCaja = (data) => api.post('/api/caja/abrir', data);
export const cerrarCaja = (data) => api.post('/api/caja/cerrar', data);
export const registrarGastoCaja = (data) => api.post('/api/caja/gasto', data);

// ── Préstamos ─────────────────────────────────────────────────────────────
export const getPrestamos = () => api.get('/api/prestamos');
export const getPrestamo = (id) => api.get(`/api/prestamos/${id}`);
export const getPrestamoDetalles = (id) => api.get(`/api/prestamos/${id}/detalles`);
export const getPrestamoAbonos = (id) => api.get(`/api/prestamos/${id}/abonos`);
export const getPrestamosPendientes = () => api.get('/api/prestamos/pendientes');
export const getPrestamosPorEstado = (estado) =>
  api.get(`/api/prestamos/estado/${estado}`);
export const crearPrestamo = (data) => api.post('/api/prestamos/crear', data);
export const actualizarPrestamo = (id, data) => api.put(`/api/prestamos/${id}`, data);
export const agregarAbono = (data) => api.post('/api/prestamos/abono', data);
export const eliminarPrestamo = (id) => api.delete(`/api/prestamos/${id}`);
export const anularPrestamo = (id) => api.post(`/api/prestamos/${id}/anular`);
export const convertirPrestamoAFactura = (id, payload = null) => {
  // payload: null | number (legacy: solo cuenta única) | { cuentaRecaudoId?, pagosFinal? }
  let body = {};
  if (payload && typeof payload === 'object') {
    if (payload.pagosFinal && payload.pagosFinal.length > 0) body.pagosFinal = payload.pagosFinal;
    else if (payload.cuentaRecaudoId) body.cuentaRecaudoId = payload.cuentaRecaudoId;
  } else if (payload) {
    body.cuentaRecaudoId = payload;
  }
  return api.post(`/api/prestamos/${id}/convertir-factura`, body);
};

// ── Códigos de barras ─────────────────────────────────────────────────────
export const getCodigosBarra = () => api.get('/codigoBarra');
export const getCodigosBarraPorProducto = (productoId) =>
  api.get(`/codigoBarra/producto/${productoId}`);
export const crearCodigoBarra = (data) => api.post('/codigoBarra', data);
export const eliminarCodigoBarra = (id) => api.delete(`/codigoBarra/${id}`);
