/** Encabezado con navegación, acceso al carrito y menú de sesión. */
import { Link, NavLink } from 'react-router-dom';
import { useSesion } from '../contexto/SesionContexto.jsx';
import { useCarrito } from '../contexto/CarritoContexto.jsx';

export default function BarraSuperior() {
  const { usuario, salir, esAdministrador } = useSesion();
  const { resumen } = useCarrito();

  return (
    <header className="barra">
      <div className="contenedor barra__interior">
        <Link to="/" className="barra__marca">
          <span className="barra__logo" aria-hidden="true">AP</span>
          <span>
            AutoPart<strong>Pro</strong>
          </span>
        </Link>

        <nav className="barra__nav">
          <NavLink to="/" end>Catálogo</NavLink>
          {usuario && <NavLink to="/mis-pedidos">Mis pedidos</NavLink>}
          {esAdministrador && <NavLink to="/admin">Panel</NavLink>}
        </nav>

        <div className="barra__acciones">
          <Link to="/carrito" className="barra__carrito">
            Carrito
            {resumen.unidades > 0 && (
              <span className="barra__contador">{resumen.unidades}</span>
            )}
          </Link>

          {usuario ? (
            <div className="barra__sesion">
              <span className="barra__usuario">{usuario.nombre}</span>
              <button type="button" className="boton boton--secundario boton--pequeno" onClick={salir}>
                Salir
              </button>
            </div>
          ) : (
            <Link to="/acceso" className="boton boton--pequeno">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
