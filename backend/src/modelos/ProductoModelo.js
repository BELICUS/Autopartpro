/**
 * Modelo Producto — toda la conversación con las tablas `productos`,
 * `compatibilidades` y sus catálogos asociados.
 *
 * En el patrón MVC el modelo es la única capa que escribe SQL. Los
 * controladores reciben y devuelven objetos; no saben que hay una base
 * de datos detrás.
 */
import { consultar, consultarUna, enTransaccion } from '../config/basedatos.js';

/** Columnas por las que se permite ordenar. Lista blanca contra inyección. */
const ORDENES_PERMITIDOS = {
  relevancia: 'p.nombre ASC',
  precio_asc: 'precio_final ASC',
  precio_desc: 'precio_final DESC',
  nombre: 'p.nombre ASC',
  recientes: 'p.creado_en DESC',
};

/** Selección común a todas las consultas de catálogo. */
const SELECCION = `
  SELECT
    p.id, p.sku, p.nombre, p.descripcion, p.precio, p.precio_oferta,
    p.stock, p.stock_minimo, p.ubicacion_bodega, p.imagen, p.activo,
    COALESCE(p.precio_oferta, p.precio) AS precio_final,
    c.id AS categoria_id, c.nombre AS categoria, c.slug AS categoria_slug,
    f.id AS fabricante_id, f.nombre AS fabricante
  FROM productos p
  JOIN categorias c   ON c.id = p.categoria_id
  LEFT JOIN fabricantes f ON f.id = p.fabricante_id
`;

/**
 * Busca productos aplicando los filtros del buscador avanzado.
 *
 * El filtro por vehículo es el corazón del módulo: cuando llega `marcaId`,
 * `modeloId` o `anio`, la consulta entra por `compatibilidades` y se queda
 * solo con los repuestos que aplican a ese carro. El año se compara contra
 * el rango de la generación (`anio_inicio` … `anio_fin`).
 */
export async function buscar(filtros = {}) {
  const {
    texto,
    categoriaId,
    fabricanteId,
    marcaId,
    modeloId,
    anio,
    precioMin,
    precioMax,
    soloDisponibles = true,
    orden = 'relevancia',
    pagina = 1,
    porPagina = 12,
  } = filtros;

  const condiciones = ['p.activo = 1'];
  const parametros = [];
  // El JOIN con compatibilidades solo se agrega si hace falta; así el
  // catálogo sin filtro de vehículo no paga el costo de recorrer el puente.
  let unionVehiculo = '';

  if (marcaId || modeloId || anio) {
    unionVehiculo = `
      JOIN compatibilidades comp ON comp.producto_id = p.id
      JOIN vehiculos  v  ON v.id = comp.vehiculo_id
      JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
    `;
    if (marcaId) {
      condiciones.push('mo.marca_id = ?');
      parametros.push(marcaId);
    }
    if (modeloId) {
      condiciones.push('mo.id = ?');
      parametros.push(modeloId);
    }
    if (anio) {
      condiciones.push('? BETWEEN v.anio_inicio AND v.anio_fin');
      parametros.push(anio);
    }
  }

  if (texto) {
    // LIKE en vez de MATCH para que funcione con términos cortos como "NGK",
    // que el índice FULLTEXT descarta por longitud mínima.
    condiciones.push('(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.sku LIKE ?)');
    const patron = `%${texto}%`;
    parametros.push(patron, patron, patron);
  }
  if (categoriaId) {
    condiciones.push('p.categoria_id = ?');
    parametros.push(categoriaId);
  }
  if (fabricanteId) {
    condiciones.push('p.fabricante_id = ?');
    parametros.push(fabricanteId);
  }
  if (precioMin != null) {
    condiciones.push('COALESCE(p.precio_oferta, p.precio) >= ?');
    parametros.push(precioMin);
  }
  if (precioMax != null) {
    condiciones.push('COALESCE(p.precio_oferta, p.precio) <= ?');
    parametros.push(precioMax);
  }
  if (soloDisponibles) {
    condiciones.push('p.stock > 0');
  }

  const donde = `WHERE ${condiciones.join(' AND ')}`;
  const ordenSql = ORDENES_PERMITIDOS[orden] ?? ORDENES_PERMITIDOS.relevancia;
  const limite = Math.min(Number(porPagina) || 12, 60);
  const desplazamiento = (Math.max(Number(pagina) || 1, 1) - 1) * limite;

  // DISTINCT porque un producto compatible con varias generaciones del mismo
  // modelo aparecería repetido tras el JOIN con compatibilidades.
  const filas = await consultar(
    `${SELECCION} ${unionVehiculo} ${donde}
     GROUP BY p.id
     ORDER BY ${ordenSql}
     LIMIT ${limite} OFFSET ${desplazamiento}`,
    parametros,
  );

  const conteo = await consultarUna(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM productos p
     JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN fabricantes f ON f.id = p.fabricante_id
     ${unionVehiculo} ${donde}`,
    parametros,
  );

  return {
    productos: filas,
    total: conteo?.total ?? 0,
    pagina: Math.max(Number(pagina) || 1, 1),
    porPagina: limite,
    totalPaginas: Math.ceil((conteo?.total ?? 0) / limite),
  };
}

/** Un producto por id, con la lista de vehículos compatibles. */
export async function obtenerPorId(id) {
  const producto = await consultarUna(`${SELECCION} WHERE p.id = ?`, [id]);
  if (!producto) return null;

  producto.compatibilidades = await consultar(
    `SELECT v.id, ma.nombre AS marca, mo.nombre AS modelo,
            v.anio_inicio, v.anio_fin, v.motor, v.combustible, comp.nota
     FROM compatibilidades comp
     JOIN vehiculos v  ON v.id = comp.vehiculo_id
     JOIN modelos_vehiculo mo ON mo.id = v.modelo_id
     JOIN marcas_vehiculo  ma ON ma.id = mo.marca_id
     WHERE comp.producto_id = ?
     ORDER BY ma.nombre, mo.nombre, v.anio_inicio`,
    [id],
  );

  return producto;
}

/** Un producto por SKU. Se usa al validar el carrito. */
export async function obtenerPorSku(sku) {
  return consultarUna(`${SELECCION} WHERE p.sku = ?`, [sku]);
}

/** Crea un producto y, si vienen, sus compatibilidades. */
export async function crear(datos) {
  return enTransaccion(async (conexion) => {
    const [resultado] = await conexion.execute(
      `INSERT INTO productos
         (sku, nombre, descripcion, categoria_id, fabricante_id,
          precio, precio_oferta, stock, stock_minimo, ubicacion_bodega, imagen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.sku,
        datos.nombre,
        datos.descripcion ?? null,
        datos.categoriaId,
        datos.fabricanteId ?? null,
        datos.precio,
        datos.precioOferta ?? null,
        datos.stock ?? 0,
        datos.stockMinimo ?? 5,
        datos.ubicacionBodega ?? null,
        datos.imagen ?? null,
      ],
    );

    const id = resultado.insertId;

    if (Array.isArray(datos.vehiculosCompatibles) && datos.vehiculosCompatibles.length > 0) {
      const valores = datos.vehiculosCompatibles.map((v) => [id, v]);
      await conexion.query(
        'INSERT INTO compatibilidades (producto_id, vehiculo_id) VALUES ?',
        [valores],
      );
    }

    // El stock inicial también es un movimiento: el kardex debe cuadrar
    // con la existencia desde el primer día.
    if ((datos.stock ?? 0) > 0) {
      await conexion.execute(
        `INSERT INTO movimientos_inventario
           (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_id)
         VALUES (?, 'entrada', ?, ?, 'Carga inicial del producto', ?)`,
        [id, datos.stock, datos.stock, datos.usuarioId ?? null],
      );
    }

    return id;
  });
}

/** Actualiza los campos enviados. Los ausentes se dejan como están. */
export async function actualizar(id, datos) {
  const columnas = {
    sku: 'sku',
    nombre: 'nombre',
    descripcion: 'descripcion',
    categoriaId: 'categoria_id',
    fabricanteId: 'fabricante_id',
    precio: 'precio',
    precioOferta: 'precio_oferta',
    stockMinimo: 'stock_minimo',
    ubicacionBodega: 'ubicacion_bodega',
    imagen: 'imagen',
    activo: 'activo',
  };

  const asignaciones = [];
  const parametros = [];

  for (const [clave, columna] of Object.entries(columnas)) {
    if (datos[clave] !== undefined) {
      asignaciones.push(`${columna} = ?`);
      parametros.push(datos[clave]);
    }
  }

  if (asignaciones.length === 0) return false;

  parametros.push(id);
  const filas = await consultar(
    `UPDATE productos SET ${asignaciones.join(', ')} WHERE id = ?`,
    parametros,
  );

  // Las compatibilidades se reemplazan por completo si vienen en la petición.
  if (Array.isArray(datos.vehiculosCompatibles)) {
    await enTransaccion(async (conexion) => {
      await conexion.execute('DELETE FROM compatibilidades WHERE producto_id = ?', [id]);
      if (datos.vehiculosCompatibles.length > 0) {
        await conexion.query(
          'INSERT INTO compatibilidades (producto_id, vehiculo_id) VALUES ?',
          [datos.vehiculosCompatibles.map((v) => [id, v])],
        );
      }
    });
  }

  return filas.affectedRows > 0;
}

/**
 * Baja lógica. No se borra el registro porque los pedidos históricos
 * mantienen una llave foránea hacia el producto.
 */
export async function desactivar(id) {
  const resultado = await consultar('UPDATE productos SET activo = 0 WHERE id = ?', [id]);
  return resultado.affectedRows > 0;
}
