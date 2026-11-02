/**
 * Manejo centralizado de errores.
 *
 * Los controladores no llevan try/catch: envuelven su lógica en `async`
 * y cualquier excepción llega aquí. Así el formato de error es uno solo en
 * toda la API.
 */
import { validationResult } from 'express-validator';

/**
 * Envuelve un controlador asíncrono para que sus rechazos lleguen al
 * manejador de errores. Sin esto, Express 4 ignora las promesas rechazadas
 * y la petición queda colgada.
 */
export function asincrono(controlador) {
  return (req, res, next) => Promise.resolve(controlador(req, res, next)).catch(next);
}

/** Corta la petición si express-validator encontró problemas. */
export function validar(req, res, next) {
  const resultado = validationResult(req);
  if (!resultado.isEmpty()) {
    return res.status(422).json({
      error: 'Datos de entrada no válidos',
      detalles: resultado.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  return next();
}

/** Ruta inexistente. */
export function noEncontrado(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

/** Manejador final. Debe declararse con cuatro parámetros para que Express lo reconozca. */
export function manejadorErrores(error, _req, res, _next) {
  // Errores de MySQL traducidos a algo que el cliente entienda.
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
  }
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'La operación viola una relación entre tablas' });
  }
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'No hay conexión con la base de datos' });
  }

  const codigo = error.codigoHttp ?? 500;

  if (codigo >= 500) {
    console.error('[error]', error);
  }

  res.status(codigo).json({
    error: codigo >= 500 ? 'Error interno del servidor' : error.message,
  });
}
