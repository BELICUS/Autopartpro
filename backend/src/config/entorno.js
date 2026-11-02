/**
 * Lectura y validación de las variables de entorno.
 *
 * Se centraliza aquí para que el resto del código importe un objeto ya
 * validado en vez de leer `process.env` disperso por todos lados. Si falta
 * una variable obligatoria, el servidor falla al arrancar y no a mitad de
 * una petición.
 */
import dotenv from 'dotenv';

dotenv.config();

/** Devuelve la variable o corta el arranque si no está definida. */
function obligatoria(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        'Copia backend/.env.ejemplo como backend/.env y complétalo.',
    );
  }
  return valor.trim();
}

/** Devuelve la variable o un valor por defecto. */
function opcional(nombre, porDefecto) {
  const valor = process.env[nombre];
  return valor && valor.trim() !== '' ? valor.trim() : porDefecto;
}

export const entorno = {
  puerto: Number(opcional('PUERTO', 4000)),
  origenFrontend: opcional('ORIGEN_FRONTEND', 'http://localhost:5173'),

  bd: {
    host: opcional('BD_HOST', 'localhost'),
    puerto: Number(opcional('BD_PUERTO', 3306)),
    nombre: obligatoria('BD_NOMBRE'),
    usuario: obligatoria('BD_USUARIO'),
    contrasena: opcional('BD_CONTRASENA', ''),
  },

  jwt: {
    secreto: obligatoria('JWT_SECRETO'),
    expiracion: opcional('JWT_EXPIRACION', '8h'),
  },

  wompi: {
    // "pruebas" o "produccion". Cualquier otro valor se trata como pruebas,
    // que es el lado seguro: nunca cobrar de verdad por un error de tecleo.
    modo: opcional('WOMPI_MODO', 'pruebas') === 'produccion' ? 'produccion' : 'pruebas',
    llavePublica: opcional('WOMPI_LLAVE_PUBLICA', ''),
    llavePrivada: opcional('WOMPI_LLAVE_PRIVADA', ''),
    secretoIntegridad: opcional('WOMPI_SECRETO_INTEGRIDAD', ''),
    secretoEventos: opcional('WOMPI_SECRETO_EVENTOS', ''),
    urlRedireccion: opcional('WOMPI_URL_REDIRECCION', 'http://localhost:5173/pago/resultado'),
  },
};

/** true si la pasarela tiene llaves cargadas y puede usarse. */
export const pasarelaConfigurada = Boolean(
  entorno.wompi.llavePublica &&
    entorno.wompi.secretoIntegridad &&
    !entorno.wompi.llavePublica.includes('XXXX'),
);
