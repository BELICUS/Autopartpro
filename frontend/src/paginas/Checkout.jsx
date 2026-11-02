/**
 * Checkout: datos de envío, creación del pedido y salto a la pasarela.
 *
 * El flujo tiene dos pasos deliberadamente separados:
 *   1. Crear el pedido en la API. Esto reserva el stock y fija el total
 *      calculado en el servidor, no en el navegador.
 *   2. Pedir a la API los datos firmados y redirigir a Wompi.
 *
 * Si el usuario abandona entre ambos pasos, queda un pedido pendiente que
 * el administrador puede cancelar para liberar las unidades.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../servicios/api.js';
import { pesos } from '../servicios/formato.js';
import { useCarrito } from '../contexto/CarritoContexto.jsx';
import { useSesion } from '../contexto/SesionContexto.jsx';

export default function Checkout() {
  const { items, resumen, vaciar } = useCarrito();
  const { usuario } = useSesion();
  const navegar = useNavigate();

  const [envio, setEnvio] = useState({ direccion: '', ciudad: '', telefono: '' });
  const [pasarela, setPasarela] = useState(null);
  const [transferencia, setTransferencia] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Prellenar con los datos del perfil evita que el cliente los reescriba.
  useEffect(() => {
    if (usuario) {
      setEnvio({
        direccion: usuario.direccion ?? '',
        ciudad: usuario.ciudad ?? '',
        telefono: usuario.telefono ?? '',
      });
    }
  }, [usuario]);

  useEffect(() => {
    api.get('/pagos/estado').then(setPasarela).catch(() => setPasarela(null));
    api
      .get('/pagos/transferencia')
      .then(setTransferencia)
      .catch(() => setTransferencia(null));
  }, []);

  if (items.length === 0) {
    return (
      <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
        <div className="vacio">
          <p><strong>El carrito está vacío.</strong></p>
          <p><Link to="/">Ir al catálogo</Link></p>
        </div>
      </div>
    );
  }

  async function confirmar(evento) {
    evento.preventDefault();
    setError(null);
    setProcesando(true);

    try {
      // Paso 1: el pedido. El servidor relee precios y descuenta stock.
      const pedido = await api.post('/pedidos', {
        items: items.map((i) => ({ productoId: i.id, cantidad: i.cantidad })),
        ...envio,
      });

      // Paso 2: si no hay pasarela configurada, el pedido queda pendiente
      // de pago por transferencia y se informa al cliente.
      if (!pasarela?.configurada) {
        vaciar();
        navegar(`/pedido/${pedido.id}?sinPasarela=1`, { replace: true });
        return;
      }

      const pago = await api.post(`/pagos/iniciar/${pedido.id}`);
      vaciar();
      redirigirAWompi(pago);
    } catch (e) {
      setError(e.detalles?.map((d) => d.mensaje).join('. ') ?? e.message);
      setProcesando(false);
    }
  }

  /**
   * El Checkout Web de Wompi se abre enviando un formulario por POST.
   * Se construye en memoria y se envía; no queda nada en el DOM.
   */
  function redirigirAWompi(pago) {
    const formulario = document.createElement('form');
    formulario.method = 'GET';
    formulario.action = pasarela.urlCheckout;

    const campos = {
      'public-key': pago.publicKey,
      currency: pago.currency,
      'amount-in-cents': pago.amountInCents,
      reference: pago.reference,
      'signature:integrity': pago.signature,
      'redirect-url': pago.redirectUrl,
      'customer-data:email': pago.customerData.email,
      'customer-data:full-name': pago.customerData.fullName,
      'customer-data:phone-number': pago.customerData.phoneNumber,
      'customer-data:legal-id': pago.customerData.legalId,
      'customer-data:legal-id-type': pago.customerData.legalIdType,
    };

    for (const [nombre, valor] of Object.entries(campos)) {
      if (valor === '' || valor == null) continue;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = nombre;
      input.value = String(valor);
      formulario.appendChild(input);
    }

    document.body.appendChild(formulario);
    formulario.submit();
  }

  return (
    <div className="contenedor checkout">
      <h1>Finalizar compra</h1>

      {pasarela && !pasarela.configurada && transferencia?.disponible && (
        <div className="aviso aviso--info">
          <strong>Pago por transferencia bancaria.</strong> Al confirmar verás los
          datos de la cuenta para transferir. El pedido queda reservado y se confirma
          en cuanto se verifica el ingreso.
        </div>
      )}

      {pasarela && !pasarela.configurada && !transferencia?.disponible && (
        <div className="aviso aviso--alerta">
          <strong>Todavía no hay un método de pago habilitado.</strong> Tu pedido se
          registrará como pendiente; comunícate con nosotros para coordinar el pago.
        </div>
      )}

      {pasarela?.configurada && !pasarela.esReal && (
        <div className="aviso aviso--info">
          <strong>Entorno de pruebas.</strong> La pasarela está en modo sandbox: ningún
          cobro es real y no se debita dinero de ninguna cuenta.
        </div>
      )}

      {error && <div className="aviso aviso--error">{error}</div>}

      <div className="checkout__columnas">
        <form className="tarjeta" onSubmit={confirmar}>
          <h2>Datos de envío</h2>

          <div className="campo">
            <label htmlFor="direccion">Dirección</label>
            <input
              id="direccion" required placeholder="Calle 72 # 10-34, apto 302"
              value={envio.direccion}
              onChange={(e) => setEnvio({ ...envio, direccion: e.target.value })}
            />
          </div>

          <div className="campo">
            <label htmlFor="ciudad">Ciudad</label>
            <input
              id="ciudad" required placeholder="Bogotá"
              value={envio.ciudad}
              onChange={(e) => setEnvio({ ...envio, ciudad: e.target.value })}
            />
          </div>

          <div className="campo">
            <label htmlFor="telefono">Teléfono de contacto</label>
            <input
              id="telefono" type="tel" required placeholder="3001234567"
              value={envio.telefono}
              onChange={(e) => setEnvio({ ...envio, telefono: e.target.value })}
            />
          </div>

          <button type="submit" className="boton boton--bloque" disabled={procesando}>
            {procesando
              ? 'Procesando…'
              : pasarela?.configurada
                ? `Pagar ${pesos(resumen.total)}`
                : 'Confirmar pedido'}
          </button>
        </form>

        <aside className="tarjeta checkout__resumen">
          <h2>Tu pedido</h2>
          <ul className="checkout__items">
            {items.map((i) => (
              <li key={i.id}>
                <span>{i.cantidad} × {i.nombre}</span>
                <strong>{pesos(i.precio * i.cantidad)}</strong>
              </li>
            ))}
          </ul>

          <dl className="resumen">
            <div><dt>Subtotal</dt><dd>{pesos(resumen.subtotal)}</dd></div>
            <div><dt>IVA (19%)</dt><dd>{pesos(resumen.iva)}</dd></div>
            <div>
              <dt>Envío</dt>
              <dd>{resumen.envio === 0 ? 'Gratis' : pesos(resumen.envio)}</dd>
            </div>
            <div className="resumen__total"><dt>Total</dt><dd>{pesos(resumen.total)}</dd></div>
          </dl>

          <p className="resumen__nota">
            El total definitivo lo calcula el servidor al confirmar el pedido.
          </p>
        </aside>
      </div>
    </div>
  );
}
