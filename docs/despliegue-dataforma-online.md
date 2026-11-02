# Despliegue en dataforma.online y cobros reales

Documento aparte del manual de desarrollo. Cubre lo que falta para que el
sistema funcione en internet y pueda procesar un pago real.

---

## 1. Punto de partida

Verificado el 26 de octubre de 2026:

| Qué | Estado |
|---|---|
| Dominio `dataforma.online` | Registrado y resolviendo |
| Nameservers | `dns-parking.com` (Hostinger) |
| Apunta a | Vercel (`216.198.79.1`, `64.29.17.1`) |
| HTTPS | Activo, con HSTS |
| Redirección | `dataforma.online` → `www.dataforma.online` |

El dominio sirve para el frontend. **Falta dónde alojar el backend y la
base de datos.**

---

## 2. Arquitectura necesaria

```
                    ┌──────────────────────────────┐
  Navegador ──────► │ www.dataforma.online         │
                    │ Vercel — React compilado     │
                    └──────────────┬───────────────┘
                                   │ /api/*  (rewrite de Vercel)
                                   ▼
                    ┌──────────────────────────────┐
                    │ api.dataforma.online         │
                    │ Node + Express               │
                    │ VPS, Railway, Render o Fly   │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │ MySQL gestionado             │
                    └──────────────────────────────┘
                                   ▲
                                   │ webhook
                    ┌──────────────┴───────────────┐
                    │ Wompi                        │
                    └──────────────────────────────┘
```

**Por qué el backend no puede ir en Vercel tal como está.** Vercel ejecuta
funciones serverless: cada petición arranca un proceso efímero que muere al
responder. El backend abre un *pool* de hasta 10 conexiones MySQL al
arrancar y las reutiliza; en serverless eso significa que cada invocación
abre conexiones nuevas, y una base con límite de 50 conexiones se satura con
unas pocas peticiones concurrentes. Portarlo exigiría reescribir la capa de
datos con un driver HTTP o un *pooler* externo.

### Opciones para el backend

| Opción | Costo | Esfuerzo | Nota |
|---|---|---|---|
| **Railway / Render** | Capa gratuita limitada | Bajo | Detectan Node automáticamente; HTTPS y dominio incluidos. Lo más rápido |
| **Fly.io** | Capa gratuita | Medio | Requiere Dockerfile |
| **VPS** (Hostinger, DigitalOcean) | Desde ~5 USD/mes | Alto | Control total. Usar los archivos de `despliegue/` |

Para MySQL gestionado: Railway, Aiven, PlanetScale o el MySQL que incluya el
hosting contratado.

---

## 3. Pasos del despliegue

### 3.1 Backend

**En Railway o Render** (camino corto):

1. Subir el proyecto a GitHub.
2. Crear un servicio nuevo apuntando a la carpeta `backend/`.
3. Añadir una base MySQL desde el mismo panel.
4. Cargar las variables de `backend/.env.produccion.ejemplo` en el panel de
   variables de entorno del servicio. **Nunca subir el `.env` al repositorio.**
5. Ejecutar el esquema una sola vez:
   ```bash
   npm run bd:crear
   npm run bd:semilla   # opcional: datos de demostración
   ```
6. Asignar el subdominio `api.dataforma.online` y apuntarlo con un registro
   CNAME desde el panel DNS.

**En un VPS:**

```bash
sudo useradd -m -d /var/www/autopart autopart
sudo -u autopart git clone <repo> /var/www/autopart
cd /var/www/autopart/backend && npm ci --omit=dev

# Configuración, fuera del repositorio
sudo -u autopart cp .env.produccion.ejemplo .env
sudo -u autopart nano .env          # completar valores
sudo chmod 600 .env

# Servicio y proxy
sudo cp ../despliegue/autopart-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now autopart-api

sudo cp ../despliegue/nginx-api.conf /etc/nginx/sites-available/autopart-api
sudo ln -s /etc/nginx/sites-available/autopart-api /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.dataforma.online
sudo nginx -t && sudo systemctl reload nginx
```

### 3.2 Frontend en Vercel

1. En `frontend/vercel.json`, reemplazar las dos apariciones de `API_HOST`
   por el dominio real del backend:

   ```json
   "destination": "https://api.dataforma.online/api/:ruta*"
   ```

   Con ese *rewrite* el navegador sigue pidiendo `/api/...` al mismo origen
   y Vercel lo reenvía por detrás. Así no hace falta configurar CORS ni
   exponer la URL del backend en el código del cliente.

2. Importar el repositorio en Vercel con **Root Directory** = `frontend`.
3. Verificar que el dominio `www.dataforma.online` esté asignado al proyecto.
4. Desplegar.

### 3.3 Comprobaciones

```bash
curl https://api.dataforma.online/api/salud
# → {"estado":"ok","servicio":"AutoPart Pro API","version":"1.0.0"}

curl https://www.dataforma.online/api/salud
# → lo mismo, si el rewrite de Vercel quedó bien

curl -I https://www.dataforma.online/catalogo
# → 200, no 404: confirma que el fallback a index.html funciona
```

---

## 4. Activar cobros reales

### 4.1 Lo que tienes que hacer tú

Estos pasos no los puede hacer nadie en tu nombre: exigen tu identidad y tus
datos bancarios.

1. **Registrar el comercio** en `https://comercios.wompi.co` con tu cédula o
   el NIT de la empresa. Wompi revisa la documentación; la aprobación no es
   instantánea.
2. **Registrar la cuenta bancaria** de destino en el panel de Wompi. Ellos la
   validan contra los documentos del comercio.
3. **Copiar las llaves de producción** (`pub_prod_…`, `prv_prod_…`, secreto
   de integridad, secreto de eventos) y cargarlas como variables de entorno
   en el servidor del backend.
4. **Registrar el webhook** en el panel de Wompi:
   ```
   https://api.dataforma.online/api/pagos/webhook
   ```

La cuenta bancaria **no se configura en el código**. No existe ningún campo
para ella en este backend, ni debe existir: el dinero nunca pasa por tu
servidor. Wompi cobra, descuenta su comisión y gira a la cuenta que tiene
registrada.

### 4.2 Cambiar el modo

Una sola variable:

```bash
WOMPI_MODO=produccion
```

El backend lo avisa al arrancar:

```
✓ Pasarela Wompi lista — ⚠  MODO PRODUCCIÓN: los cobros son reales
```

El valor por defecto es `pruebas`, y cualquier cadena distinta de
`produccion` se trata como pruebas. Es deliberado: un error de tecleo no
debe acabar cobrando dinero de verdad.

### 4.3 Producto de prueba

Para crear un artículo barato con el que validar el flujo:

```sql
INSERT INTO productos
  (sku, nombre, descripcion, categoria_id, precio, stock, stock_minimo, activo)
VALUES
  ('TEST-PAGO-001', 'Prueba de pasarela',
   'Artículo creado únicamente para validar la pasarela de pagos.',
   1, 5000, 1, 0, 1);
```

**Sobre el monto.** Wompi aplica un mínimo por transacción, y 100 COP casi
con certeza queda por debajo. No tengo el valor exacto; hay que consultarlo
en su documentación antes de montar la prueba. Además:

- Al total del producto se le suma el **IVA del 19%** y, si el subtotal no
  llega a $200.000, **$15.000 de envío**. Un producto de $5.000 termina
  cobrando $20.950.
- Para que el monto final sea exactamente el deseado hay que ajustar las
  constantes `TASA_IVA` y `UMBRAL_ENVIO_GRATIS` en
  `backend/src/modelos/PedidoModelo.js`, o crear el pedido con el envío ya
  cubierto.

### 4.4 Después de la prueba

```bash
WOMPI_MODO=pruebas
```

Y dar de baja el producto de prueba:

```sql
UPDATE productos SET activo = 0 WHERE sku = 'TEST-PAGO-001';
```

---

## 5. Pendientes antes de aceptar dinero real

Lo que está bien para una demostración local no basta cuando hay cobros de
por medio.

| Pendiente | Por qué importa |
|---|---|
| Límite de intentos de acceso | Sin `express-rate-limit`, `/api/auth/acceso` acepta miles de intentos por minuto |
| Cabeceras de seguridad | `helmet` añade protecciones que hoy faltan en la API |
| Registro a archivo | Los `console.log` se pierden al reiniciar; ante una disputa de pago hay que poder reconstruir qué pasó |
| Respaldos de la base | Un pedido pagado y perdido es dinero cobrado sin entregar |
| Credenciales de demostración | `admin@autopartpro.co` con contraseña conocida y publicada en el repositorio |
| Datos de prueba | Los 25 repuestos son ficticios: fabricantes, precios y compatibilidades inventados |
| Página de términos y política de datos | Exigidas por la Ley 1581 de 2012 en Colombia para tratar datos personales |

El último punto es el más serio: cobrar a una persona real implica tratar
sus datos personales, y eso tiene requisitos legales.

---

## 6. Recomendación

Para la entrega del 13 de noviembre, **el sandbox es suficiente y es lo que
pide el enunciado** («Integración de un entorno de pruebas (Sandbox)»). Un
cobro real no suma nota y mete trámites de días: aprobación del comercio,
validación bancaria, contratación de hosting.

Si quieres hacer la prueba real, hazla **después de entregar**, con el
sistema ya desplegado y sin la presión de la fecha.
