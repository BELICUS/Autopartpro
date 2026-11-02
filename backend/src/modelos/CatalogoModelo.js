/**
 * Modelo Catálogo — tablas de apoyo que alimentan los selectores del
 * buscador avanzado: categorías, fabricantes y el árbol
 * marca → modelo → generación.
 */
import { consultar } from '../config/basedatos.js';

export async function categorias() {
  return consultar(`
    SELECT c.id, c.nombre, c.slug, c.descripcion,
           COUNT(p.id) AS productos
    FROM categorias c
    LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
    WHERE c.activo = 1
    GROUP BY c.id, c.nombre, c.slug, c.descripcion
    ORDER BY c.nombre
  `);
}

export async function fabricantes() {
  return consultar(`
    SELECT f.id, f.nombre, f.pais, COUNT(p.id) AS productos
    FROM fabricantes f
    LEFT JOIN productos p ON p.fabricante_id = f.id AND p.activo = 1
    GROUP BY f.id, f.nombre, f.pais
    ORDER BY f.nombre
  `);
}

export async function marcasVehiculo() {
  return consultar(`
    SELECT m.id, m.nombre, COUNT(DISTINCT mo.id) AS modelos
    FROM marcas_vehiculo m
    LEFT JOIN modelos_vehiculo mo ON mo.marca_id = m.id
    GROUP BY m.id, m.nombre
    ORDER BY m.nombre
  `);
}

/** Modelos de una marca. Alimenta el segundo selector del buscador. */
export async function modelosDeMarca(marcaId) {
  return consultar(
    `SELECT id, nombre FROM modelos_vehiculo WHERE marca_id = ? ORDER BY nombre`,
    [marcaId],
  );
}

/**
 * Años disponibles para un modelo.
 *
 * Las generaciones se guardan como rango (anio_inicio … anio_fin), pero el
 * selector necesita años sueltos. Se expande el rango en JavaScript: hacerlo
 * en SQL exigiría una tabla de números o un CTE recursivo, y MariaDB 10.4
 * los soporta a medias.
 */
export async function aniosDeModelo(modeloId) {
  const generaciones = await consultar(
    'SELECT anio_inicio, anio_fin FROM vehiculos WHERE modelo_id = ?',
    [modeloId],
  );

  const anios = new Set();
  for (const { anio_inicio: inicio, anio_fin: fin } of generaciones) {
    for (let anio = inicio; anio <= fin; anio++) {
      anios.add(anio);
    }
  }

  return [...anios].sort((a, b) => b - a);
}

/** Generaciones concretas, para el formulario de alta de productos. */
export async function vehiculos({ marcaId = null, modeloId = null } = {}) {
  const condiciones = [];
  const parametros = [];

  if (marcaId) {
    condiciones.push('mo.marca_id = ?');
    parametros.push(marcaId);
  }
  if (modeloId) {
    condiciones.push('v.modelo_id = ?');
    parametros.push(modeloId);
  }

  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  return consultar(
    `SELECT v.id, ma.nombre AS marca, mo.nombre AS modelo,
            v.anio_inicio, v.anio_fin, v.motor, v.combustible,
            CONCAT(ma.nombre, ' ', mo.nombre, ' ', v.anio_inicio, '-', v.anio_fin,
                   ' ', v.motor) AS etiqueta
     FROM vehiculos v
     JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
     JOIN marcas_vehiculo  ma ON ma.id = mo.marca_id
     ${donde}
     ORDER BY ma.nombre, mo.nombre, v.anio_inicio DESC`,
    parametros,
  );
}
