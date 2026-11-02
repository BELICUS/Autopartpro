# Diccionario de datos — AutoPart Pro

Base de datos: `autopart_pro` · Motor: MySQL 8 / MariaDB 10.4+
Codificación: `utf8mb4` · Cotejamiento: `utf8mb4_unicode_ci` · Motor de tablas: InnoDB

InnoDB se usa en todas las tablas porque es el único motor de MySQL que
soporta llaves foráneas y transacciones, y el sistema depende de ambas: un
pedido debe crearse y descontar inventario como una sola operación atómica.

---

## Resumen de entidades

| # | Tabla | Registros de prueba | Función |
|---|---|---|---|
| 1 | `usuarios` | 2 | Clientes y personal administrativo |
| 2 | `categorias` | 7 | Sistema del vehículo al que pertenece el repuesto |
| 3 | `fabricantes` | 9 | Marca del repuesto (Bosch, NGK…) |
| 4 | `marcas_vehiculo` | 6 | Marca del automóvil (Chevrolet, Renault…) |
| 5 | `modelos_vehiculo` | 17 | Modelo dentro de una marca |
| 6 | `vehiculos` | 20 | Generación concreta: modelo + años + motor |
| 7 | `productos` | 25 | El repuesto |
| 8 | `compatibilidades` | 375 | Puente N:M entre repuestos y generaciones |
| 9 | `pedidos` | — | Cabecera de la venta |
| 10 | `pedido_detalles` | — | Líneas del pedido |
| 11 | `movimientos_inventario` | 25 | Bitácora de existencias (kardex) |

Más la vista `vista_alertas_stock`, que no almacena datos.

---

## 1. `usuarios`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `nombre` | VARCHAR(60) | No | — | Nombres |
| `apellido` | VARCHAR(60) | No | — | Apellidos |
| `email` | VARCHAR(120) | No | — | Correo. Único; es el identificador de acceso |
| `contrasena` | VARCHAR(255) | No | — | Hash bcrypt de 60 caracteres. Nunca texto plano |
| `telefono` | VARCHAR(20) | Sí | NULL | Contacto |
| `documento` | VARCHAR(20) | Sí | NULL | Cédula o NIT para facturación |
| `direccion` | VARCHAR(160) | Sí | NULL | Dirección habitual de envío |
| `ciudad` | VARCHAR(60) | Sí | NULL | Ciudad |
| `rol` | ENUM | No | `'cliente'` | `cliente` \| `administrador` |
| `activo` | TINYINT(1) | No | 1 | Baja lógica |
| `creado_en` | TIMESTAMP | No | CURRENT_TIMESTAMP | Fecha de registro |

**Restricciones:** PK `id` · UNIQUE `uq_usuarios_email (email)`

**Nota de diseño.** El campo se llama `contrasena` pero guarda un hash, no la
contraseña. Se usa bcrypt con coste 10: es deliberadamente lento, lo que
encarece un ataque por fuerza bruta aunque alguien se lleve la tabla entera.
El rol se guarda aquí y nunca se acepta desde la petición HTTP, porque un
cliente podría enviar `rol: "administrador"` al registrarse.

---

## 2. `categorias`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `nombre` | VARCHAR(60) | No | — | Frenos, Filtros, Motor… |
| `slug` | VARCHAR(60) | No | — | Identificador para URL amigable. Único |
| `descripcion` | VARCHAR(255) | Sí | NULL | Qué agrupa la categoría |
| `activo` | TINYINT(1) | No | 1 | Baja lógica |

**Restricciones:** PK `id` · UNIQUE `uq_categorias_slug (slug)`

---

## 3. `fabricantes`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `nombre` | VARCHAR(60) | No | — | Bosch, NGK, Mahle… Único |
| `pais` | VARCHAR(60) | Sí | NULL | País de origen |

**Restricciones:** PK `id` · UNIQUE `uq_fabricantes_nombre (nombre)`

**Por qué está separada de `marcas_vehiculo`.** Son conceptos distintos que
se confunden con facilidad: Bosch fabrica el repuesto, Chevrolet fabrica el
carro. Mezclarlos en una sola tabla obligaría a filtrar por tipo en cada
consulta y permitiría estados imposibles, como un repuesto cuyo fabricante
sea un modelo de automóvil.

---

## 4. `marcas_vehiculo`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `nombre` | VARCHAR(60) | No | — | Chevrolet, Renault, Mazda… Único |

**Restricciones:** PK `id` · UNIQUE `uq_marcas_vehiculo_nombre (nombre)`

---

## 5. `modelos_vehiculo`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `marca_id` | INT UNSIGNED | No | — | FK → `marcas_vehiculo.id` |
| `nombre` | VARCHAR(60) | No | — | Spark GT, Logan, Mazda 3… |

**Restricciones:**
- PK `id`
- UNIQUE `uq_modelos_marca_nombre (marca_id, nombre)` — un modelo no se repite dentro de la misma marca
- FK `fk_modelos_marca` → `marcas_vehiculo(id)` ON DELETE CASCADE

---

## 6. `vehiculos`

Representa una **generación**: un modelo durante un rango de años con una
motorización concreta. Es la unidad contra la que se declara compatibilidad.

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `modelo_id` | INT UNSIGNED | No | — | FK → `modelos_vehiculo.id` |
| `anio_inicio` | SMALLINT UNSIGNED | No | — | Primer año de producción |
| `anio_fin` | SMALLINT UNSIGNED | No | — | Último año de producción |
| `motor` | VARCHAR(30) | No | — | Cilindraje, p. ej. `1.4L` |
| `combustible` | ENUM | No | `'gasolina'` | `gasolina` \| `diesel` \| `hibrido` \| `electrico` |

**Restricciones:**
- PK `id`
- UNIQUE `uq_vehiculos (modelo_id, anio_inicio, anio_fin, motor)`
- FK `fk_vehiculos_modelo` → `modelos_vehiculo(id)` ON DELETE CASCADE
- CHECK `ck_vehiculos_anios (anio_fin >= anio_inicio)`
- INDEX `idx_vehiculos_anios (anio_inicio, anio_fin)`

**Por qué un rango y no un año suelto.** Un Spark GT 2011 y uno 2016 montan
el mismo repuesto: son la misma generación. Guardar una fila por año
multiplicaría por seis las filas de `vehiculos` y por seis las de
`compatibilidades`, sin añadir información. El buscador resuelve el año con
`? BETWEEN anio_inicio AND anio_fin`, apoyado en el índice.

---

## 7. `productos`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `sku` | VARCHAR(30) | No | — | Referencia interna. Única. Formato `CAT-TIP-NNN` |
| `nombre` | VARCHAR(140) | No | — | Nombre comercial |
| `descripcion` | TEXT | Sí | NULL | Ficha técnica |
| `categoria_id` | INT UNSIGNED | No | — | FK → `categorias.id` |
| `fabricante_id` | INT UNSIGNED | Sí | NULL | FK → `fabricantes.id` |
| `precio` | DECIMAL(12,2) | No | — | Precio de lista en COP |
| `precio_oferta` | DECIMAL(12,2) | Sí | NULL | NULL si no está en promoción |
| `stock` | INT | No | 0 | Existencia actual |
| `stock_minimo` | INT | No | 5 | Umbral que dispara la alerta |
| `ubicacion_bodega` | VARCHAR(30) | Sí | NULL | Pasillo-estante, p. ej. `A-03` |
| `imagen` | VARCHAR(120) | Sí | NULL | Nombre del archivo en `/publico/imagenes` |
| `activo` | TINYINT(1) | No | 1 | Baja lógica |
| `creado_en` | TIMESTAMP | No | CURRENT_TIMESTAMP | Alta |
| `actualizado_en` | TIMESTAMP | No | ON UPDATE CURRENT_TIMESTAMP | Última modificación |

**Restricciones:**
- PK `id` · UNIQUE `uq_productos_sku (sku)`
- FK `fk_productos_categoria` → `categorias(id)` ON DELETE RESTRICT
- FK `fk_productos_fabricante` → `fabricantes(id)` ON DELETE SET NULL
- CHECK `ck_productos_precio (precio >= 0)` · CHECK `ck_productos_stock (stock >= 0)`
- INDEX `idx_productos_categoria`, `idx_productos_activo_stock (activo, stock)`
- FULLTEXT `ft_productos_busqueda (nombre, descripcion)`

**Por qué `DECIMAL` y no `FLOAT`.** `FLOAT` y `DOUBLE` son binarios y no
representan exactamente los decimales de base 10: sumar precios acumularía
centavos de error. `DECIMAL(12,2)` guarda el valor exacto, que es obligatorio
en cualquier dato monetario.

**Por qué dos políticas distintas de borrado.** Un producto no puede quedarse
sin categoría, así que la FK es `RESTRICT`: MySQL impide borrar una categoría
en uso. El fabricante sí es opcional, y por eso es `SET NULL`: si se elimina
Bosch del catálogo, sus productos sobreviven sin fabricante asignado.

---

## 8. `compatibilidades`

Tabla puente que resuelve la relación muchos-a-muchos entre repuestos y
generaciones de vehículo.

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `producto_id` | INT UNSIGNED | No | — | FK → `productos.id` |
| `vehiculo_id` | INT UNSIGNED | No | — | FK → `vehiculos.id` |
| `nota` | VARCHAR(140) | Sí | NULL | Salvedad de montaje, si aplica |

**Restricciones:**
- PK compuesta `(producto_id, vehiculo_id)`
- FK `fk_compat_producto` → `productos(id)` ON DELETE CASCADE
- FK `fk_compat_vehiculo` → `vehiculos(id)` ON DELETE CASCADE
- INDEX `idx_compat_vehiculo (vehiculo_id)`

**Por qué la llave primaria es compuesta.** Un par producto-vehículo no puede
repetirse, y usarlo como PK lo garantiza sin necesidad de una columna `id`
extra ni de un índice único adicional. De paso, InnoDB agrupa físicamente las
filas por esa llave, lo que acelera la consulta más frecuente: «todas las
compatibilidades de este producto».

**Por qué `idx_compat_vehiculo`.** La PK compuesta sirve para buscar por
`producto_id`, pero el buscador recorre en sentido contrario: parte del
vehículo y pregunta qué productos le sirven. Ese índice es el que hace
eficiente esa dirección.

---

## 9. `pedidos`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `numero` | VARCHAR(24) | No | — | Consecutivo visible `APP-2026-00014`. Único |
| `usuario_id` | INT UNSIGNED | No | — | FK → `usuarios.id` |
| `estado` | ENUM | No | `'pendiente'` | `pendiente` \| `pagado` \| `preparando` \| `enviado` \| `entregado` \| `cancelado` |
| `subtotal` | DECIMAL(12,2) | No | — | Suma de las líneas, sin impuestos |
| `iva` | DECIMAL(12,2) | No | 0 | 19% en Colombia |
| `envio` | DECIMAL(12,2) | No | 0 | Costo de envío. 0 sobre $200.000 |
| `total` | DECIMAL(12,2) | No | — | subtotal + iva + envio |
| `direccion_envio` | VARCHAR(160) | No | — | Dirección de entrega |
| `ciudad` | VARCHAR(60) | No | — | Ciudad de entrega |
| `telefono` | VARCHAR(20) | No | — | Contacto para la entrega |
| `metodo_pago` | VARCHAR(30) | Sí | NULL | `wompi`, `transferencia`… |
| `referencia_pago` | VARCHAR(80) | Sí | NULL | Referencia única enviada a la pasarela |
| `transaccion_id` | VARCHAR(80) | Sí | NULL | ID que devuelve la pasarela |
| `creado_en` | TIMESTAMP | No | CURRENT_TIMESTAMP | Fecha del pedido |
| `actualizado_en` | TIMESTAMP | No | ON UPDATE CURRENT_TIMESTAMP | Último cambio de estado |

**Restricciones:**
- PK `id` · UNIQUE `uq_pedidos_numero (numero)`
- FK `fk_pedidos_usuario` → `usuarios(id)` ON DELETE RESTRICT
- INDEX `idx_pedidos_usuario`, `idx_pedidos_estado`, `idx_pedidos_referencia`

**Por qué se guardan subtotal, IVA, envío y total si el total es la suma.**
Porque las reglas cambian. Si mañana el IVA sube o el umbral de envío gratis
se mueve, un pedido de hace seis meses debe seguir mostrando lo que el cliente
pagó entonces. Recalcularlo al vuelo reescribiría la historia.

**Por qué `RESTRICT` sobre el usuario.** Borrar un cliente con pedidos dejaría
ventas sin dueño y rompería la contabilidad. Para dar de baja a alguien se usa
`usuarios.activo = 0`.

---

## 10. `pedido_detalles`

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `pedido_id` | INT UNSIGNED | No | — | FK → `pedidos.id` |
| `producto_id` | INT UNSIGNED | No | — | FK → `productos.id` |
| `nombre_producto` | VARCHAR(140) | No | — | Copia histórica del nombre |
| `sku_producto` | VARCHAR(30) | No | — | Copia histórica de la referencia |
| `cantidad` | INT | No | — | Unidades compradas |
| `precio_unitario` | DECIMAL(12,2) | No | — | Precio al momento de la compra |
| `subtotal` | DECIMAL(12,2) | No | — | cantidad × precio_unitario |

**Restricciones:**
- PK `id`
- FK `fk_detalle_pedido` → `pedidos(id)` ON DELETE CASCADE
- FK `fk_detalle_producto` → `productos(id)` ON DELETE RESTRICT
- CHECK `ck_detalle_cantidad (cantidad > 0)`
- INDEX `idx_detalle_pedido`

**Por qué se duplican nombre y SKU si ya están en `productos`.** Es
desnormalización deliberada. El nombre de un producto puede corregirse y su
precio cambia con frecuencia; la factura de un pedido entregado no puede
mutar con ellos. Se guarda la foto del momento de la venta.

**Por qué `CASCADE` hacia el pedido y `RESTRICT` hacia el producto.** Un
detalle no tiene sentido sin su pedido, así que se va con él. En cambio un
producto vendido alguna vez no puede borrarse: por eso los productos se dan
de baja con `activo = 0`.

---

## 11. `movimientos_inventario`

Kardex: toda variación de existencias deja una fila aquí.

| Columna | Tipo | Nulo | Predeterminado | Descripción |
|---|---|---|---|---|
| `id` | INT UNSIGNED | No | AUTO_INCREMENT | Llave primaria |
| `producto_id` | INT UNSIGNED | No | — | FK → `productos.id` |
| `tipo` | ENUM | No | — | `entrada` \| `salida` \| `ajuste` |
| `cantidad` | INT | No | — | Siempre positiva; el signo lo da `tipo` |
| `stock_resultante` | INT | No | — | Existencia después del movimiento |
| `motivo` | VARCHAR(140) | Sí | NULL | Razón del movimiento |
| `usuario_id` | INT UNSIGNED | Sí | NULL | Quién lo registró. FK → `usuarios.id` |
| `pedido_id` | INT UNSIGNED | Sí | NULL | Pedido que lo originó. FK → `pedidos.id` |
| `creado_en` | TIMESTAMP | No | CURRENT_TIMESTAMP | Fecha y hora |

**Restricciones:**
- PK `id`
- FK `fk_movimiento_producto` → `productos(id)` ON DELETE CASCADE
- FK `fk_movimiento_usuario` → `usuarios(id)` ON DELETE SET NULL
- FK `fk_movimiento_pedido` → `pedidos(id)` ON DELETE SET NULL
- CHECK `ck_movimiento_cantidad (cantidad > 0)`
- INDEX `idx_movimiento_producto (producto_id, creado_en)`

**Por qué se guarda `stock_resultante` si se podría calcular.** Permite
auditar: si la existencia de `productos` no coincide con el último
`stock_resultante`, hubo una escritura que no pasó por el procedimiento
correcto. Es una verificación barata que detecta errores de programación.

**Regla de integridad del módulo.** El campo `productos.stock` nunca se
modifica con un `UPDATE` suelto. Siempre pasa por
`InventarioModelo.registrarMovimiento()`, que actualiza la existencia y
escribe la bitácora dentro de la misma transacción. Esa función además hace
`SELECT … FOR UPDATE` sobre la fila del producto: sin ese bloqueo, dos
pedidos simultáneos de la última unidad leerían el mismo stock y ambos la
venderían.

---

## Vista `vista_alertas_stock`

No almacena datos. Devuelve los productos activos en o por debajo de su
mínimo, ya clasificados.

| Columna | Origen | Descripción |
|---|---|---|
| `id`, `sku`, `nombre` | `productos` | Identificación |
| `categoria` | `categorias.nombre` | Categoría |
| `stock`, `stock_minimo` | `productos` | Existencia y umbral |
| `faltante` | Calculada | `stock_minimo - stock` |
| `severidad` | Calculada | `agotado` si stock = 0; `critico` si stock ≤ mínimo/2; `bajo` en los demás casos |
| `ubicacion_bodega` | `productos` | Dónde está físicamente |

```sql
CREATE OR REPLACE VIEW vista_alertas_stock AS
SELECT
    p.id, p.sku, p.nombre, c.nombre AS categoria,
    p.stock, p.stock_minimo,
    (p.stock_minimo - p.stock) AS faltante,
    CASE
        WHEN p.stock = 0                   THEN 'agotado'
        WHEN p.stock <= p.stock_minimo / 2 THEN 'critico'
        ELSE                                    'bajo'
    END AS severidad,
    p.ubicacion_bodega
FROM productos p
JOIN categorias c ON c.id = p.categoria_id
WHERE p.activo = 1 AND p.stock <= p.stock_minimo;
```

**Por qué una vista y no la lógica en la aplicación.** La clasificación de
severidad es una regla del negocio, no de la interfaz. Puesta en la base, el
panel web, un reporte futuro y una consulta manual devuelven exactamente el
mismo criterio.

---

## Consulta central: búsqueda por marca, modelo y año

Es la consulta que justifica el modelo de compatibilidades. Recorre tres
tablas desde el vehículo hasta el producto:

```sql
SELECT DISTINCT p.id, p.sku, p.nombre,
       COALESCE(p.precio_oferta, p.precio) AS precio_final
FROM productos p
JOIN categorias c          ON c.id = p.categoria_id
JOIN compatibilidades comp ON comp.producto_id = p.id
JOIN vehiculos v           ON v.id = comp.vehiculo_id
JOIN modelos_vehiculo mo   ON mo.id = v.modelo_id
WHERE p.activo = 1
  AND p.stock > 0
  AND mo.marca_id = ?        -- marca seleccionada
  AND mo.id       = ?        -- modelo seleccionado
  AND ? BETWEEN v.anio_inicio AND v.anio_fin   -- año seleccionado
GROUP BY p.id
ORDER BY p.nombre;
```

El `DISTINCT` / `GROUP BY` es necesario: un repuesto compatible con varias
generaciones del mismo modelo aparecería repetido tras el JOIN.

Los tres filtros son independientes. Si solo llega la marca, las condiciones
de modelo y año no se añaden a la consulta; el modelo no exige completar los
tres niveles.

---

## Decisiones transversales

**`utf8mb4` en toda la base.** Es el único juego de caracteres de MySQL que
almacena los cuatro bytes completos de UTF-8. El antiguo `utf8`, de tres
bytes, pierde emojis y algunos símbolos técnicos en las descripciones.

**`INT UNSIGNED` en las llaves.** Duplica el rango positivo disponible
(0 a 4.294.967.295 en vez de ±2.147.483.647) sin ocupar más espacio, y
expresa que un identificador nunca es negativo.

**Baja lógica en vez de `DELETE`.** `usuarios`, `categorias` y `productos`
tienen columna `activo`. Borrar físicamente un registro referenciado por un
pedido histórico rompería la trazabilidad de las ventas.

**Nombres en español.** Tablas, columnas y restricciones siguen el mismo
idioma que el código de la aplicación. Mezclar `productos.price` con
`products.precio` es una fuente constante de errores de tecleo.
