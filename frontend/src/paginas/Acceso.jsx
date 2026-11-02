/** Acceso y registro en una sola página con dos pestañas. */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../contexto/SesionContexto.jsx';

export default function Acceso() {
  const { acceder, registrar } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = ubicacion.state?.desde ?? '/';

  const [modo, setModo] = useState('acceso');
  const [datos, setDatos] = useState({
    nombre: '', apellido: '', email: '', contrasena: '', telefono: '',
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      if (modo === 'acceso') {
        await acceder(datos.email, datos.contrasena);
      } else {
        await registrar(datos);
      }
      navegar(destino, { replace: true });
    } catch (e) {
      // express-validator devuelve el detalle por campo; es más útil que
      // el mensaje genérico.
      setError(e.detalles?.map((d) => d.mensaje).join('. ') ?? e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="contenedor acceso">
      <div className="acceso__caja tarjeta">
        <div className="acceso__pestanas">
          <button
            type="button"
            className={modo === 'acceso' ? 'activa' : ''}
            onClick={() => { setModo('acceso'); setError(null); }}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={modo === 'registro' ? 'activa' : ''}
            onClick={() => { setModo('registro'); setError(null); }}
          >
            Crear cuenta
          </button>
        </div>

        {error && <div className="aviso aviso--error">{error}</div>}

        <form onSubmit={enviar}>
          {modo === 'registro' && (
            <>
              <div className="campo">
                <label htmlFor="nombre">Nombre</label>
                <input id="nombre" required value={datos.nombre}
                  onChange={(e) => cambiar('nombre', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="apellido">Apellido</label>
                <input id="apellido" required value={datos.apellido}
                  onChange={(e) => cambiar('apellido', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" type="tel" value={datos.telefono}
                  onChange={(e) => cambiar('telefono', e.target.value)} />
              </div>
            </>
          )}

          <div className="campo">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" required autoComplete="email"
              value={datos.email} onChange={(e) => cambiar('email', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena" type="password" required
              minLength={modo === 'registro' ? 8 : undefined}
              autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
              value={datos.contrasena}
              onChange={(e) => cambiar('contrasena', e.target.value)}
            />
            {modo === 'registro' && <small>Mínimo 8 caracteres.</small>}
          </div>

          <button type="submit" className="boton boton--bloque" disabled={enviando}>
            {enviando ? 'Procesando…' : modo === 'acceso' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>

        <p className="acceso__volver">
          <Link to="/">Volver al catálogo</Link>
        </p>
      </div>
    </div>
  );
}
