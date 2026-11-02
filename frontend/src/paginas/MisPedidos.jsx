/** Historial de pedidos del cliente. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../servicios/api.js';
import { pesos, fecha } from '../servicios/formato.js';

export default function MisPedidos() {
  const [pedidos, setPedidos] = useState(null);

  useEffect(() => {
    api.get('/pedidos/mios').then(setPedidos).catch(() => setPedidos([]));
  }, []);

  if (!pedidos) return <p className="cargando">Cargando pedidos…</p>;

  return (
    <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
      <h1>Mis pedidos</h1>

      {pedidos.length === 0 ? (
        <div className="vacio">
          <p><strong>Todavía no has hecho pedidos.</strong></p>
          <p><Link to="/">Ir al catálogo</Link></p>
        </div>
      ) : (
        <div className="tarjeta tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th className="numero">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.numero}</strong></td>
                  <td>{fecha(p.creado_en)}</td>
                  <td><span className={`etiqueta etiqueta--${p.estado}`}>{p.estado}</span></td>
                  <td className="numero">{pesos(p.total)}</td>
                  <td><Link to={`/pedido/${p.id}`}>Ver detalle</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
