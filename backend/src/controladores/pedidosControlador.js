/**
 * Controlador de pedidos y pagos.
 *
 * El flujo de pago tiene dos vías de retorno y hay que atender las dos:
 *   · La redirección del comprador  → `verificarPago`, inmediata pero frágil
 *     (el usuario puede cerrar el navegador antes de volver).
 *   · El webhook de la pasarela     → `webhookWompi`, la fuente de verdad.
 */
import * as Pedido from '../modelos/PedidoModelo.js';
import {
  prepararPago,
  generarReferencia,
  estadoPasarela,
  verificarFirmaEvento,
  consultarTransaccion,
  estadoPedidoSegunTransaccion,
} from '../servicios/wompiServicio.js';
import * as Usuario from '../modelos/UsuarioModelo.js';

/** POST /api/pedidos — crea el pedido y reserva el stock */
export async function crear(req, res) {
  const pedido = await Pedido.crear({
    usuarioId: req.usuario.id,
    items: req.body.items,
    envio: {
      direccion: req.body.direccion,
      ciudad: req.body.ciudad,
      telefono: req.body.telefono,
    },
  });

  res.status(201).json(await Pedido.obtenerPorId(pedido.id));
}

/** GET /api/pedidos/mios */
export async function mios(req, res) {
  res.json(await Pedido.listarPorUsuario(req.usuario.id));
}

/** GET /api/pedidos/:id */
export async function obtener(req, res) {
  const pedido = await Pedido.obtenerPorId(Number.parseInt(req.params.id, 10));

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  // Un cliente solo ve lo suyo; el administrador ve todo.
  if (req.usuario.rol !== 'administrador' && pedido.usuario_id !== req.usuario.id) {
    return res.status(403).json({ error: 'Este pedido no te pertenece' });
  }

  return res.json(pedido);
}

/** GET /api/pedidos — listado administrativo */
export async function listar(req, res) {
  res.json(await Pedido.listarTodos({ estado: req.query.estado ?? null }));
}

/** PATCH /api/pedidos/:id/estado — administrativo */
export async function cambiarEstado(req, res) {
  const estados = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];
  if (!estados.includes(req.body.estado)) {
    return res.status(422).json({ error: `Estado no válido. Valores: ${estados.join(', ')}` });
  }

  await Pedido.cambiarEstado(Number.parseInt(req.params.id, 10), req.body.estado);
  return res.json(await Pedido.obtenerPorId(Number.parseInt(req.params.id, 10)));
}

/** GET /api/pagos/estado — qué pasarela hay y en qué modo */
export async function estadoDePasarela(_req, res) {
  res.json(estadoPasarela());
}

/**
 * POST /api/pagos/iniciar/:pedidoId
 * Genera la referencia y devuelve los datos firmados para abrir el checkout.
 */
export async function iniciarPago(req, res) {
  const pedidoId = Number.parseInt(req.params.pedidoId, 10);
  const pedido = await Pedido.obtenerPorId(pedidoId);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  if (pedido.usuario_id !== req.usuario.id) {
    return res.status(403).json({ error: 'Este pedido no te pertenece' });
  }
  if (pedido.estado !== 'pendiente') {
    return res.status(409).json({ error: `El pedido ya está ${pedido.estado}` });
  }

  // Si ya tenía referencia se reutiliza: regenerarla dejaría huérfana la
  // transacción que el cliente quizá ya abrió en la pasarela.
  const referencia = pedido.referencia_pago ?? generarReferencia(pedido.numero);
  if (!pedido.referencia_pago) {
    await Pedido.asignarReferenciaPago(pedidoId, referencia, 'wompi');
  }

  const cliente = await Usuario.obtenerPorId(req.usuario.id);
  const datosPago = prepararPago({ pedido: { ...pedido, referencia_pago: referencia }, cliente });

  return res.json({ pedido: { id: pedido.id, numero: pedido.numero, total: pedido.total }, ...datosPago });
}

/**
 * GET /api/pagos/verificar?id=<transaccion>
 * Lo llama el frontend cuando la pasarela devuelve al comprador.
 */
export async function verificarPago(req, res) {
  const idTransaccion = req.query.id;
  if (!idTransaccion) {
    return res.status(400).json({ error: 'Falta el id de la transacción' });
  }

  const transaccion = await consultarTransaccion(idTransaccion);
  const pedido = await Pedido.obtenerPorReferencia(transaccion.reference);

  if (!pedido) {
    return res.status(404).json({ error: 'No hay un pedido con esa referencia' });
  }

  const nuevoEstado = estadoPedidoSegunTransaccion(transaccion.status);
  if (nuevoEstado !== pedido.estado) {
    await Pedido.cambiarEstado(pedido.id, nuevoEstado, { transaccionId: transaccion.id });
  }

  return res.json({
    estadoTransaccion: transaccion.status,
    pedido: await Pedido.obtenerPorId(pedido.id),
  });
}

/**
 * POST /api/pagos/webhook
 * Endpoint público que llama Wompi. Siempre responde 200: si devolviera
 * error, Wompi reintentaría indefinidamente.
 */
export async function webhookWompi(req, res) {
  try {
    if (!verificarFirmaEvento(req.body)) {
      // Firma inválida: el evento no viene de Wompi. Se descarta en
      // silencio, pero queda registrado para auditoría.
      console.warn('[webhook] firma inválida, evento descartado');
      return res.status(200).json({ recibido: true });
    }

    const transaccion = req.body?.data?.transaction;
    if (!transaccion?.reference) {
      return res.status(200).json({ recibido: true });
    }

    const pedido = await Pedido.obtenerPorReferencia(transaccion.reference);
    if (pedido) {
      const nuevoEstado = estadoPedidoSegunTransaccion(transaccion.status);
      if (nuevoEstado !== pedido.estado) {
        await Pedido.cambiarEstado(pedido.id, nuevoEstado, { transaccionId: transaccion.id });
        console.log(`[webhook] pedido ${pedido.numero} → ${nuevoEstado}`);
      }
    }

    return res.status(200).json({ recibido: true });
  } catch (error) {
    console.error('[webhook] error procesando evento:', error.message);
    return res.status(200).json({ recibido: true });
  }
}
