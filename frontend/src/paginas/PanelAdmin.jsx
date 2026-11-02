/**
 * Panel administrativo: resumen de inventario, alertas de stock mínimo,
 * registro de movimientos y gestión de pedidos.
 *
 * Es la cara visible del requerimiento "módulo de inventario con alertas de
 * stock mínimo": las alertas se leen de la vista `vista_alertas_stock`, que
 * ya clasifica cada producto como agotado, crítico o bajo.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../servicios/api.js';
import { pesos, fecha } from '../servicios/formato.js';

const PESTANAS = [
  { id: 'inventario', etiqueta: 'Inventario' },
  { id: 'pedidos', etiqueta: 'Pedidos' },
];

const ESTADOS_PEDIDO = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];

export default function PanelAdmin() {
  const [pestana, setPestana] = useState('inventario');

  return (
    <div className="contenedor panel">
      <h1>Panel administrativo</h1>

      <nav className="panel__pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={pestana === p.id ? 'activa' : ''}
            onClick={() => setPestana(p.id)}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      {pestana === 'inventario' ? <Inventario /> : <Pedidos />}
    </div>
  );
}

/* ------------------------------------------------------------ inventario -- */

function Inventario() {
  const [resumen, setResumen] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState(null);
  const [productoKardex, setProductoKardex] = useState(null);

  const cargar = useCallback(() => {
    Promise.all([api.get('/inventario/resumen'), api.get('/inventario/alertas')])
      .then(([r, a]) => {
        setResumen(r);
        setAlertas(a);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);

  if (error) return <div className="aviso aviso--error">{error}</div>;
  if (!resumen) return <p className="cargando">Cargando inventario…</p>;

  return (
    <>
      <section className="panel__cifras">
        <Cifra titulo="Referencias activas" valor={resumen.referencias} />
        <Cifra titulo="Unidades en bodega" valor={resumen.unidades.toLocaleString('es-CO')} />
        <Cifra titulo="Valor del inventario" valor={pesos(resumen.valor_inventario)} />
        <Cifra
          titulo="Bajo mínimo"
          valor={resumen.bajo_minimo}
          tono={resumen.bajo_minimo > 0 ? 'alerta' : null}
        />
        <Cifra
          titulo="Agotados"
          valor={resumen.agotados}
          tono={resumen.agotados > 0 ? 'peligro' : null}
        />
      </section>

      <section className="tarjeta">
        <div className="panel__encabezado">
          <h2>Alertas de stock</h2>
          <button type="button" className="boton boton--secundario boton--pequeno" onClick={cargar}>
            Actualizar
          </button>
        </div>

        {alertas.length === 0 ? (
          <div className="aviso aviso--exito" style={{ marginBottom: 0 }}>
            Ninguna referencia está por debajo de su stock mínimo.
          </div>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Severidad</th>
                  <th>Referencia</th>
                  <th>Repuesto</th>
                  <th>Categoría</th>
                  <th>Ubicación</th>
                  <th className="numero">Stock</th>
                  <th className="numero">Mínimo</th>
                  <th className="numero">Faltante</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr key={a.id}>
                    <td><span className={`etiqueta etiqueta--${a.severidad}`}>{a.severidad}</span></td>
                    <td>{a.sku}</td>
                    <td>{a.nombre}</td>
                    <td>{a.categoria}</td>
                    <td>{a.ubicacion_bodega ?? '—'}</td>
                    <td className="numero"><strong>{a.stock}</strong></td>
                    <td className="numero">{a.stock_minimo}</td>
                    <td className="numero">{a.faltante}</td>
                    <td>
                      <button
                        type="button"
                        className="boton boton--pequeno"
                        onClick={() => setProductoKardex(a)}
                      >
                        Reabastecer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2>Inventario por categoría</h2>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Categoría</th>
                <th className="numero">Referencias</th>
                <th className="numero">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porCategoria.map((c) => (
                <tr key={c.categoria}>
                  <td>{c.categoria}</td>
                  <td className="numero">{c.referencias}</td>
                  <td className="numero">{c.unidades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {productoKardex && (
        <DialogoMovimiento
          producto={productoKardex}
          onCerrar={() => setProductoKardex(null)}
          onGuardado={() => {
            setProductoKardex(null);
            cargar();
          }}
        />
      )}
    </>
  );
}

function Cifra({ titulo, valor, tono }) {
  return (
    <div className={`cifra ${tono ? `cifra--${tono}` : ''}`}>
      <span className="cifra__titulo">{titulo}</span>
      <strong className="cifra__valor">{valor}</strong>
    </div>
  );
}

/* -------------------------------------------------- diálogo de movimiento -- */

function DialogoMovimiento({ producto, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState(producto.faltante > 0 ? producto.faltante : 1);
  const [motivo, setMotivo] = useState('Reabastecimiento de proveedor');
  const [kardex, setKardex] = useState([]);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get(`/inventario/kardex/${producto.id}?limite=10`).then(setKardex).catch(() => setKardex([]));
  }, [producto.id]);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api.post('/inventario/movimientos', {
        productoId: producto.id,
        tipo,
        cantidad: Number(cantidad),
        motivo,
      });
      onGuardado();
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
      <div className="modal__caja">
        <div className="modal__cabecera">
          <h2 id="titulo-modal">{producto.nombre}</h2>
          <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <p className="modal__meta">
          {producto.sku} · stock actual <strong>{producto.stock}</strong> · mínimo{' '}
          {producto.stock_minimo}
        </p>

        {error && <div className="aviso aviso--error">{error}</div>}

        <form onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="tipo">Tipo de movimiento</label>
            <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="entrada">Entrada (compra a proveedor)</option>
              <option value="salida">Salida (merma, garantía)</option>
              <option value="ajuste">Ajuste por conteo físico</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="cantidad">
              {tipo === 'ajuste' ? 'Existencia real contada' : 'Cantidad'}
            </label>
            <input
              id="cantidad"
              type="number"
              min="0"
              required
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="motivo">Motivo</label>
            <input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>

          <div className="modal__acciones">
            <button type="button" className="boton boton--secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Registrar movimiento'}
            </button>
          </div>
        </form>

        {kardex.length > 0 && (
          <section className="modal__kardex">
            <h3>Últimos movimientos</h3>
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th className="numero">Cant.</th>
                    <th className="numero">Resultante</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {kardex.map((m) => (
                    <tr key={m.id}>
                      <td>{fecha(m.creado_en)}</td>
                      <td>{m.tipo}</td>
                      <td className="numero">{m.cantidad}</td>
                      <td className="numero">{m.stock_resultante}</td>
                      <td>{m.motivo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pedidos -- */

function Pedidos() {
  const [pedidos, setPedidos] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    const consulta = filtro ? `?estado=${filtro}` : '';
    api
      .get(`/pedidos${consulta}`)
      .then(setPedidos)
      .catch((e) => setError(e.message));
  }, [filtro]);

  useEffect(cargar, [cargar]);

  async function cambiarEstado(id, estado) {
    try {
      await api.patch(`/pedidos/${id}/estado`, { estado });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <div className="aviso aviso--error">{error}</div>;
  if (!pedidos) return <p className="cargando">Cargando pedidos…</p>;

  return (
    <section className="tarjeta">
      <div className="panel__encabezado">
        <h2>Pedidos</h2>
        <div className="campo campo--enlinea" style={{ margin: 0 }}>
          <label htmlFor="filtro-estado">Estado</label>
          <select id="filtro-estado" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_PEDIDO.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="vacio">No hay pedidos con ese filtro.</div>
      ) : (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="numero">Total</th>
                <th>Estado</th>
                <th>Cambiar a</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.numero}</strong></td>
                  <td>
                    {p.cliente}
                    <br />
                    <small>{p.cliente_email}</small>
                  </td>
                  <td>{fecha(p.creado_en)}</td>
                  <td className="numero">{pesos(p.total)}</td>
                  <td><span className={`etiqueta etiqueta--${p.estado}`}>{p.estado}</span></td>
                  <td>
                    <select
                      value={p.estado}
                      onChange={(e) => cambiarEstado(p.id, e.target.value)}
                      aria-label={`Cambiar estado del pedido ${p.numero}`}
                    >
                      {ESTADOS_PEDIDO.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
