/**
 * Buscador avanzado por vehículo.
 *
 * Los tres selectores están encadenados: la marca determina los modelos, y
 * el modelo determina los años disponibles. Cada nivel se pide a la API solo
 * cuando el anterior cambia; así el navegador no descarga de entrada el
 * árbol completo de compatibilidades.
 *
 * Elegir una marca distinta limpia modelo y año, porque un "Logan 2014"
 * dejaría de tener sentido al cambiar a Mazda.
 */
import { useEffect, useState } from 'react';
import { api } from '../servicios/api.js';

export default function BuscadorVehiculo({ valor, onCambio, onBuscar, onLimpiar }) {
  const [marcas, setMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [anios, setAnios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargandoModelos, setCargandoModelos] = useState(false);

  // Catálogos que no dependen de nada: se piden una sola vez.
  useEffect(() => {
    api.get('/marcas').then(setMarcas).catch(() => setMarcas([]));
    api.get('/categorias').then(setCategorias).catch(() => setCategorias([]));
  }, []);

  // Modelos de la marca seleccionada.
  useEffect(() => {
    if (!valor.marca) {
      setModelos([]);
      setAnios([]);
      return;
    }
    setCargandoModelos(true);
    api
      .get(`/marcas/${valor.marca}/modelos`)
      .then(setModelos)
      .catch(() => setModelos([]))
      .finally(() => setCargandoModelos(false));
  }, [valor.marca]);

  // Años de la generación del modelo seleccionado.
  useEffect(() => {
    if (!valor.modelo) {
      setAnios([]);
      return;
    }
    api
      .get(`/modelos/${valor.modelo}/anios`)
      .then(setAnios)
      .catch(() => setAnios([]));
  }, [valor.modelo]);

  function cambiarMarca(marca) {
    onCambio({ ...valor, marca, modelo: '', anio: '' });
  }

  function cambiarModelo(modelo) {
    onCambio({ ...valor, modelo, anio: '' });
  }

  function enviar(evento) {
    evento.preventDefault();
    onBuscar();
  }

  const hayFiltros = Boolean(
    valor.marca || valor.modelo || valor.anio || valor.q || valor.categoria,
  );

  return (
    <form className="buscador" onSubmit={enviar}>
      <div className="buscador__titulo">
        <h2>Encuentra el repuesto de tu carro</h2>
        <p>Selecciona marca, modelo y año para ver solo lo que te sirve.</p>
      </div>

      <div className="buscador__rejilla">
        <div className="campo">
          <label htmlFor="marca">Marca</label>
          <select
            id="marca"
            value={valor.marca}
            onChange={(e) => cambiarMarca(e.target.value)}
          >
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="modelo">Modelo</label>
          <select
            id="modelo"
            value={valor.modelo}
            onChange={(e) => cambiarModelo(e.target.value)}
            disabled={!valor.marca || cargandoModelos}
          >
            <option value="">
              {!valor.marca ? 'Elige una marca' : cargandoModelos ? 'Cargando…' : 'Todos los modelos'}
            </option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="anio">Año</label>
          <select
            id="anio"
            value={valor.anio}
            onChange={(e) => onCambio({ ...valor, anio: e.target.value })}
            disabled={!valor.modelo}
          >
            <option value="">{!valor.modelo ? 'Elige un modelo' : 'Cualquier año'}</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="categoria">Sistema</label>
          <select
            id="categoria"
            value={valor.categoria}
            onChange={(e) => onCambio({ ...valor, categoria: e.target.value })}
          >
            <option value="">Todos los sistemas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.productos})
              </option>
            ))}
          </select>
        </div>

        <div className="campo buscador__texto">
          <label htmlFor="q">Palabra clave o referencia</label>
          <input
            id="q"
            type="search"
            placeholder="pastillas, NGK, FIL-ACE-001…"
            value={valor.q}
            onChange={(e) => onCambio({ ...valor, q: e.target.value })}
          />
        </div>

        <div className="buscador__acciones">
          <button type="submit" className="boton">
            Buscar repuestos
          </button>
          {hayFiltros && (
            <button type="button" className="boton boton--secundario" onClick={onLimpiar}>
              Limpiar
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
