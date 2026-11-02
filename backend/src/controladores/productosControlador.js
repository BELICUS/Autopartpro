/**
 * Controlador de productos.
 *
 * En MVC el controlador traduce entre HTTP y el modelo: lee la petición,
 * normaliza los datos, llama al modelo y arma la respuesta. No escribe SQL
 * ni decide cómo se guardan las cosas.
 */
import * as Producto from '../modelos/ProductoModelo.js';

/** Convierte un parámetro de query a entero, o null si no es válido. */
function entero(valor) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : null;
}

/** GET /api/productos — buscador con filtros */
export async function buscar(req, res) {
  const resultado = await Producto.buscar({
    texto: req.query.q?.trim() || null,
    categoriaId: entero(req.query.categoria),
    fabricanteId: entero(req.query.fabricante),
    marcaId: entero(req.query.marca),
    modeloId: entero(req.query.modelo),
    anio: entero(req.query.anio),
    precioMin: entero(req.query.precioMin),
    precioMax: entero(req.query.precioMax),
    // El panel administrativo necesita ver también lo agotado.
    soloDisponibles: req.query.incluirAgotados !== 'true',
    orden: req.query.orden,
    pagina: entero(req.query.pagina) ?? 1,
    porPagina: entero(req.query.porPagina) ?? 12,
  });

  res.json(resultado);
}

/** GET /api/productos/:id */
export async function obtener(req, res) {
  const producto = await Producto.obtenerPorId(entero(req.params.id));
  if (!producto) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  return res.json(producto);
}

/** POST /api/productos — solo administradores */
export async function crear(req, res) {
  const id = await Producto.crear({ ...req.body, usuarioId: req.usuario.id });
  const producto = await Producto.obtenerPorId(id);
  res.status(201).json(producto);
}

/** PUT /api/productos/:id — solo administradores */
export async function actualizar(req, res) {
  const id = entero(req.params.id);
  const existe = await Producto.obtenerPorId(id);
  if (!existe) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  await Producto.actualizar(id, req.body);
  return res.json(await Producto.obtenerPorId(id));
}

/** DELETE /api/productos/:id — baja lógica, solo administradores */
export async function desactivar(req, res) {
  const ok = await Producto.desactivar(entero(req.params.id));
  if (!ok) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  return res.status(204).send();
}
