/**
 * Conexión a MySQL mediante un pool.
 *
 * Un pool mantiene varias conexiones abiertas y las reparte entre las
 * peticiones. Abrir y cerrar una conexión por cada consulta sería el cuello
 * de botella de la API con un catálogo de miles de referencias.
 */
import mysql from 'mysql2/promise';
import { entorno } from './entorno.js';

export const pool = mysql.createPool({
  host: entorno.bd.host,
  port: entorno.bd.puerto,
  database: entorno.bd.nombre,
  user: entorno.bd.usuario,
  password: entorno.bd.contrasena,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Devuelve DECIMAL como número en vez de cadena. Los precios se manejan
  // en pesos enteros, así que no hay pérdida de precisión.
  decimalNumbers: true,
});

/**
 * Ejecuta una consulta preparada y devuelve solo las filas.
 * Las consultas preparadas son la defensa contra inyección SQL: los valores
 * viajan separados de la sentencia y el motor nunca los interpreta como SQL.
 */
export async function consultar(sql, parametros = []) {
  const [filas] = await pool.execute(sql, parametros);
  return filas;
}

/** Igual que `consultar`, pero devuelve la primera fila o null. */
export async function consultarUna(sql, parametros = []) {
  const filas = await consultar(sql, parametros);
  return filas.length > 0 ? filas[0] : null;
}

/**
 * Envuelve varias operaciones en una transacción.
 * Si el callback lanza, se revierte todo. Indispensable al confirmar un
 * pedido: descontar stock y crear el pedido deben pasar juntos o no pasar.
 */
export async function enTransaccion(callback) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await callback(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/** Comprueba que la base responde. Se llama al arrancar el servidor. */
export async function verificarConexion() {
  const conexion = await pool.getConnection();
  try {
    await conexion.ping();
  } finally {
    conexion.release();
  }
}
