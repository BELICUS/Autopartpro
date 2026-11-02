/** Carrito de compras. Los totales son estimados; el definitivo lo calcula la API. */
import { Link, useNavigate } from 'react-router-dom';
import { useCarrito } from '../contexto/CarritoContexto.jsx';
import { useSesion } from '../contexto/SesionContexto.jsx';
import { pesos } from '../servicios/formato.js';

export default function Carrito() {
  const { items, cambiarCantidad, quitar, vaciar, resumen } = useCarrito();
  const { usuario } = useSesion();
  const navegar = useNavigate();

  if (items.length === 0) {
    return (
      <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
        <h1>Tu carrito</h1>
        <div className="vacio">
          <p><strong>Todavía no has agregado repuestos.</strong></p>
          <p><Link to="/">Explorar el catálogo</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="contenedor carrito">
      <h1>Tu carrito</h1>

      <div className="carrito__columnas">
        <div className="tabla-envoltura tarjeta">
          <table className="tabla">
            <thead>
              <tr>
                <th>Repuesto</th>
                <th className="numero">Precio</th>
                <th>Cantidad</th>
                <th className="numero">Subtotal</th>
                <th><span className="sr-solo">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="carrito__producto">
                      {i.imagen && (
                        <img src={`/imagenes/${i.imagen}`} alt="" width="52" height="52" />
                      )}
                      <div>
                        <Link to={`/producto/${i.id}`}>{i.nombre}</Link>
                        <small>{i.sku}</small>
                      </div>
                    </div>
                  </td>
                  <td className="numero">{pesos(i.precio)}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      max={i.stock}
                      value={i.cantidad}
                      onChange={(e) => cambiarCantidad(i.id, Number(e.target.value))}
                      style={{ width: '4.5rem' }}
                      aria-label={`Cantidad de ${i.nombre}`}
                    />
                  </td>
                  <td className="numero">{pesos(i.precio * i.cantidad)}</td>
                  <td>
                    <button
                      type="button"
                      className="boton boton--secundario boton--pequeno"
                      onClick={() => quitar(i.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="carrito__resumen tarjeta">
          <h2>Resumen</h2>
          <dl className="resumen">
            <div><dt>Subtotal</dt><dd>{pesos(resumen.subtotal)}</dd></div>
            <div><dt>IVA (19%)</dt><dd>{pesos(resumen.iva)}</dd></div>
            <div>
              <dt>Envío</dt>
              <dd>{resumen.envio === 0 ? 'Gratis' : pesos(resumen.envio)}</dd>
            </div>
            <div className="resumen__total"><dt>Total</dt><dd>{pesos(resumen.total)}</dd></div>
          </dl>

          {resumen.envio > 0 && (
            <p className="resumen__nota">
              Agrega {pesos(200000 - resumen.subtotal)} más y el envío es gratis.
            </p>
          )}

          <button type="button" className="boton boton--bloque" onClick={() => navegar('/checkout')}>
            {usuario ? 'Continuar al pago' : 'Ingresar y pagar'}
          </button>
          <button type="button" className="boton boton--secundario boton--bloque" onClick={vaciar}>
            Vaciar carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
