/**
 * Ejecuta un archivo .sql contra la base configurada.
 *
 * Se usa desde npm:  `npm run bd:crear`  y  `npm run bd:semilla`.
 * Evita depender del cliente `mysql` en la ruta del sistema, que en XAMPP
 * vive en /opt/lampp/bin y no siempre está en el PATH.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';
import { entorno } from '../config/entorno.js';

const archivo = process.argv[2];

if (!archivo) {
  console.error('Uso: node src/utilidades/ejecutarSql.js <archivo.sql>');
  process.exit(1);
}

const ruta = resolve(process.cwd(), archivo);

try {
  const sql = await readFile(ruta, 'utf8');

  const conexion = await mysql.createConnection({
    host: entorno.bd.host,
    port: entorno.bd.puerto,
    database: entorno.bd.nombre,
    user: entorno.bd.usuario,
    password: entorno.bd.contrasena,
    charset: 'utf8mb4',
    // Necesario para enviar un archivo con varias sentencias de una vez.
    multipleStatements: true,
  });

  await conexion.query(sql);
  await conexion.end();

  console.log(`✓ Ejecutado: ${archivo}`);
} catch (error) {
  console.error(`✗ Error ejecutando ${archivo}`);
  console.error(`  ${error.message}`);
  process.exit(1);
}
