/**
 * Construcción de la aplicación Express.
 *
 * Se separa de `servidor.js` para poder importar la app sin levantar un
 * puerto: eso es lo que permitiría montar pruebas automatizadas más adelante.
 */
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import rutas from './rutas/index.js';
import { noEncontrado, manejadorErrores } from './middlewares/errores.js';
import { entorno } from './config/entorno.js';

const directorioActual = dirname(fileURLToPath(import.meta.url));

export function crearApp() {
  const app = express();

  // El frontend corre en otro puerto (5173), así que el navegador trata la
  // API como origen cruzado y exige CORS.
  app.use(
    cors({
      origin: entorno.origenFrontend,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Imágenes de los productos.
  app.use('/imagenes', express.static(join(directorioActual, '..', 'publico', 'imagenes')));

  // Traza mínima de peticiones: suficiente para depurar en desarrollo.
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
    next();
  });

  app.use('/api', rutas);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
