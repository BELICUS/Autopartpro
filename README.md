# AutoPart Pro

Sistema de inventario inteligente y ventas de repuestos automotrices.
Proyecto final de Programación Orientada a la Web.

---

## Qué hace

- **Buscador por vehículo.** Selectores encadenados de marca → modelo → año
  que devuelven únicamente los repuestos compatibles con ese carro.
- **Inventario con alertas.** Clasificación automática de existencias en
  agotado, crítico y bajo, con kardex de todos los movimientos.
- **Venta en línea.** Carrito, checkout, control de stock transaccional e
  integración con la pasarela Wompi en modo sandbox.
- **Dos roles.** Cliente (compra y consulta sus pedidos) y administrador
  (inventario y gestión de pedidos).

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + React Router |
| Backend | Node.js 20 + Express 4, arquitectura MVC |
| Base de datos | MySQL 8 / MariaDB 10.4 — 11 tablas + 1 vista |
| Autenticación | JWT + bcrypt |
| Pasarela | Wompi (sandbox) |
| Imágenes | Generadas con la biblioteca GD de PHP |

---

## Arranque rápido

```bash
# 1. Base de datos
sudo /opt/lampp/lampp start

# 2. Backend
cd backend
npm install
cp .env.ejemplo .env     # completar credenciales
npm run bd:reiniciar     # crear tablas y cargar datos
npm run dev              # http://localhost:4000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

El paso a paso completo está en
[docs/manual-de-despliegue.md](docs/manual-de-despliegue.md).

---

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@autopartpro.co` | `Admin2026*` |
| Cliente | `cliente@ejemplo.co` | `Cliente2026*` |

---

## Documentación

| Documento | Contenido |
|---|---|
| [Diccionario de datos](docs/diccionario-de-datos.md) | Las 11 tablas columna por columna, restricciones y las decisiones de diseño detrás de cada una |
| [Diagrama de clases](docs/diagrama-de-clases.md) | Modelo entidad-relación, capas del backend, componentes del frontend y diagramas de secuencia |
| [Manual de despliegue](docs/manual-de-despliegue.md) | Instalación, configuración de la pasarela, producción y solución de problemas |
| [Despliegue en Railway](docs/despliegue-railway.md) | nunez.cloud sin servidor propio: Railway aloja backend, frontend y MySQL |
| [Despliegue en nunez.cloud (VPS)](docs/despliegue-nunez-cloud.md) | Alternativa con servidor propio: Nginx, MariaDB, systemd |

---

## Endpoints principales

```
GET    /api/salud                      estado del servicio
POST   /api/auth/registro              crear cuenta
POST   /api/auth/acceso                iniciar sesión → JWT
GET    /api/auth/perfil                datos del usuario            [sesión]

GET    /api/marcas                     marcas de vehículo
GET    /api/marcas/:id/modelos         modelos de una marca
GET    /api/modelos/:id/anios          años disponibles
GET    /api/categorias                 categorías con conteo

GET    /api/productos                  buscador con filtros
GET    /api/productos/:id              ficha con compatibilidades
POST   /api/productos                  crear                        [admin]
PUT    /api/productos/:id              actualizar                   [admin]
DELETE /api/productos/:id              baja lógica                  [admin]

GET    /api/inventario/resumen         cifras del inventario        [admin]
GET    /api/inventario/alertas         productos bajo mínimo        [admin]
GET    /api/inventario/kardex/:id      historial de un producto     [admin]
POST   /api/inventario/movimientos     entrada, salida o ajuste     [admin]

POST   /api/pedidos                    crear pedido                 [sesión]
GET    /api/pedidos/mios               historial propio             [sesión]
GET    /api/pedidos/:id                detalle                      [sesión]
GET    /api/pedidos                    todos                        [admin]
PATCH  /api/pedidos/:id/estado         cambiar estado               [admin]

GET    /api/pagos/estado               modo de la pasarela
POST   /api/pagos/iniciar/:pedidoId    datos firmados del checkout  [sesión]
GET    /api/pagos/verificar            consultar transacción
POST   /api/pagos/webhook              notificación de Wompi        [público]
```

**Parámetros del buscador:** `marca`, `modelo`, `anio`, `categoria`,
`fabricante`, `q`, `precioMin`, `precioMax`, `orden`, `pagina`, `porPagina`.

Ejemplo:

```
/api/productos?marca=1&modelo=1&anio=2015&categoria=1&orden=precio_asc
```

---

## Decisiones de arquitectura

**Por qué una tabla puente de compatibilidades.** Un repuesto sirve para
muchas generaciones de vehículo y una generación admite muchos repuestos. Sin
`compatibilidades` habría que repetir el producto una vez por carro, o
guardar una lista en un campo de texto: ninguna de las dos permite buscar
eficientemente.

**Por qué las generaciones guardan un rango de años.** Un Spark GT 2011 y uno
2016 montan el mismo repuesto. Guardar una fila por año multiplicaría las
compatibilidades sin añadir información. El buscador resuelve el año con
`BETWEEN` sobre un índice.

**Por qué el stock se reserva al crear el pedido y no al pagarlo.** Si se
descontara al confirmar el pago, dos clientes podrían comprometer la última
unidad mientras ambos están en la pasarela. Reservar al crear el pedido
elimina esa ventana; si el pago falla, la cancelación devuelve las unidades.

**Por qué el precio se relee en el servidor.** El carrito vive en el
navegador y el cliente puede editarlo. `PedidoModelo.crear()` ignora los
precios que llegan y los vuelve a consultar en la base dentro de la
transacción.

**Por qué el stock nunca se actualiza con un UPDATE directo.** Todo pasa por
`registrarMovimiento()`, que actualiza existencia y escribe el kardex en una
sola transacción, con `SELECT … FOR UPDATE` sobre la fila. Así la bitácora
nunca se desincroniza de la existencia real.

---

## Sobre los pagos

La pasarela opera en **modo sandbox**: ningún cobro es real y no se debita
dinero de ninguna cuenta. El modo lo controla `WOMPI_MODO` en
`backend/.env`.

La cuenta bancaria de destino no se configura en el código — no existe
ningún campo para ella. Se registra en el panel de Wompi, que valida la
documentación del comercio. El dinero nunca pasa por este servidor.

---

## Scripts disponibles

**Backend**

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm start` | Servidor en modo normal |
| `npm run bd:crear` | Crea las tablas y la vista |
| `npm run bd:semilla` | Carga los datos de prueba (trunca primero) |
| `npm run bd:reiniciar` | Los dos anteriores en orden |

**Frontend**

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con proxy al backend |
| `npm run build` | Compila a `dist/` |
| `npm run preview` | Sirve la compilación para revisarla |
