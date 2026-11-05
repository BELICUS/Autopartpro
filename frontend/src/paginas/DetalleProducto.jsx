/** Ficha del repuesto con su tabla de compatibilidades. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../servicios/api.js';
import { pesos, descuento, urlImagen } from '../servicios/formato.js';
import { useCarrito } from '../contexto/CarritoContexto.jsx';

export default function DetalleProducto() {
  const { id } = useParams();
  const { agregar } = useCarrito();

  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  useEffect(() => {
    setCargando(true);
    api
      .get(`/productos/${id}`)
      .then(setProducto)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <p className="cargando">Cargando producto…</p>;
  if (error) {
    return (
      <div className="contenedor" style={{ padding: '2rem 1.25rem' }}>
        <div className="aviso aviso--error">{error}</div>
        <Link to="/">Volver al catálogo</Link>
      </div>
    );
  }

  const rebaja = descuento(producto.precio, producto.precio_oferta);
  const agotado = producto.stock <= 0;

  function alAgregar() {
    agregar(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 2500);
  }

  return (
    <div className="contenedor detalle">
      <nav className="miga">
        <Link to="/">Catálogo</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/?categoria=${producto.categoria_id}`}>{producto.categoria}</Link>
        <span aria-hidden="true"> / </span>
        <span>{producto.nombre}</span>
      </nav>

      <div className="detalle__principal">
        <div className="detalle__imagen">
          {producto.imagen ? (
            <img src={urlImagen(producto.imagen)} alt={producto.nombre} width="520" height="520" />
          ) : (
            <div className="producto__sinimagen" aria-hidden="true" />
          )}
        </div>

        <div className="detalle__info">
          <span className="producto__categoria">{producto.categoria}</span>
          <h1>{producto.nombre}</h1>

          <dl className="detalle__datos">
            <div>
              <dt>Referencia</dt>
              <dd>{producto.sku}</dd>
            </div>
            {producto.fabricante && (
              <div>
                <dt>Fabricante</dt>
                <dd>{producto.fabricante}</dd>
              </div>
            )}
            <div>
              <dt>Existencias</dt>
              <dd>{agotado ? 'Agotado' : `${producto.stock} unidades`}</dd>
            </div>
          </dl>

          <div className="detalle__precio">
            {rebaja > 0 && (
              <>
                <s>{pesos(producto.precio)}</s>
                <span className="etiqueta etiqueta--oferta">-{rebaja}%</span>
              </>
            )}
            <strong>{pesos(producto.precio_final)}</strong>
            <small>IVA incluido al finalizar la compra</small>
          </div>

          <div className="detalle__compra">
            <div className="campo campo--enlinea">
              <label htmlFor="cantidad">Cantidad</label>
              <input
                id="cantidad"
                type="number"
                min="1"
                max={Math.max(producto.stock, 1)}
                value={cantidad}
                disabled={agotado}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <button type="button" className="boton" disabled={agotado} onClick={alAgregar}>
              {agotado ? 'Sin existencias' : 'Agregar al carrito'}
            </button>
          </div>

          {agregado && (
            <div className="aviso aviso--exito">
              Agregado al carrito. <Link to="/carrito">Ver carrito</Link>
            </div>
          )}

          {producto.descripcion && (
            <section className="detalle__descripcion">
              <h2>Descripción</h2>
              <p>{producto.descripcion}</p>
            </section>
          )}
        </div>
      </div>

      <section className="detalle__compatibilidad">
        <h2>Vehículos compatibles</h2>
        {producto.compatibilidades?.length > 0 ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Años</th>
                  <th>Motor</th>
                  <th>Combustible</th>
                </tr>
              </thead>
              <tbody>
                {producto.compatibilidades.map((c) => (
                  <tr key={c.id}>
                    <td>{c.marca}</td>
                    <td>{c.modelo}</td>
                    <td className="numero">{c.anio_inicio} – {c.anio_fin}</td>
                    <td>{c.motor}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.combustible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Este repuesto aún no tiene compatibilidades registradas.</p>
        )}
      </section>
    </div>
  );
}
