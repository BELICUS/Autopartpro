# Despliegue en Railway con el dominio autopartpro.online

Sin servidor propio: Railway aloja el backend, el frontend y la base de
datos MySQL, cada uno como un servicio separado dentro de un mismo
proyecto. Todo se administra desde su panel web — no hace falta SSH,
Nginx ni systemd.

Railway necesita una cuenta tuya (`railway.app`) y, para el camino más
simple, un repositorio en GitHub. Ambas cuentas las creas tú — nadie puede
crearlas en tu nombre.

---

## 0. Antes de empezar

- [ ] Cuenta en `https://railway.app` (puedes entrar con GitHub directamente)
- [ ] Cuenta en `https://github.com` con el proyecto subido como repositorio
- [ ] Acceso al panel de DNS de Hostinger donde administras `autopartpro.online`

### Subir el proyecto a GitHub

Desde tu máquina, en la carpeta del proyecto:

```bash
cd "/home/dylan/Documents/borrador/programacion orientada a la web/proyecto_final"
git remote add origin https://github.com/TU_USUARIO/autopart-pro.git
git push -u origin main
```

(Si el repositorio en GitHub aún no existe, créalo primero desde su web,
vacío, sin README — luego corre lo de arriba.)

---

## 1. Crear el proyecto en Railway

1. En `railway.app`, **New Project → Deploy from GitHub repo**
2. Elige el repositorio que acabas de subir
3. Railway va a intentar desplegarlo como un solo servicio — lo vamos a
   convertir en tres (base de datos, backend, frontend). Sigue los pasos
   siguientes.

---

## 2. Base de datos MySQL

1. Dentro del proyecto: **+ New → Database → Add MySQL**
2. Railway la crea y la deja corriendo sola, sin configuración adicional
3. Click en el servicio MySQL → pestaña **Variables** — ahí están
   `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
   Los vas a necesitar (por referencia, no copiados a mano) en el paso 4.

---

## 3. Servicio del backend

1. **+ New → GitHub Repo** → el mismo repositorio
2. En **Settings** de ese servicio:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start` (ya está en `package.json`)
3. Railway detecta Node automáticamente por el `package.json` y corre
   `npm install` solo.

### Variables de entorno del backend

Pestaña **Variables** de este servicio → **Raw Editor** (o una por una):

```bash
# Base de datos: referencia al servicio MySQL, no valores copiados a mano.
# Railway resuelve ${{MySQL.MYSQLHOST}} al valor real del otro servicio.
BD_HOST=${{MySQL.MYSQLHOST}}
BD_PUERTO=${{MySQL.MYSQLPORT}}
BD_NOMBRE=${{MySQL.MYSQLDATABASE}}
BD_USUARIO=${{MySQL.MYSQLUSER}}
BD_CONTRASENA=${{MySQL.MYSQLPASSWORD}}

# Generar con: openssl rand -hex 32
JWT_SECRETO=pega_aquí_una_cadena_aleatoria_de_64_caracteres
JWT_EXPIRACION=8h

# Transferencia bancaria — ya probada, funciona sin Wompi.
BANCO_NOMBRE=Nequi
BANCO_TIPO_CUENTA=Ahorros
BANCO_NUMERO_CUENTA=3004986676
BANCO_TITULAR=Dylan Nuñez
BANCO_DOCUMENTO_TITULAR=

# Wompi — ya tienes llaves de producción. Pégalas aquí.
WOMPI_MODO=produccion
WOMPI_LLAVE_PUBLICA=pub_prod_...
WOMPI_LLAVE_PRIVADA=prv_prod_...
WOMPI_SECRETO_INTEGRIDAD=prod_integrity_...
WOMPI_SECRETO_EVENTOS=prod_events_...
WOMPI_URL_REDIRECCION=https://autopartpro.online/pago/resultado

# El origen del frontend — lo actualizas en el paso 6 una vez
# sepas la URL real que Railway le asignó.
ORIGEN_FRONTEND=https://autopartpro.online
```

> `PORT` no hay que definirlo — Railway lo inyecta solo, y el código ya lo
> lee automáticamente (ver `entorno.js`).

4. **Settings → Networking → Generate Domain** — Railway te da una URL
   pública tipo `https://autopart-backend-production.up.railway.app`.
   Anótala, la necesitas en el paso 5.

5. Carga las tablas. En **Settings** de este servicio, pestaña
   **Deploy → View Logs**, o desde tu máquina con la CLI de Railway:

   ```bash
   npm install -g @railway/cli
   railway login
   railway link      # selecciona este proyecto
   railway run --service backend npm run bd:crear
   railway run --service backend npm run bd:semilla
   ```

   (`railway login` abre tu navegador para autenticarte — lo haces tú.)

6. Cambia la contraseña del administrador de demo, igual que en cualquier
   otro despliegue público:

   ```bash
   railway run --service backend node -e "
   import('bcryptjs').then(async (m) => {
     console.log(await m.default.hash('TU_CONTRASEÑA_NUEVA', 10));
   });"
   ```

   Copia el hash y:

   ```bash
   railway connect MySQL
   ```

   ```sql
   UPDATE usuarios SET contrasena = 'PEGA_AQUÍ_EL_HASH'
   WHERE email = 'admin@autopartpro.co';
   ```

---

## 4. Servicio del frontend

1. **+ New → GitHub Repo** → el mismo repositorio otra vez
2. **Settings** de este servicio:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`

### Variable de entorno del frontend

```bash
# La URL pública del backend que anotaste en el paso 3.4, con /api al final.
VITE_API_URL=https://autopart-backend-production.up.railway.app/api
```

Esta variable se usa **al compilar** (`VITE_API_URL` queda incrustada en
el JavaScript del build), así que si la cambias más adelante hay que
volver a desplegar el frontend para que surta efecto — Railway lo hace
solo cada vez que guardas un cambio en Variables.

3. **Settings → Networking → Generate Domain** — anota también esta URL.

---

## 5. Probar con las URLs temporales de Railway

Antes de meter el dominio propio, confirma que los dos servicios se
hablan entre sí:

```bash
curl https://TU-BACKEND.up.railway.app/api/salud
```

Abre `https://TU-FRONTEND.up.railway.app` en el navegador, entra con
`admin@autopartpro.co` (con la contraseña nueva que pusiste), revisa el
catálogo y las imágenes.

Si las imágenes no cargan, revisa que `VITE_API_URL` tenga el sufijo
`/api` y que el backend respondió 200 en el `curl` de arriba.

---

## 6. Apuntar autopartpro.online

### En el panel de Hostinger (DNS de autopartpro.online)

1. En el servicio del **frontend**, Railway → **Settings → Networking →
   Custom Domain** → escribe `autopartpro.online` (o `www.autopartpro.online`).
   Railway te da un registro **CNAME** para apuntar.
2. En hPanel de Hostinger → tu dominio → **DNS / Nameservers**, agrega:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | CNAME | `@` o `www` | el que te dio Railway |

   (Si Hostinger no permite CNAME en `@`, usa `www.autopartpro.online` como
   dominio principal y agrega una redirección de `autopartpro.online` a
   `www.autopartpro.online` desde el mismo panel.)

3. Railway emite el certificado HTTPS solo, en cuanto detecta el DNS
   propagado — puede tardar de minutos a un par de horas.

4. Repite lo mismo para el backend si quieres un subdominio propio, por
   ejemplo `api.autopartpro.online` apuntando con CNAME al dominio de Railway del
   backend.

### Actualizar las variables con el dominio final

Una vez `autopartpro.online` y (si lo creaste) `api.autopartpro.online` respondan:

**Backend** → Variables:
```bash
ORIGEN_FRONTEND=https://autopartpro.online
WOMPI_URL_REDIRECCION=https://autopartpro.online/pago/resultado
```

**Frontend** → Variables:
```bash
VITE_API_URL=https://api.autopartpro.online/api
```

Railway vuelve a desplegar cada servicio automáticamente al guardar.

### Registrar el webhook de Wompi

Ahora que el backend tiene una URL pública real (ya no `localhost` ni un
túnel temporal), registra en el panel de Wompi:

```
https://api.autopartpro.online/api/pagos/webhook
```

Con esto la confirmación de pago deja de depender de que el comprador
vuelva por la redirección — Wompi avisa directo al backend.

---

## 7. Comprobación final

```bash
curl https://autopartpro.online
curl https://api.autopartpro.online/api/salud
curl https://api.autopartpro.online/api/pagos/estado
```

Y en el navegador: cuenta → catálogo → carrito → checkout → pago real con
Wompi, exactamente como lo probamos con el túnel, pero ahora en la URL
definitiva.

---

## 8. Actualizar el sitio tras un cambio de código

```bash
git add -A
git commit -m "lo que cambiaste"
git push
```

Railway redespliega los dos servicios automáticamente al detectar el
push — no hay paso manual.

---

## 9. Costos

Railway cobra por uso una vez se agota la capa gratuita (créditos
mensuales limitados). Con un proyecto de este tamaño (dos servicios
pequeños + MySQL) normalmente cabe en el plan gratuito para uso de
pruebas, pero revisa `railway.app/pricing` para la cifra actual — no
tengo esos números verificados y pueden cambiar.
