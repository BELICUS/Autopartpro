/**
 * Página principal: buscador por vehículo + rejilla de resultados.
 *
 * Los filtros viven en la URL (query string) y no solo en el estado del
 * componente. Así una búsqueda se puede compartir por enlace, el botón
 * "atrás" del navegador funciona, y recargar no pierde el filtro.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BuscadorVehiculo from '../componentes/BuscadorVehiculo.jsx';
import TarjetaProducto from '../componentes/TarjetaProducto.jsx';
import { api, aQuery } from '../servicios/api.js';

const FILTROS_VACIOS = { marca: '', modelo: '', anio: '', categoria: '', q: '' };

export default function Catalogo() {
  const [parametrosUrl, setParametrosUrl] = useSearchParams();

  // Estado del formulario, inicializado desde la URL.
  const [filtros, setFiltros] = useState(() => ({
    marca: parametrosUrl.get('marca') ?? '',
    modelo: parametrosUrl.get('modelo') ?? '',
    anio: parametrosUrl.get('anio') ?? '',
    categoria: parametrosUrl.get('categoria') ?? '',
    q: parametrosUrl.get('q') ?? '',
  }));

  const [orden, setOrden] = useState(parametrosUrl.get('orden') ?? 'relevancia');
  const [pagina, setPagina] = useState(Number(parametrosUrl.get('pagina')) || 1);

  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Se dispara cuando cambia la URL, no cuando cambia el formulario: el
  // usuario debe pulsar "Buscar" para lanzar la consulta.
  useEffect(() => {
    const consulta = aQuery({
      marca: parametrosUrl.get('marca'),
      modelo: parametrosUrl.get('modelo'),
      anio: parametrosUrl.get('anio'),
      categoria: parametrosUrl.get('categoria'),
      q: parametrosUrl.get('q'),
      orden: parametrosUrl.get('orden'),
      pagina: parametrosUrl.get('pagina') ?? 1,
      porPagina: 12,
    });

    setCargando(true);
    setError(null);

    api
      .get(`/productos${consulta}`)
      .then(setResultado)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [parametrosUrl]);

  /** Vuelca los filtros del formulario a la URL. */
  function aplicar(nuevosFiltros = filtros, nuevaPagina = 1, nuevoOrden = orden) {
    const limpio = Object.fromEntries(
      Object.entries({ ...nuevosFiltros, orden: nuevoOrden, pagina: nuevaPagina }).filter(
        ([, v]) => v !== '' && v !== null && v !== undefined && v !== 1,
      ),
    );
    setParametrosUrl(limpio);
    setPagina(nuevaPagina);
  }

  function limpiar() {
    setFiltros(FILTROS_VACIOS);
    setOrden('relevancia');
    setParametrosUrl({});
  }

  function cambiarOrden(nuevo) {
    setOrden(nuevo);
    aplicar(filtros, 1, nuevo);
  }

  function irAPagina(n) {
    aplicar(filtros, n, orden);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const hayFiltroVehiculo = parametrosUrl.get('marca') || parametrosUrl.get('modelo');

  return (
    <div className="contenedor catalogo">
      <BuscadorVehiculo
        valor={filtros}
        onCambio={setFiltros}
        onBuscar={() => aplicar(filtros, 1, orden)}
        onLimpiar={limpiar}
      />

      {hayFiltroVehiculo && !cargando && resultado && (
        <div className="aviso aviso--info">
          Mostrando únicamente repuestos compatibles con el vehículo seleccionado.
        </div>
      )}

      <div className="catalogo__encabezado">
        <p className="catalogo__conteo">
          {cargando
            ? 'Buscando…'
            : resultado
              ? `${resultado.total} ${resultado.total === 1 ? 'resultado' : 'resultados'}`
              : ''}
        </p>

        <div className="campo campo--enlinea">
          <label htmlFor="orden">Ordenar por</label>
          <select id="orden" value={orden} onChange={(e) => cambiarOrden(e.target.value)}>
            <option value="relevancia">Relevancia</option>
            <option value="precio_asc">Menor precio</option>
            <option value="precio_desc">Mayor precio</option>
            <option value="nombre">Nombre</option>
            <option value="recientes">Más recientes</option>
          </select>
        </div>
      </div>

      {error && <div className="aviso aviso--error">{error}</div>}

      {cargando ? (
        <p className="cargando">Cargando catálogo…</p>
      ) : resultado?.productos.length === 0 ? (
        <div className="vacio">
          <p>
            <strong>No encontramos repuestos con esos filtros.</strong>
          </p>
          <p>
            Prueba con menos criterios, o escribe la referencia exacta en el campo de
            palabra clave.
          </p>
        </div>
      ) : (
        <>
          <div className="rejilla-productos">
            {resultado?.productos.map((p) => (
              <TarjetaProducto key={p.id} producto={p} />
            ))}
          </div>

          {resultado && resultado.totalPaginas > 1 && (
            <nav className="paginacion" aria-label="Paginación de resultados">
              <button
                type="button"
                className="boton boton--secundario boton--pequeno"
                disabled={pagina <= 1}
                onClick={() => irAPagina(pagina - 1)}
              >
                Anterior
              </button>
              <span>
                Página {resultado.pagina} de {resultado.totalPaginas}
              </span>
              <button
                type="button"
                className="boton boton--secundario boton--pequeno"
                disabled={pagina >= resultado.totalPaginas}
                onClick={() => irAPagina(pagina + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
