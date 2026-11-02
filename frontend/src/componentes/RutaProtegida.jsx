/**
 * Envoltura para rutas que exigen sesión, y opcionalmente rol de
 * administrador. Guarda de dónde venía el usuario para devolverlo ahí
 * después de autenticarse.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../contexto/SesionContexto.jsx';

export default function RutaProtegida({ children, soloAdministrador = false }) {
  const { usuario, cargando, esAdministrador } = useSesion();
  const ubicacion = useLocation();

  // Mientras se revalida el token no se puede decidir: redirigir aquí
  // expulsaría a un usuario que sí tiene sesión válida.
  if (cargando) {
    return <p className="cargando">Verificando sesión…</p>;
  }

  if (!usuario) {
    return <Navigate to="/acceso" state={{ desde: ubicacion.pathname }} replace />;
  }

  if (soloAdministrador && !esAdministrador) {
    return (
      <div className="contenedor" style={{ padding: '3rem 1.25rem' }}>
        <div className="aviso aviso--error">
          Esta sección es solo para administradores.
        </div>
      </div>
    );
  }

  return children;
}
