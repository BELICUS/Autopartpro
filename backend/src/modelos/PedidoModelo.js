/**
 * Modelo Pedido — creación de la venta, consulta y cambios de estado.
 *
 * Crear un pedido toca cuatro tablas y debe ser atómico: si falla el
 * descuento de stock del tercer artículo, no puede quedar un pedido a medias
 * con los dos primeros ya descontados. De ahí que todo viva dentro de
 * `enTransaccion`.
 */
import { consultar, consultarUna, enTransaccion } from '../config/basedatos.js';
import { registrarMovimiento } from './InventarioModelo.js';

/**
 * IVA y envío, configurables por variable de entorno.
 *
 * Por defecto son los valores reales de Colombia (19% de IVA, envío de
 * $15.000 bajo $200.000). Se pueden poner en 0 desde el .env — por ejemplo
 * para una prueba de pasarela donde el monto final debe ser exacto y
 * pequeño, sin que el IVA y el envío lo disparen:
 *
 *   TASA_IVA=0
 *   COSTO_ENVIO=0
 */
const TASA_IVA = Number(process.env.TASA_IVA ?? 0.19);
const UMBRAL_ENVIO_GRATIS = Number(process.env.UMBRAL_ENVIO_GRATIS ?? 200000);
const COSTO_ENVIO = Number(process.env.COSTO_ENVIO ?? 15000);

/**
 * Número consecutivo visible: APP-2026-00014.
 * Se calcula dentro de la transacción para que dos pedidos simultáneos no
 * obtengan el mismo número.
 */
async function siguienteNumero(conexion) {
  const anio = new Date().getFullYear();
  const [filas] = await conexion.execute(
    `SELECT COUNT(*) AS total FROM pedidos WHERE numero LIKE ?`,
    [`APP-${anio}-%`],
  );
  const consecutivo = String((filas[0]?.total ?? 0) + 1).padStart(5, '0');
  return `APP-${anio}-${consecutivo}`;
}

/**
 * Crea un pedido a partir de las líneas del carrito.
 *
 * Los precios NO se toman del cliente: se releen de la base dentro de la
 * transacción. Confiar en el precio que manda el navegador permitiría a
 * cualquiera comprar una caja de cambios por mil pesos editando la petición.
 *
 * @param {object} datos
 * @param {number} datos.usuarioId
 * @param {Array<{productoId:number, cantidad:number}>} datos.items
 * @param {object} datos.envio  direccion, ciudad, telefono
 */
export async function crear(datos) {
  if (!Array.isArray(datos.items) || datos.items.length === 0) {
    const error = new Error('El pedido no tiene artículos');
    error.codigoHttp = 400;
    throw error;
  }

  return enTransaccion(async (conexion) => {
    const lineas = [];
    let subtotal = 0;

    for (const item of datos.items) {
      const [filas] = await conexion.execute(
        `SELECT id, sku, nombre, precio, precio_oferta, stock, activo
         FROM productos WHERE id = ?`,
        [item.productoId],
      );

      if (filas.length === 0 || filas[0].activo !== 1) {
        const error = new Error(`El producto ${item.productoId} no está disponible`);
        error.codigoHttp = 404;
        throw error;
      }

      const producto = filas[0];
      const cantidad = Number(item.cantidad);

      if (!Number.isInteger(cantidad) || cantidad < 1) {
        const error = new Error(`Cantidad no válida para "${producto.nombre}"`);
        error.codigoHttp = 400;
        throw error;
      }

      const precioUnitario = Number(producto.precio_oferta ?? producto.precio);
      const subtotalLinea = precioUnitario * cantidad;
      subtotal += subtotalLinea;

      lineas.push({
        productoId: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        cantidad,
        precioUnitario,
        subtotal: subtotalLinea,
      });
    }

    const iva = Math.round(subtotal * TASA_IVA);
    const envio = subtotal >= UMBRAL_ENVIO_GRATIS ? 0 : COSTO_ENVIO;
    const total = subtotal + iva + envio;

    const numero = await siguienteNumero(conexion);

    const [resultado] = await conexion.execute(
      `INSERT INTO pedidos
         (numero, usuario_id, estado, subtotal, iva, envio, total,
          direccion_envio, ciudad, telefono)
       VALUES (?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        datos.usuarioId,
        subtotal,
        iva,
        envio,
        total,
        datos.envio.direccion,
        datos.envio.ciudad,
        datos.envio.telefono,
      ],
    );

    const pedidoId = resultado.insertId;

    for (const linea of lineas) {
      await conexion.execute(
        `INSERT INTO pedido_detalles
           (pedido_id, producto_id, nombre_producto, sku_producto,
            cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoId,
          linea.productoId,
          linea.nombre,
          linea.sku,
          linea.cantidad,
          linea.precioUnitario,
          linea.subtotal,
        ],
      );

      // El stock se reserva al crear el pedido, no al pagarlo: así dos
      // clientes no pueden comprometer la misma última unidad mientras
      // uno de ellos está en la pasarela.
      await registrarMovimiento(
        {
          productoId: linea.productoId,
          tipo: 'salida',
          cantidad: linea.cantidad,
          motivo: `Reserva por pedido ${numero}`,
          usuarioId: datos.usuarioId,
          pedidoId,
        },
        conexion,
      );
    }

    return { id: pedidoId, numero, subtotal, iva, envio, total };
  });
}

export async function obtenerPorId(id) {
  const pedido = await consultarUna(
    `SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS cliente, u.email AS cliente_email
     FROM pedidos p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.id = ?`,
    [id],
  );
  if (!pedido) return null;

  pedido.detalles = await consultar(
    'SELECT * FROM pedido_detalles WHERE pedido_id = ? ORDER BY id',
    [id],
  );
  return pedido;
}

export async function obtenerPorReferencia(referencia) {
  return consultarUna('SELECT * FROM pedidos WHERE referencia_pago = ?', [referencia]);
}

export async function listarPorUsuario(usuarioId) {
  return consultar(
    `SELECT id, numero, estado, total, metodo_pago, creado_en
     FROM pedidos WHERE usuario_id = ?
     ORDER BY creado_en DESC`,
    [usuarioId],
  );
}

export async function listarTodos({ estado = null } = {}) {
  const donde = estado ? 'WHERE p.estado = ?' : '';
  const parametros = estado ? [estado] : [];

  return consultar(
    `SELECT p.id, p.numero, p.estado, p.total, p.metodo_pago, p.creado_en,
            CONCAT(u.nombre, ' ', u.apellido) AS cliente, u.email AS cliente_email
     FROM pedidos p
     JOIN usuarios u ON u.id = p.usuario_id
     ${donde}
     ORDER BY p.creado_en DESC`,
    parametros,
  );
}

/** Guarda la referencia antes de mandar al cliente a la pasarela. */
export async function asignarReferenciaPago(id, referencia, metodo = 'wompi') {
  const resultado = await consultar(
    'UPDATE pedidos SET referencia_pago = ?, metodo_pago = ? WHERE id = ?',
    [referencia, metodo, id],
  );
  return resultado.affectedRows > 0;
}

/**
 * Cambia el estado del pedido. Si se cancela uno que tenía stock reservado,
 * las unidades regresan al inventario.
 */
export async function cambiarEstado(id, nuevoEstado, { transaccionId = null } = {}) {
  return enTransaccion(async (conexion) => {
    const [filas] = await conexion.execute(
      'SELECT id, numero, estado, usuario_id FROM pedidos WHERE id = ? FOR UPDATE',
      [id],
    );
    if (filas.length === 0) {
      const error = new Error('El pedido no existe');
      error.codigoHttp = 404;
      throw error;
    }

    const pedido = filas[0];
    if (pedido.estado === nuevoEstado) return false;

    await conexion.execute(
      'UPDATE pedidos SET estado = ?, transaccion_id = COALESCE(?, transaccion_id) WHERE id = ?',
      [nuevoEstado, transaccionId, id],
    );

    const seCancela = nuevoEstado === 'cancelado';
    const teniaReserva = pedido.estado !== 'cancelado';

    if (seCancela && teniaReserva) {
      const [detalles] = await conexion.execute(
        'SELECT producto_id, cantidad FROM pedido_detalles WHERE pedido_id = ?',
        [id],
      );
      for (const detalle of detalles) {
        await registrarMovimiento(
          {
            productoId: detalle.producto_id,
            tipo: 'entrada',
            cantidad: detalle.cantidad,
            motivo: `Devolución por cancelación del pedido ${pedido.numero}`,
            usuarioId: pedido.usuario_id,
            pedidoId: id,
          },
          conexion,
        );
      }
    }

    return true;
  });
}
