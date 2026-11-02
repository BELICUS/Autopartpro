/** Comprobante del pedido. */
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../servicios/api.js';
import { pesos, fecha } from '../servicios/formato.js';

export default function DetallePedido() {
  const { id } = useParams();
  const [parametros] = useSearchParams();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/pedidos/${id}`).then(setPedido).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
        <div className="aviso aviso--error">{error}</div>
      </div>
    );
  }
  if (!pedido) return <p className="cargando">Cargando pedido…</p>;

  return (
    <div className="contenedor pedido">
      <div className="aviso aviso--exito">
        <strong>Pedido {pedido.numero} registrado.</strong> Te enviamos la confirmación
        a tu correo.
      </div>

      {parametros.get('sinPasarela') === '1' && (
        <div className="aviso aviso--alerta">
          El pago en línea no está habilitado. Comunícate con nosotros para coordinar
          la transferencia; el pedido queda reservado mientras tanto.
        </div>
      )}

      <div className="pedido__cabecera tarjeta">
        <div>
          <h1>Pedido {pedido.numero}</h1>
          <p>{fecha(pedido.creado_en)}</p>
        </div>
        <span className={`etiqueta etiqueta--${pedido.estado}`}>{pedido.estado}</span>
      </div>

      <div className="tarjeta tabla-envoltura">
        <table className="tabla">
          <thead>
            <tr>
              <th>Repuesto</th>
              <th>Referencia</th>
              <th className="numero">Cantidad</th>
              <th className="numero">Precio</th>
              <th className="numero">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.detalles.map((d) => (
              <tr key={d.id}>
                <td>{d.nombre_producto}</td>
                <td>{d.sku_producto}</td>
                <td className="numero">{d.cantidad}</td>
                <td className="numero">{pesos(d.precio_unitario)}</td>
                <td className="numero">{pesos(d.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pedido__pie">
        <div className="tarjeta">
          <h2>Envío</h2>
          <p>
            {pedido.direccion_envio}<br />
            {pedido.ciudad}<br />
            Tel. {pedido.telefono}
          </p>
        </div>

        <div className="tarjeta">
          <dl className="resumen">
            <div><dt>Subtotal</dt><dd>{pesos(pedido.subtotal)}</dd></div>
            <div><dt>IVA</dt><dd>{pesos(pedido.iva)}</dd></div>
            <div><dt>Envío</dt><dd>{pedido.envio === 0 ? 'Gratis' : pesos(pedido.envio)}</dd></div>
            <div className="resumen__total"><dt>Total</dt><dd>{pesos(pedido.total)}</dd></div>
          </dl>
        </div>
      </div>

      <p><Link to="/mis-pedidos">Ver todos mis pedidos</Link></p>
    </div>
  );
}
