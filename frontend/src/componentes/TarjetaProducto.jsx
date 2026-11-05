/** Tarjeta de producto del catálogo. */
import { Link } from 'react-router-dom';
import { pesos, descuento, urlImagen } from '../servicios/formato.js';
import { useCarrito } from '../contexto/CarritoContexto.jsx';

export default function TarjetaProducto({ producto }) {
  const { agregar } = useCarrito();
  const rebaja = descuento(producto.precio, producto.precio_oferta);
  const agotado = producto.stock <= 0;
  const ultimas = !agotado && producto.stock <= producto.stock_minimo;

  return (
    <article className="producto">
      <Link to={`/producto/${producto.id}`} className="producto__imagen">
        {producto.imagen ? (
          <img
            src={urlImagen(producto.imagen)}
            alt={producto.nombre}
            loading="lazy"
            width="320"
            height="320"
          />
        ) : (
          <div className="producto__sinimagen" aria-hidden="true" />
        )}
        {rebaja > 0 && <span className="producto__descuento">-{rebaja}%</span>}
      </Link>

      <div className="producto__cuerpo">
        <span className="producto__categoria">{producto.categoria}</span>
        <h3 className="producto__nombre">
          <Link to={`/producto/${producto.id}`}>{producto.nombre}</Link>
        </h3>
        <p className="producto__meta">
          {producto.fabricante && <span>{producto.fabricante}</span>}
          <span className="producto__sku">{producto.sku}</span>
        </p>

        <div className="producto__precio">
          {rebaja > 0 && <s>{pesos(producto.precio)}</s>}
          <strong>{pesos(producto.precio_final)}</strong>
        </div>

        {agotado ? (
          <p className="producto__stock producto__stock--agotado">Agotado</p>
        ) : ultimas ? (
          <p className="producto__stock producto__stock--bajo">
            Quedan {producto.stock} unidades
          </p>
        ) : (
          <p className="producto__stock">Disponible</p>
        )}

        <button
          type="button"
          className="boton boton--bloque"
          disabled={agotado}
          onClick={() => agregar(producto)}
        >
          {agotado ? 'Sin existencias' : 'Agregar al carrito'}
        </button>
      </div>
    </article>
  );
}
