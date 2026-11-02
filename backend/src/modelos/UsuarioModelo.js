/**
 * Modelo Usuario — cuentas de clientes y personal administrativo.
 *
 * La contraseña nunca se guarda en texto plano: se almacena su hash bcrypt.
 * bcrypt es lento a propósito, lo que encarece un ataque por fuerza bruta
 * aunque alguien se lleve la tabla completa.
 */
import bcrypt from 'bcryptjs';
import { consultar, consultarUna } from '../config/basedatos.js';

/** Coste del hash. 10 rondas es el equilibrio habitual entre seguridad y tiempo. */
const RONDAS = 10;

/** Campos públicos: nunca se expone la columna `contrasena`. */
const CAMPOS_PUBLICOS = `
  id, nombre, apellido, email, telefono, documento,
  direccion, ciudad, rol, activo, creado_en
`;

export async function crear(datos) {
  const hash = await bcrypt.hash(datos.contrasena, RONDAS);

  const resultado = await consultar(
    `INSERT INTO usuarios
       (nombre, apellido, email, contrasena, telefono, documento, direccion, ciudad, rol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.apellido,
      datos.email.toLowerCase().trim(),
      hash,
      datos.telefono ?? null,
      datos.documento ?? null,
      datos.direccion ?? null,
      datos.ciudad ?? null,
      datos.rol ?? 'cliente',
    ],
  );

  return resultado.insertId;
}

export async function obtenerPorId(id) {
  return consultarUna(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`, [id]);
}

/** Incluye el hash: solo para el proceso de autenticación. */
export async function obtenerPorEmailConHash(email) {
  return consultarUna('SELECT * FROM usuarios WHERE email = ?', [email.toLowerCase().trim()]);
}

export async function emailExiste(email) {
  const fila = await consultarUna('SELECT id FROM usuarios WHERE email = ?', [
    email.toLowerCase().trim(),
  ]);
  return fila !== null;
}

/** Compara la contraseña recibida contra el hash almacenado. */
export async function contrasenaCoincide(contrasenaPlana, hash) {
  return bcrypt.compare(contrasenaPlana, hash);
}

export async function actualizarPerfil(id, datos) {
  const columnas = {
    nombre: 'nombre',
    apellido: 'apellido',
    telefono: 'telefono',
    documento: 'documento',
    direccion: 'direccion',
    ciudad: 'ciudad',
  };

  const asignaciones = [];
  const parametros = [];

  for (const [clave, columna] of Object.entries(columnas)) {
    if (datos[clave] !== undefined) {
      asignaciones.push(`${columna} = ?`);
      parametros.push(datos[clave]);
    }
  }

  if (asignaciones.length === 0) return false;

  parametros.push(id);
  const resultado = await consultar(
    `UPDATE usuarios SET ${asignaciones.join(', ')} WHERE id = ?`,
    parametros,
  );
  return resultado.affectedRows > 0;
}

/** Listado para el panel administrativo. */
export async function listar() {
  return consultar(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios ORDER BY creado_en DESC`);
}
