import axios from 'axios';

const BASE_URL = 'http://localhost:8082';

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
export const getClientes = () => api.get('/cliente');
export const crearCliente = (data) => api.post('/cliente', data);
export const actualizarCliente = (id, data) => api.put(`/cliente/${id}`, data);
export const getClienteSugerencias = (query) =>
  api.get(`/cliente/suggestions?query=${encodeURIComponent(query)}`);
export const getTopClientes = () => api.get('/cliente/top');

// ── Activos ───────────────────────────────────────────────────────────────
export const getActivos = () => api.get('/activos');
export const crearActivo = (data) => api.post('/activos', data);
export const actualizarActivo = (id, data) => api.put(`/activos/${id}`, data);
export const eliminarActivo = (id) => api.delete(`/activos/${id}`);

// ── Pedidos ───────────────────────────────────────────────────────────────
export const getPedidos = () => api.get('/pedido');
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
export const crearFactura = (data) => api.post('/api/facturas/crear', data);
export const actualizarFactura = (id, data) => api.put(`/api/facturas/${id}`, data);
export const eliminarFactura = (id) => api.delete(`/api/facturas/${id}`);

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
export const convertirPrestamoAFactura = (id) =>
  api.post(`/api/prestamos/${id}/convertir-factura`);

// ── Códigos de barras ─────────────────────────────────────────────────────
export const getCodigosBarra = () => api.get('/codigoBarra');
export const getCodigosBarraPorProducto = (productoId) =>
  api.get(`/codigoBarra/producto/${productoId}`);
export const crearCodigoBarra = (data) => api.post('/codigoBarra', data);
export const eliminarCodigoBarra = (id) => api.delete(`/codigoBarra/${id}`);
