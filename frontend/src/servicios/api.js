/**
 * Cliente HTTP de la API.
 *
 * Centraliza la URL base, el token de sesión y el formato de error, para que
 * los componentes solo llamen `api.get('/productos')` y reciban datos o una
 * excepción con un mensaje legible.
 */

/**
 * En desarrollo, el proxy de Vite reenvía /api al backend en el mismo
 * origen (ver vite.config.js), así que basta con la ruta relativa.
 *
 * En producción el frontend y el backend suelen vivir en servicios
 * separados (p. ej. Railway asigna una URL distinta a cada uno), así que
 * hace falta la URL completa. Se fija al compilar con la variable de
 * entorno VITE_API_URL — Vite solo expone al navegador las variables que
 * empiezan con VITE_.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

/** Origen del backend, sin el sufijo /api — para construir URLs de imágenes. */
export const ORIGEN_BACKEND = BASE.replace(/\/api\/?$/, '');

const CLAVE_TOKEN = 'autopart_token';

export function guardarToken(token) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

export function leerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
}

/** Error con el código HTTP, para que quien llame pueda distinguir casos. */
export class ErrorApi extends Error {
  constructor(mensaje, estado, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.detalles = detalles;
  }
}

async function peticion(ruta, opciones = {}) {
  const token = leerToken();

  const respuesta = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  if (respuesta.status === 204) return null;

  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Respuesta sin cuerpo JSON.
  }

  if (!respuesta.ok) {
    // Si el token caducó, se limpia para que la interfaz vuelva al acceso.
    if (respuesta.status === 401) borrarToken();

    throw new ErrorApi(
      cuerpo?.error ?? `Error ${respuesta.status}`,
      respuesta.status,
      cuerpo?.detalles,
    );
  }

  return cuerpo;
}

/** Convierte un objeto en query string, omitiendo valores vacíos. */
export function aQuery(parametros) {
  const limpio = Object.entries(parametros)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)]);

  const cadena = new URLSearchParams(limpio).toString();
  return cadena ? `?${cadena}` : '';
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, cuerpo) => peticion(ruta, { method: 'POST', body: JSON.stringify(cuerpo) }),
  put: (ruta, cuerpo) => peticion(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) }),
  patch: (ruta, cuerpo) => peticion(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  delete: (ruta) => peticion(ruta, { method: 'DELETE' }),
};
