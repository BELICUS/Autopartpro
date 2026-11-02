/** Controlador de registro, acceso y perfil. */
import * as Usuario from '../modelos/UsuarioModelo.js';
import { firmarToken } from '../middlewares/autenticacion.js';

/** POST /api/auth/registro */
export async function registro(req, res) {
  const { email } = req.body;

  if (await Usuario.emailExiste(email)) {
    return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
  }

  // El rol nunca se toma del cuerpo de la petición: cualquiera podría
  // mandar rol="administrador" y escalar privilegios.
  const id = await Usuario.crear({ ...req.body, rol: 'cliente' });
  const usuario = await Usuario.obtenerPorId(id);

  return res.status(201).json({ usuario, token: firmarToken(usuario) });
}

/** POST /api/auth/acceso */
export async function acceso(req, res) {
  const { email, contrasena } = req.body;
  const usuario = await Usuario.obtenerPorEmailConHash(email);

  // Mismo mensaje para "no existe" y "clave incorrecta": distinguirlos
  // permitiría averiguar qué correos están registrados.
  const credencialesInvalidas = { error: 'Correo o contraseña incorrectos' };

  if (!usuario || !(await Usuario.contrasenaCoincide(contrasena, usuario.contrasena))) {
    return res.status(401).json(credencialesInvalidas);
  }
  if (usuario.activo !== 1) {
    return res.status(403).json({ error: 'La cuenta está desactivada' });
  }

  delete usuario.contrasena;
  return res.json({ usuario, token: firmarToken(usuario) });
}

/** GET /api/auth/perfil */
export async function perfil(req, res) {
  const usuario = await Usuario.obtenerPorId(req.usuario.id);
  if (!usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  return res.json(usuario);
}

/** PUT /api/auth/perfil */
export async function actualizarPerfil(req, res) {
  await Usuario.actualizarPerfil(req.usuario.id, req.body);
  res.json(await Usuario.obtenerPorId(req.usuario.id));
}
