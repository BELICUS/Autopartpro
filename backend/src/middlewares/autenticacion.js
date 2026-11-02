/**
 * Middlewares de autenticación y autorización basados en JWT.
 *
 * El token se firma al iniciar sesión y viaja en la cabecera
 * `Authorization: Bearer <token>`. Al ser autocontenido, la API no guarda
 * sesiones en memoria y puede escalar a varias instancias sin estado
 * compartido.
 */
import jwt from 'jsonwebtoken';
import { entorno } from '../config/entorno.js';

/** Firma un token con los datos mínimos necesarios. */
export function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol },
    entorno.jwt.secreto,
    { expiresIn: entorno.jwt.expiracion },
  );
}

/** Exige un token válido. Deja el usuario en `req.usuario`. */
export function requiereSesion(req, res, next) {
  const cabecera = req.headers.authorization ?? '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token de sesión' });
  }

  try {
    req.usuario = jwt.verify(token, entorno.jwt.secreto);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

/** Exige rol de administrador. Se usa siempre después de `requiereSesion`. */
export function requiereAdministrador(req, res, next) {
  if (req.usuario?.rol !== 'administrador') {
    return res.status(403).json({ error: 'Esta operación requiere permisos de administrador' });
  }
  return next();
}

/**
 * Carga el usuario si hay token, pero no lo exige.
 * Útil en rutas que cambian su respuesta según haya sesión o no.
 */
export function sesionOpcional(req, _res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema === 'Bearer' && token) {
    try {
      req.usuario = jwt.verify(token, entorno.jwt.secreto);
    } catch {
      // Token inválido: se sigue como anónimo.
    }
  }
  return next();
}
