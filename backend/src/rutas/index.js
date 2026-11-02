/**
 * Tabla de rutas de la API REST.
 *
 * Convención seguida en todo el proyecto:
 *   GET    /recurso       listar o buscar
 *   GET    /recurso/:id   obtener uno
 *   POST   /recurso       crear
 *   PUT    /recurso/:id   reemplazar
 *   PATCH  /recurso/:id   modificar parcialmente
 *   DELETE /recurso/:id   eliminar (aquí, baja lógica)
 */
import { Router } from 'express';
import { body, query } from 'express-validator';

import * as productos from '../controladores/productosControlador.js';
import * as catalogo from '../controladores/catalogoControlador.js';
import * as auth from '../controladores/autenticacionControlador.js';
import * as inventario from '../controladores/inventarioControlador.js';
import * as pedidos from '../controladores/pedidosControlador.js';

import { requiereSesion, requiereAdministrador } from '../middlewares/autenticacion.js';
import { asincrono, validar } from '../middlewares/errores.js';

const router = Router();

// ---------------------------------------------------------------- salud ---
router.get('/salud', (_req, res) =>
  res.json({ estado: 'ok', servicio: 'AutoPart Pro API', version: '1.0.0' }),
);

// -------------------------------------------------------- autenticación ---
router.post(
  '/auth/registro',
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('apellido').trim().notEmpty().withMessage('El apellido es obligatorio'),
    body('email').isEmail().withMessage('Correo no válido').normalizeEmail(),
    body('contrasena')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener al menos 8 caracteres'),
    body('telefono').optional({ values: 'falsy' }).trim(),
  ],
  validar,
  asincrono(auth.registro),
);

router.post(
  '/auth/acceso',
  [
    body('email').isEmail().withMessage('Correo no válido').normalizeEmail(),
    body('contrasena').notEmpty().withMessage('La contraseña es obligatoria'),
  ],
  validar,
  asincrono(auth.acceso),
);

router.get('/auth/perfil', requiereSesion, asincrono(auth.perfil));
router.put('/auth/perfil', requiereSesion, asincrono(auth.actualizarPerfil));

// -------------------------------------------------------------- catálogo ---
router.get('/categorias', asincrono(catalogo.categorias));
router.get('/fabricantes', asincrono(catalogo.fabricantes));
router.get('/marcas', asincrono(catalogo.marcas));
router.get('/marcas/:marcaId/modelos', asincrono(catalogo.modelos));
router.get('/modelos/:modeloId/anios', asincrono(catalogo.anios));
router.get('/vehiculos', asincrono(catalogo.vehiculos));

// -------------------------------------------------------------- productos ---
router.get(
  '/productos',
  [
    query('pagina').optional().isInt({ min: 1 }),
    query('porPagina').optional().isInt({ min: 1, max: 60 }),
    query('anio').optional().isInt({ min: 1950, max: 2100 }),
  ],
  validar,
  asincrono(productos.buscar),
);

router.get('/productos/:id', asincrono(productos.obtener));

router.post(
  '/productos',
  requiereSesion,
  requiereAdministrador,
  [
    body('sku').trim().notEmpty().withMessage('El SKU es obligatorio'),
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('categoriaId').isInt({ min: 1 }).withMessage('Categoría no válida'),
    body('precio').isFloat({ min: 0 }).withMessage('El precio no puede ser negativo'),
    body('stock').optional().isInt({ min: 0 }),
    body('stockMinimo').optional().isInt({ min: 0 }),
  ],
  validar,
  asincrono(productos.crear),
);

router.put('/productos/:id', requiereSesion, requiereAdministrador, asincrono(productos.actualizar));
router.delete('/productos/:id', requiereSesion, requiereAdministrador, asincrono(productos.desactivar));

// ------------------------------------------------------------- inventario ---
router.get('/inventario/alertas', requiereSesion, requiereAdministrador, asincrono(inventario.alertas));
router.get('/inventario/resumen', requiereSesion, requiereAdministrador, asincrono(inventario.resumen));
router.get(
  '/inventario/kardex/:productoId',
  requiereSesion,
  requiereAdministrador,
  asincrono(inventario.kardex),
);
router.post(
  '/inventario/movimientos',
  requiereSesion,
  requiereAdministrador,
  [
    body('productoId').isInt({ min: 1 }),
    body('tipo').isIn(['entrada', 'salida', 'ajuste']),
    body('cantidad').isInt({ min: 0 }),
  ],
  validar,
  asincrono(inventario.registrarMovimiento),
);

// ---------------------------------------------------------------- pedidos ---
router.post(
  '/pedidos',
  requiereSesion,
  [
    body('items').isArray({ min: 1 }).withMessage('El carrito está vacío'),
    body('items.*.productoId').isInt({ min: 1 }),
    body('items.*.cantidad').isInt({ min: 1 }),
    body('direccion').trim().notEmpty().withMessage('La dirección es obligatoria'),
    body('ciudad').trim().notEmpty().withMessage('La ciudad es obligatoria'),
    body('telefono').trim().notEmpty().withMessage('El teléfono es obligatorio'),
  ],
  validar,
  asincrono(pedidos.crear),
);

router.get('/pedidos/mios', requiereSesion, asincrono(pedidos.mios));
router.get('/pedidos', requiereSesion, requiereAdministrador, asincrono(pedidos.listar));
router.get('/pedidos/:id', requiereSesion, asincrono(pedidos.obtener));
router.patch(
  '/pedidos/:id/estado',
  requiereSesion,
  requiereAdministrador,
  asincrono(pedidos.cambiarEstado),
);

// ------------------------------------------------------------------ pagos ---
router.get('/pagos/estado', asincrono(pedidos.estadoDePasarela));
router.get('/pagos/transferencia', asincrono(pedidos.infoTransferencia));
router.post('/pagos/iniciar/:pedidoId', requiereSesion, asincrono(pedidos.iniciarPago));
router.get('/pagos/verificar', asincrono(pedidos.verificarPago));
// Público y sin sesión: lo llama Wompi desde sus servidores.
router.post('/pagos/webhook', asincrono(pedidos.webhookWompi));

export default router;
