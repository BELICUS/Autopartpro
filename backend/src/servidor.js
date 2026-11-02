/** Punto de entrada: verifica la base de datos y levanta el servidor HTTP. */
import { crearApp } from './app.js';
import { entorno } from './config/entorno.js';
import { verificarConexion } from './config/basedatos.js';
import { estadoPasarela } from './servicios/wompiServicio.js';

try {
  await verificarConexion();
  console.log(`✓ Base de datos conectada: ${entorno.bd.nombre}@${entorno.bd.host}`);
} catch (error) {
  console.error('✗ No se pudo conectar a la base de datos.');
  console.error(`  ${error.message}`);
  console.error('  ¿Está MySQL corriendo? Revisa backend/.env');
  process.exit(1);
}

const pasarela = estadoPasarela();
if (pasarela.configurada) {
  const aviso = pasarela.esReal
    ? '⚠  MODO PRODUCCIÓN: los cobros son reales'
    : 'modo de pruebas (sandbox), ningún cobro es real';
  console.log(`✓ Pasarela Wompi lista — ${aviso}`);
} else {
  console.log('• Pasarela Wompi sin llaves: el pago quedará deshabilitado en el checkout');
}

const app = crearApp();

app.listen(entorno.puerto, () => {
  console.log(`✓ API escuchando en http://localhost:${entorno.puerto}/api`);
  console.log(`  Origen permitido para el frontend: ${entorno.origenFrontend}`);
});
