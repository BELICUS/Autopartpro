# Despliegue en nunez.cloud — guía paso a paso

Todo en un solo VPS: Nginx sirve el frontend compilado y reenvía `/api` al
backend Node, que corre junto con MariaDB en la misma máquina. Sin Vercel,
sin servicios externos de pago — el método de pago activo es **transferencia
bancaria a tu cuenta Nequi**, que ya está configurado y no depende de que
nadie te apruebe nada.

Todos los comandos de este documento se ejecutan **por SSH, dentro del
VPS**, salvo el primer bloque (subir el código) que se ejecuta desde tu
máquina local.

---

## 0. Antes de empezar

Necesitas:
- La IP o el hostname SSH de tu VPS, y el usuario con el que entras
  (`ssh usuario@nunez.cloud` o `ssh usuario@IP`).
- Acceso al panel donde administras el DNS de `nunez.cloud` (donde lo
  registraste o donde apuntaste sus nameservers).

Primero entra y confirma qué sistema operativo tiene:

```bash
ssh tu_usuario@nunez.cloud
cat /etc/os-release | grep PRETTY_NAME
```

Este documento asume **Ubuntu o Debian** (comandos `apt`). Si tu VPS da
otra cosa (CentOS/AlmaLinux/Rocky), dime exactamente qué imprimió ese
comando y te paso la versión con `dnf`/`yum`.

---

## 1. Subir el código al VPS

Desde tu máquina local (no por SSH), con el proyecto ya en
`/home/dylan/Documents/borrador/programacion orientada a la web/proyecto_final`:

```bash
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  "/home/dylan/Documents/borrador/programacion orientada a la web/proyecto_final/" \
  tu_usuario@nunez.cloud:/home/tu_usuario/autopart-subida/
```

Esto copia el proyecto (sin `node_modules` ni `.git`) a una carpeta
temporal en el servidor. El `.env` real no existe en tu máquina en un lugar
versionado — lo vas a crear directo en el servidor en el paso 5.

---

## 2. Preparar el VPS

Ya dentro por SSH:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# MariaDB
sudo apt install -y mariadb-server

# Nginx y certificados
sudo apt install -y nginx certbot python3-certbot-nginx

node -v && npm -v && mysql --version
```

### Asegurar MariaDB

Si es una instalación nueva, MariaDB no tiene contraseña en `root` y eso
hay que cerrarlo:

```bash
sudo mysql_secure_installation
```

Responde "sí" a todo (poner contraseña a root, quitar usuarios anónimos,
deshabilitar acceso remoto de root, quitar la base de prueba).

---

## 3. Crear la base de datos

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE autopart_pro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'autopart_user'@'localhost'
  IDENTIFIED BY 'escribe_aquí_una_contraseña_robusta';

GRANT ALL PRIVILEGES ON autopart_pro.*
  TO 'autopart_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

Anota esa contraseña — la necesitas en el paso siguiente.

---

## 4. Instalar el proyecto en su ubicación final

```bash
sudo mkdir -p /var/www/autopart
sudo chown -R $USER:$USER /var/www/autopart
cp -r ~/autopart-subida/* /var/www/autopart/
cd /var/www/autopart/backend
npm ci --omit=dev
```

---

## 5. Configurar el backend

```bash
cd /var/www/autopart/backend
cp .env.produccion.ejemplo .env
nano .env
```

Completa, como mínimo:

```bash
BD_CONTRASENA=la_contraseña_que_pusiste_en_el_paso_3
JWT_SECRETO=   # generar con el comando de abajo
```

Genera el secreto JWT y pégalo en el archivo:

```bash
openssl rand -hex 32
```

Los datos de Nequi ya vienen escritos en la plantilla
(`BANCO_NOMBRE=Nequi`, `BANCO_NUMERO_CUENTA=3004986676`,
`BANCO_TITULAR=Dylan Nuñez`) — no hace falta tocarlos a menos que quieras
cambiarlos.

Deja `WOMPI_MODO=pruebas` y las llaves de Wompi vacías: el sitio funciona
igual con transferencia bancaria como único método, sin pedirle nada a
Wompi.

Protege el archivo:

```bash
chmod 600 .env
```

---

## 6. Crear las tablas y los datos

```bash
cd /var/www/autopart/backend
npm run bd:crear
npm run bd:semilla          # catálogo de demostración, 25 repuestos
mysql -u autopart_user -p autopart_pro < sql/producto-prueba-pasarela.sql
```

Esto deja el producto `TEST-PAGO-001` a $3.000 COP para la prueba de pago
real.

**Antes de seguir, cambia la contraseña del administrador.** La que trae
`bd:semilla` (`Admin2026*`) está documentada en el `README.md` del
repositorio — una vez el sitio es público, cualquiera que mire el código
la conoce.

```bash
cd /var/www/autopart/backend
node -e "
import('bcryptjs').then(async (m) => {
  const hash = await m.default.hash('TU_CONTRASEÑA_NUEVA_Y_SEGURA', 10);
  console.log(hash);
});"
```

Copia el hash que imprime y:

```bash
mysql -u autopart_user -p autopart_pro -e "
  UPDATE usuarios SET contrasena = 'PEGA_AQUÍ_EL_HASH'
  WHERE email = 'admin@autopartpro.co';"
```

---

## 7. Dejar el backend corriendo siempre (systemd)

```bash
sudo cp /var/www/autopart/despliegue/autopart-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now autopart-api
sudo systemctl status autopart-api
```

Debe decir `active (running)`. Si no:

```bash
sudo journalctl -u autopart-api -n 50
```

---

## 8. Compilar el frontend

```bash
cd /var/www/autopart/frontend
npm ci
npm run build
```

Esto genera `/var/www/autopart/frontend/dist/`, que es justo la carpeta que
Nginx va a servir.

---

## 9. Configurar Nginx

```bash
sudo cp /var/www/autopart/despliegue/nginx-nunez-cloud.conf \
  /etc/nginx/sites-available/nunez.cloud
sudo ln -s /etc/nginx/sites-available/nunez.cloud /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
```

`nginx -t` va a fallar la primera vez porque todavía no existe el
certificado SSL — es normal, se resuelve en el paso siguiente.

---

## 10. Apuntar el dominio al VPS

En el panel donde administras el DNS de `nunez.cloud` (fuera del VPS, en
el proveedor donde registraste o delegaste el dominio), crea:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` (o `nunez.cloud`) | la IP pública de tu VPS |
| A | `www` | la misma IP |

Para saber la IP del VPS:

```bash
curl -4 ifconfig.me
```

Los cambios de DNS pueden tardar desde minutos hasta un par de horas en
propagarse. Verifica con:

```bash
dig +short nunez.cloud
```

Cuando esa IP coincida con la del VPS, sigue al paso 11.

---

## 11. Certificado HTTPS

```bash
sudo certbot --nginx -d nunez.cloud -d www.nunez.cloud
sudo nginx -t && sudo systemctl reload nginx
```

Certbot pregunta un correo de contacto y si quieres redirigir HTTP a
HTTPS — di que sí.

---

## 12. Comprobación final

```bash
curl https://nunez.cloud/api/salud
# → {"estado":"ok","servicio":"AutoPart Pro API","version":"1.0.0"}

curl -I https://nunez.cloud/
# → 200
```

Desde el navegador:

1. Entra a `https://nunez.cloud`.
2. Busca el producto `TEST-PAGO-001` (o navega directo si le pusiste una
   categoría visible).
3. Agrégalo al carrito y ve al checkout.
4. Confirma el pedido — como no hay Wompi configurado, el sitio te lleva
   derecho a la pantalla con los datos de Nequi y el total a transferir.
5. Desde tu propio Nequi, transfiere los $3.000 a la cuenta `3004986676`
   usando el número de pedido como referencia.
6. Entra como administrador (`https://nunez.cloud/admin`), pestaña
   **Pedidos**, busca ese pedido y cambia su estado a `pagado`.

Con eso el pago real ya pasó: salió de tu Nequi y volvió a tu Nequi, y el
sistema lo registró de punta a punta — carrito, pedido, descuento de
inventario y confirmación manual.

---

## 13. Mantenimiento

**Actualizar el código tras un cambio:**

```bash
# en tu máquina local
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  "/home/dylan/Documents/borrador/programacion orientada a la web/proyecto_final/" \
  tu_usuario@nunez.cloud:/home/tu_usuario/autopart-subida/

# en el VPS
cp -r ~/autopart-subida/backend/* /var/www/autopart/backend/
cp -r ~/autopart-subida/frontend/* /var/www/autopart/frontend/
cd /var/www/autopart/backend && npm ci --omit=dev
cd /var/www/autopart/frontend && npm ci && npm run build
sudo systemctl restart autopart-api
```

**Ver los registros del backend en vivo:**

```bash
sudo journalctl -u autopart-api -f
```

**Dar de baja el producto de prueba cuando termines:**

```bash
mysql -u autopart_user -p autopart_pro -e "
  UPDATE productos SET activo = 0 WHERE sku = 'TEST-PAGO-001';"
```

---

## 14. Si más adelante quieres activar Wompi

El sitio ya funciona con transferencia. Wompi (tarjeta/PSE) es un método
adicional, no un reemplazo. Cuando tengas el comercio aprobado:

1. Llaves de producción en `/var/www/autopart/backend/.env`
   (`WOMPI_MODO=produccion` + las cuatro llaves).
2. `sudo systemctl restart autopart-api`
3. Registra el webhook en el panel de Wompi:
   `https://nunez.cloud/api/pagos/webhook`

La cuenta bancaria para esos cobros se registra en el panel de Wompi, no
aquí — es independiente de la cuenta Nequi que ya configuramos para
transferencia manual.
