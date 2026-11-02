/**
 * Página a la que Wompi devuelve al comprador.
 *
 * Consulta el estado real de la transacción contra la API en vez de confiar
 * en los parámetros de la URL, que el usuario podría editar a mano.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../servicios/api.js';
import { pesos } from '../servicios/formato.js';

const MENSAJES = {
  APPROVED: { clase: 'exito', titulo: 'Pago aprobado', texto: 'Ya estamos preparando tu pedido.' },
  DECLINED: { clase: 'error', titulo: 'Pago rechazado', texto: 'El banco no autorizó la transacción. Puedes intentar con otro medio de pago.' },
  ERROR:    { clase: 'error', titulo: 'Error en el pago', texto: 'Ocurrió un problema al procesar la transacción.' },
  VOIDED:   { clase: 'error', titulo: 'Pago anulado', texto: 'La transacción fue anulada.' },
  PENDING:  { clase: 'alerta', titulo: 'Pago pendiente', texto: 'Estamos esperando la confirmación del banco. Puede tardar unos minutos.' },
};

export default function ResultadoPago() {
  const [parametros] = useSearchParams();
  const idTransaccion = parametros.get('id');

  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!idTransaccion) {
      setError('La pasarela no devolvió el identificador de la transacción.');
      return;
    }
    api
      .get(`/pagos/verificar?id=${encodeURIComponent(idTransaccion)}`)
      .then(setResultado)
      .catch((e) => setError(e.message));
  }, [idTransaccion]);

  if (error) {
    return (
      <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
        <div className="aviso aviso--error">{error}</div>
        <Link to="/mis-pedidos">Ver mis pedidos</Link>
      </div>
    );
  }

  if (!resultado) return <p className="cargando">Verificando el pago…</p>;

  const info = MENSAJES[resultado.estadoTransaccion] ?? MENSAJES.PENDING;
  const pedido = resultado.pedido;

  return (
    <div className="contenedor" style={{ padding: '2rem 1.25rem', maxWidth: '640px' }}>
      <div className={`aviso aviso--${info.clase}`}>
        <strong>{info.titulo}.</strong> {info.texto}
      </div>

      <div className="tarjeta">
        <h1>Pedido {pedido.numero}</h1>
        <dl className="resumen">
          <div><dt>Estado</dt><dd>{pedido.estado}</dd></div>
          <div className="resumen__total"><dt>Total</dt><dd>{pesos(pedido.total)}</dd></div>
        </dl>
        <p>
          <Link to={`/pedido/${pedido.id}`}>Ver el detalle del pedido</Link>
        </p>
      </div>
    </div>
  );
}
