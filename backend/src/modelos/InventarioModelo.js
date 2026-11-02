/**
 * Modelo Inventario — existencias, kardex y alertas de stock mínimo.
 *
 * Regla de oro del módulo: el stock de `productos` nunca se modifica con un
 * UPDATE suelto. Siempre pasa por `registrarMovimiento`, que actualiza la
 * existencia y escribe la bitácora en la misma transacción. Así el kardex
 * y la existencia no pueden desincronizarse.
 */
import { consultar, consultarUna, enTransaccion } from '../config/basedatos.js';

/**
 * Registra una entrada, salida o ajuste y deja el stock actualizado.
 *
 * @param {object} datos
 * @param {number} datos.productoId
 * @param {'entrada'|'salida'|'ajuste'} datos.tipo
 * @param {number} datos.cantidad  Siempre positiva; el signo lo decide `tipo`.
 *                                 En un 'ajuste' es la existencia final deseada.
 * @param {object} [conexionExterna] Conexión de una transacción en curso.
 */
export async function registrarMovimiento(datos, conexionExterna = null) {
  const ejecutar = async (conexion) => {
    // SELECT ... FOR UPDATE bloquea la fila hasta el commit. Sin esto, dos
    // pedidos simultáneos del último artículo leerían el mismo stock y
    // ambos lo venderían.
    const [filas] = await conexion.execute(
      'SELECT id, stock, nombre FROM productos WHERE id = ? FOR UPDATE',
      [datos.productoId],
    );

    if (filas.length === 0) {
      const error = new Error(`El producto ${datos.productoId} no existe`);
      error.codigoHttp = 404;
      throw error;
    }

    const producto = filas[0];
    let stockResultante;

    switch (datos.tipo) {
      case 'entrada':
        stockResultante = producto.stock + datos.cantidad;
        break;
      case 'salida':
        stockResultante = producto.stock - datos.cantidad;
        if (stockResultante < 0) {
          const error = new Error(
            `Stock insuficiente de "${producto.nombre}": hay ${producto.stock}, se piden ${datos.cantidad}`,
          );
          error.codigoHttp = 409;
          throw error;
        }
        break;
      case 'ajuste':
        // En un ajuste la cantidad es la existencia real contada en bodega.
        stockResultante = datos.cantidad;
        break;
      default:
        throw new Error(`Tipo de movimiento no válido: ${datos.tipo}`);
    }

    await conexion.execute('UPDATE productos SET stock = ? WHERE id = ?', [
      stockResultante,
      datos.productoId,
    ]);

    await conexion.execute(
      `INSERT INTO movimientos_inventario
         (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_id, pedido_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.productoId,
        datos.tipo,
        datos.tipo === 'ajuste' ? Math.abs(stockResultante - producto.stock) || 1 : datos.cantidad,
        stockResultante,
        datos.motivo ?? null,
        datos.usuarioId ?? null,
        datos.pedidoId ?? null,
      ],
    );

    return { stockAnterior: producto.stock, stockResultante };
  };

  return conexionExterna ? ejecutar(conexionExterna) : enTransaccion(ejecutar);
}

/**
 * Productos en o por debajo del stock mínimo.
 * Lee la vista `vista_alertas_stock`, que ya clasifica la severidad.
 */
export async function alertasStock({ severidad = null } = {}) {
  if (severidad) {
    return consultar(
      'SELECT * FROM vista_alertas_stock WHERE severidad = ? ORDER BY faltante DESC',
      [severidad],
    );
  }
  return consultar(
    `SELECT * FROM vista_alertas_stock
     ORDER BY FIELD(severidad, 'agotado', 'critico', 'bajo'), faltante DESC`,
  );
}

/** Kardex de un producto, del movimiento más reciente al más antiguo. */
export async function kardex(productoId, limite = 50) {
  return consultar(
    `SELECT m.id, m.tipo, m.cantidad, m.stock_resultante, m.motivo, m.creado_en,
            m.pedido_id, pe.numero AS pedido_numero,
            CONCAT(u.nombre, ' ', u.apellido) AS usuario
     FROM movimientos_inventario m
     LEFT JOIN usuarios u  ON u.id = m.usuario_id
     LEFT JOIN pedidos  pe ON pe.id = m.pedido_id
     WHERE m.producto_id = ?
     ORDER BY m.creado_en DESC, m.id DESC
     LIMIT ${Math.min(Number(limite) || 50, 200)}`,
    [productoId],
  );
}

/** Cifras de cabecera para el panel administrativo. */
export async function resumen() {
  const totales = await consultarUna(`
    SELECT
      COUNT(*)                                        AS referencias,
      COALESCE(SUM(stock), 0)                         AS unidades,
      COALESCE(SUM(stock * precio), 0)                AS valor_inventario,
      SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END)      AS agotados,
      SUM(CASE WHEN stock > 0 AND stock <= stock_minimo THEN 1 ELSE 0 END) AS bajo_minimo
    FROM productos
    WHERE activo = 1
  `);

  const porCategoria = await consultar(`
    SELECT c.nombre AS categoria,
           COUNT(p.id) AS referencias,
           COALESCE(SUM(p.stock), 0) AS unidades
    FROM categorias c
    LEFT JOIN productos p ON p.categoria_id = c.id AND p.activo = 1
    GROUP BY c.id, c.nombre
    ORDER BY unidades DESC
  `);

  return { ...totales, porCategoria };
}
