/** Controlador del módulo de inventario. Todas las rutas son administrativas. */
import * as Inventario from '../modelos/InventarioModelo.js';

/** GET /api/inventario/alertas */
export async function alertas(req, res) {
  const severidad = req.query.severidad;
  const permitidas = ['agotado', 'critico', 'bajo'];

  res.json(
    await Inventario.alertasStock({
      severidad: permitidas.includes(severidad) ? severidad : null,
    }),
  );
}

/** GET /api/inventario/resumen */
export async function resumen(_req, res) {
  res.json(await Inventario.resumen());
}

/** GET /api/inventario/kardex/:productoId */
export async function kardex(req, res) {
  const productoId = Number.parseInt(req.params.productoId, 10);
  if (!Number.isFinite(productoId)) {
    return res.status(400).json({ error: 'Producto no válido' });
  }
  return res.json(await Inventario.kardex(productoId, req.query.limite));
}

/** POST /api/inventario/movimientos */
export async function registrarMovimiento(req, res) {
  const resultado = await Inventario.registrarMovimiento({
    productoId: req.body.productoId,
    tipo: req.body.tipo,
    cantidad: req.body.cantidad,
    motivo: req.body.motivo,
    usuarioId: req.usuario.id,
  });

  res.status(201).json(resultado);
}
