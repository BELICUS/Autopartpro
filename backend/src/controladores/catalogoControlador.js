/** Controlador de los catálogos que alimentan los selectores del buscador. */
import * as Catalogo from '../modelos/CatalogoModelo.js';

export async function categorias(_req, res) {
  res.json(await Catalogo.categorias());
}

export async function fabricantes(_req, res) {
  res.json(await Catalogo.fabricantes());
}

export async function marcas(_req, res) {
  res.json(await Catalogo.marcasVehiculo());
}

export async function modelos(req, res) {
  const marcaId = Number.parseInt(req.params.marcaId, 10);
  if (!Number.isFinite(marcaId)) {
    return res.status(400).json({ error: 'Marca no válida' });
  }
  return res.json(await Catalogo.modelosDeMarca(marcaId));
}

export async function anios(req, res) {
  const modeloId = Number.parseInt(req.params.modeloId, 10);
  if (!Number.isFinite(modeloId)) {
    return res.status(400).json({ error: 'Modelo no válido' });
  }
  return res.json(await Catalogo.aniosDeModelo(modeloId));
}

export async function vehiculos(req, res) {
  res.json(
    await Catalogo.vehiculos({
      marcaId: Number.parseInt(req.query.marca, 10) || null,
      modeloId: Number.parseInt(req.query.modelo, 10) || null,
    }),
  );
}
