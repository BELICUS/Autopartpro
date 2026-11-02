/**
 * Contexto de sesión: quién está conectado y con qué rol.
 *
 * Se usa contexto en vez de pasar el usuario por props porque lo consultan
 * componentes de muy distinta profundidad (la barra superior, el checkout,
 * las rutas protegidas del panel).
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, guardarToken, borrarToken, leerToken } from '../servicios/api.js';

const SesionContexto = createContext(null);

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, si hay token guardado se revalida contra la API: el token
  // pudo expirar mientras la pestaña estaba cerrada.
  useEffect(() => {
    if (!leerToken()) {
      setCargando(false);
      return;
    }
    api
      .get('/auth/perfil')
      .then(setUsuario)
      .catch(() => borrarToken())
      .finally(() => setCargando(false));
  }, []);

  async function acceder(email, contrasena) {
    const { usuario: u, token } = await api.post('/auth/acceso', { email, contrasena });
    guardarToken(token);
    setUsuario(u);
    return u;
  }

  async function registrar(datos) {
    const { usuario: u, token } = await api.post('/auth/registro', datos);
    guardarToken(token);
    setUsuario(u);
    return u;
  }

  function salir() {
    borrarToken();
    setUsuario(null);
  }

  const valor = useMemo(
    () => ({
      usuario,
      cargando,
      acceder,
      registrar,
      salir,
      esAdministrador: usuario?.rol === 'administrador',
    }),
    [usuario, cargando],
  );

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion() {
  const contexto = useContext(SesionContexto);
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  }
  return contexto;
}
