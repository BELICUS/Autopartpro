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
  // Railway (y la mayoría de plataformas) asignan el puerto por la
  // variable PORT, no elegible por el usuario. PUERTO sigue funcionando
  // para desarrollo local y despliegues manuales (VPS propio).
  puerto: Number(opcional('PORT', opcional('PUERTO', 4000))),
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

  // Pago manual por transferencia bancaria. No depende de ninguna pasarela
  // ni de aprobación de comercio: el cliente transfiere directo a esta
  // cuenta desde su banco, y el pedido queda 'pendiente' hasta que el
  // administrador confirma manualmente que el dinero llegó.
  transferencia: {
    banco: opcional('BANCO_NOMBRE', ''),
    tipoCuenta: opcional('BANCO_TIPO_CUENTA', 'Ahorros'),
    numeroCuenta: opcional('BANCO_NUMERO_CUENTA', ''),
    titular: opcional('BANCO_TITULAR', ''),
    documentoTitular: opcional('BANCO_DOCUMENTO_TITULAR', ''),
  },
};

/** true si hay datos de cuenta cargados para mostrar en el checkout. */
export const transferenciaConfigurada = Boolean(
  entorno.transferencia.banco && entorno.transferencia.numeroCuenta,
);

/** true si la pasarela tiene llaves cargadas y puede usarse. */
export const pasarelaConfigurada = Boolean(
  entorno.wompi.llavePublica &&
    entorno.wompi.secretoIntegridad &&
    !entorno.wompi.llavePublica.includes('XXXX'),
);
