# Manual de despliegue — AutoPart Pro

Guía para levantar el sistema desde cero en una máquina limpia, y notas
sobre lo que cambiaría en un servidor real.

---

## 1. Requisitos

| Componente | Versión mínima | Verificar con |
|---|---|---|
| Node.js | 18 (probado en 20.19.5) | `node -v` |
| npm | 9 (probado en 10.8.2) | `npm -v` |
| MySQL o MariaDB | MySQL 8 / MariaDB 10.4 | `mysql --version` |
| PHP con GD | 8.0 — solo para regenerar imágenes | `php -m \| grep gd` |

PHP es **opcional**: solo hace falta si se quieren volver a generar las
imágenes del catálogo. Las imágenes ya vienen incluidas en el repositorio.

El proyecto se probó sobre **Ubuntu 24.04** usando el MariaDB que trae XAMPP,
pero funciona igual con un MySQL instalado por separado.

---

## 2. Estructura del proyecto

```
proyecto_final/
├── backend/                  API REST (Node + Express, patrón MVC)
│   ├── src/
│   │   ├── config/           entorno.js, basedatos.js
│   │   ├── modelos/          acceso a datos — la única capa con SQL
│   │   ├── controladores/    traducción HTTP ↔ modelo
│   │   ├── rutas/            tabla de endpoints y validadores
│   │   ├── middlewares/      autenticación y manejo de errores
│   │   ├── servicios/        integración con Wompi
│   │   ├── utilidades/       ejecutor de archivos .sql
│   │   ├── app.js            construcción de Express
│   │   └── servidor.js       punto de entrada
│   ├── sql/
│   │   ├── esquema.sql       11 tablas + 1 vista
│   │   └── semilla.sql       datos de prueba
│   ├── publico/imagenes/     25 imágenes PNG del catálogo
│   ├── .env.ejemplo          plantilla de configuración
│   └── package.json
│
├── frontend/                 Interfaz (React 18 + Vite)
│   ├── src/
│   │   ├── componentes/      BuscadorVehiculo, TarjetaProducto, BarraSuperior…
│   │   ├── paginas/          Catalogo, Checkout, PanelAdmin…
│   │   ├── contexto/         sesión y carrito
│   │   ├── servicios/        cliente HTTP y formato de moneda
│   │   └── estilos/          global.css, componentes.css
│   ├── vite.config.js        proxy hacia el backend
│   └── package.json
│
├── scripts/
│   ├── generar-imagenes.php  generador de imágenes con GD
│   └── productos.json        listado que consume el generador
│
└── docs/
    ├── diccionario-de-datos.md
    ├── diagrama-de-clases.md
    └── manual-de-despliegue.md
```

---

## 3. Instalación paso a paso

### 3.1 Arrancar la base de datos

Con XAMPP:

```bash
sudo /opt/lampp/lampp start
```

Con MySQL de sistema:

```bash
sudo systemctl start mysql
```

Comprobar que el puerto 3306 está escuchando:

```bash
ss -ltn | grep 3306
```

### 3.2 Crear la base y el usuario

No se usa `root` para la aplicación: se crea un usuario con privilegios
únicamente sobre esta base. Es el principio de mínimo privilegio — si la
aplicación se ve comprometida, el atacante no alcanza otras bases del
servidor.

```bash
# Con XAMPP el cliente está en /opt/lampp/bin/mysql
mysql -u root -p
```

```sql
CREATE DATABASE autopart_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'autopart_user'@'localhost'
  IDENTIFIED BY 'una_contrasena_robusta';

GRANT ALL PRIVILEGES ON autopart_pro.*
  TO 'autopart_user'@'localhost';

FLUSH PRIVILEGES;
```

### 3.3 Configurar el backend

```bash
cd backend
npm install
cp .env.ejemplo .env
```

Editar `.env`:

```bash
PUERTO=4000
ORIGEN_FRONTEND=http://localhost:5173

BD_HOST=localhost
BD_PUERTO=3306
BD_NOMBRE=autopart_pro
BD_USUARIO=autopart_user
BD_CONTRASENA=la_que_acabas_de_crear

# Generar con:  openssl rand -hex 32
JWT_SECRETO=una_cadena_aleatoria_de_64_caracteres
JWT_EXPIRACION=8h

WOMPI_MODO=pruebas
WOMPI_LLAVE_PUBLICA=pub_test_...
WOMPI_LLAVE_PRIVADA=prv_test_...
WOMPI_SECRETO_INTEGRIDAD=test_integrity_...
WOMPI_SECRETO_EVENTOS=test_events_...
WOMPI_URL_REDIRECCION=http://localhost:5173/pago/resultado
```

El secreto JWT **debe** generarse al azar:

```bash
openssl rand -hex 32
```

Si se deja el valor de ejemplo, cualquiera que conozca la plantilla puede
firmar tokens válidos y entrar como administrador.

### 3.4 Crear las tablas y cargar datos

```bash
npm run bd:crear      # crea las 11 tablas y la vista
npm run bd:semilla    # carga 25 productos, 20 vehículos, 375 compatibilidades
```

O ambos de una vez:

```bash
npm run bd:reiniciar
```

> `bd:semilla` ejecuta `TRUNCATE` sobre todas las tablas antes de insertar.
> No ejecutarlo si ya hay pedidos reales.

### 3.5 Levantar el backend

```bash
npm run dev     # con recarga automática
# o
npm start
```

Salida esperada:

```
✓ Base de datos conectada: autopart_pro@localhost
✓ Pasarela Wompi lista — modo de pruebas (sandbox), ningún cobro es real
✓ API escuchando en http://localhost:4000/api
```

Comprobación rápida:

```bash
curl http://localhost:4000/api/salud
```

### 3.6 Levantar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`.

Vite reenvía `/api` y `/imagenes` al backend del puerto 4000, así que el
navegador las ve como mismo origen y no hay que lidiar con CORS en
desarrollo.

---

## 4. Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@autopartpro.co` | `Admin2026*` |
| Cliente | `cliente@ejemplo.co` | `Cliente2026*` |

Solo válidas en el entorno local. Antes de cualquier despliegue real hay que
cambiarlas o eliminar esos registros.

---

## 5. Configurar la pasarela de pagos

### 5.1 Obtener las llaves del sandbox

1. Registrarse en `https://comercios.wompi.co`.
2. Entrar a la sección de desarrolladores y cambiar al ambiente de **pruebas**.
3. Copiar las cuatro credenciales:
   - Llave pública (`pub_test_…`)
   - Llave privada (`prv_test_…`)
   - Secreto de integridad
   - Secreto de eventos
4. Pegarlas en `backend/.env` y reiniciar el backend.

Con `WOMPI_MODO=pruebas` ningún cobro es real: Wompi entrega tarjetas y
bancos ficticios para simular aprobación, rechazo y pago pendiente.

### 5.2 Sin llaves configuradas

El sistema sigue funcionando. El checkout detecta que la pasarela no está
lista, registra el pedido como `pendiente` y avisa al cliente de que debe
coordinar el pago por transferencia. Esto se decide en
`pasarelaConfigurada`, dentro de `src/config/entorno.js`.

### 5.3 El webhook en entorno local

La URL de confirmación es la que Wompi llama **desde sus servidores** para
avisar el resultado del pago. Apuntando a `localhost`, esa llamada nunca
llega: la máquina no es alcanzable desde internet.

Para probarlo hay que exponer el backend con un túnel:

```bash
ngrok http 4000
```

Y registrar en el panel de Wompi la URL que entrega ngrok:

```
https://xxxx.ngrok-free.app/api/pagos/webhook
```

Sin túnel, el pedido igual se actualiza cuando el comprador regresa por la
URL de redirección, que consulta el estado real contra la API de Wompi.

### 5.4 Pasar a cobros reales

No es parte del alcance académico, pero queda documentado:

1. Completar el registro del comercio en Wompi con NIT o cédula. Wompi valida
   la documentación.
2. **Registrar la cuenta bancaria de destino en el panel de Wompi.** La
   cuenta no se configura en el código: no existe ningún campo para ella. El
   dinero nunca pasa por este servidor; Wompi cobra, descuenta su comisión y
   gira a la cuenta que tiene registrada.
3. Cambiar `WOMPI_MODO=produccion` y reemplazar las cuatro llaves por las de
   producción.
4. Exponer el sitio en un dominio público **con HTTPS**. Wompi no acepta
   `http://` en producción.

Wompi aplica un monto mínimo por transacción; conviene verificarlo en su
documentación antes de diseñar pruebas con importes pequeños.

---

## 6. Regenerar las imágenes del catálogo

Solo si se agregan productos nuevos.

```bash
# 1. Exportar el listado actual desde la base
mysql -u root -D autopart_pro -N -B -e "
  SELECT CONCAT('{\"sku\":\"', p.sku, '\",\"nombre\":\"', p.nombre,
                 '\",\"categoria\":\"', c.slug, '\"}')
  FROM productos p JOIN categorias c ON c.id = p.categoria_id;" \
  > /tmp/crudo.txt

# 2. Convertir a JSON y generar
php scripts/generar-imagenes.php backend/publico/imagenes scripts/productos.json
```

El generador dibuja cada pieza con la biblioteca GD de PHP: degradado de
fondo según la categoría, silueta geométrica según el prefijo del SKU, y pie
con nombre y referencia. No descarga nada de internet.

---

## 7. Compilar para producción

```bash
cd frontend
npm run build
```

Genera `frontend/dist/` con los archivos estáticos.

En producción el frontend compilado lo sirve un servidor web (Nginx, Apache)
y el backend corre detrás como proceso aparte. El proxy de Vite solo existe
en desarrollo, así que hay que replicarlo en la configuración del servidor:

```nginx
server {
    listen 443 ssl;
    server_name autopartpro.ejemplo.co;

    root /var/www/autopart/frontend/dist;
    index index.html;

    # React Router maneja las rutas en el navegador: cualquier ruta
    # desconocida debe devolver index.html, no un 404.
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /imagenes {
        proxy_pass http://127.0.0.1:4000;
    }
}
```

Para que el backend sobreviva a reinicios:

```bash
npm install -g pm2
pm2 start backend/src/servidor.js --name autopart-api
pm2 save
pm2 startup
```

---

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `✗ No se pudo conectar a la base de datos` | MySQL apagado o credenciales erradas | Arrancar el servicio y revisar `BD_*` en `.env` |
| `Falta la variable de entorno BD_NOMBRE` | No se copió `.env.ejemplo` a `.env` | `cp .env.ejemplo .env` y completarlo |
| `ECONNREFUSED` en el navegador | El backend no está corriendo | Levantarlo en otra terminal |
| Las imágenes no cargan | El backend está caído: el proxy de Vite no responde | Verificar `curl localhost:4000/api/salud` |
| `Sesión inválida o expirada` al poco rato | `JWT_EXPIRACION` muy corto | Subirlo en `.env` y reiniciar |
| El checkout dice que no hay pasarela | Faltan las llaves de Wompi | Cargarlas en `.env`; sin ellas el pedido queda pendiente |
| El pedido no pasa a `pagado` | El webhook no llega a localhost | Usar ngrok, o confiar en la URL de redirección |
| `ER_DUP_ENTRY` al crear un producto | SKU repetido | Los SKU son únicos; usar otro |
| Puerto 3306 ocupado | MySQL de sistema y XAMPP a la vez | `sudo systemctl stop mysql` antes de arrancar XAMPP |

---

## 9. Lista de verificación previa a la sustentación

- [ ] MySQL corriendo y puerto 3306 escuchando
- [ ] `npm run bd:reiniciar` ejecutado sin errores
- [ ] Backend arriba: `curl localhost:4000/api/salud` devuelve `{"estado":"ok"}`
- [ ] Frontend arriba en `http://localhost:5173`
- [ ] Buscar «Chevrolet / Spark GT / 2015» devuelve 23 resultados
- [ ] Buscar «Toyota / Hilux / 2020» **no** devuelve bujías (es diésel)
- [ ] Entrar como administrador muestra 4 alertas de stock
- [ ] Reabastecer un producto cambia su severidad y actualiza las cifras
- [ ] Crear un pedido descuenta el inventario
- [ ] Cancelar un pedido devuelve las unidades
- [ ] Un usuario sin sesión recibe 401 en `/api/inventario/alertas`

---

## 10. Nota sobre el entorno

Este despliegue es de desarrollo. Para un servidor real faltarían, como
mínimo:

- Certificado TLS y HTTPS obligatorio.
- Contraseña para el usuario `root` de MySQL.
- Limitación de intentos de acceso (`express-rate-limit`) contra fuerza bruta.
- Cabeceras de seguridad (`helmet`).
- Respaldos automáticos de la base.
- Registro de peticiones a archivo, no a consola.
- Llaves de pasarela en modo producción y cuenta de comercio aprobada.
