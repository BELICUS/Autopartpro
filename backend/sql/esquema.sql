-- ============================================================================
--  AutoPart Pro — Esquema relacional
--  Motor: MySQL 8 / MariaDB 10.4+   ·   Codificación: utf8mb4
--
--  El modelo gira alrededor de dos ejes:
--    1. El catálogo       : categorias → productos ← fabricantes
--    2. La compatibilidad : marcas_vehiculo → modelos_vehiculo → vehiculos
--                           y la tabla puente `compatibilidades`, que es la
--                           que permite buscar un repuesto por marca, modelo
--                           y año del carro.
--  La venta se registra en pedidos / pedido_detalles, y todo cambio de
--  existencias deja rastro en movimientos_inventario.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS pedido_detalles;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS compatibilidades;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS vehiculos;
DROP TABLE IF EXISTS modelos_vehiculo;
DROP TABLE IF EXISTS marcas_vehiculo;
DROP TABLE IF EXISTS fabricantes;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- usuarios — clientes y personal administrativo
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre        VARCHAR(60)  NOT NULL,
    apellido      VARCHAR(60)  NOT NULL,
    email         VARCHAR(120) NOT NULL,
    contrasena    VARCHAR(255) NOT NULL  COMMENT 'Hash bcrypt, nunca texto plano',
    telefono      VARCHAR(20)      NULL,
    documento     VARCHAR(20)      NULL  COMMENT 'Cédula o NIT para facturación',
    direccion     VARCHAR(160)     NULL,
    ciudad        VARCHAR(60)      NULL,
    rol           ENUM('cliente', 'administrador') NOT NULL DEFAULT 'cliente',
    activo        TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuarios_email UNIQUE (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- categorias — sistema del vehículo al que pertenece el repuesto
-- ----------------------------------------------------------------------------
CREATE TABLE categorias (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(60)  NOT NULL,
    slug        VARCHAR(60)  NOT NULL  COMMENT 'Identificador para URL amigable',
    descripcion VARCHAR(255)     NULL,
    activo      TINYINT(1)   NOT NULL DEFAULT 1,

    CONSTRAINT uq_categorias_slug UNIQUE (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- fabricantes — marca del repuesto (Bosch, NGK…), distinta de la marca del carro
-- ----------------------------------------------------------------------------
CREATE TABLE fabricantes (
    id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    pais   VARCHAR(60)     NULL,

    CONSTRAINT uq_fabricantes_nombre UNIQUE (nombre)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- marcas_vehiculo — Chevrolet, Renault, Mazda…
-- ----------------------------------------------------------------------------
CREATE TABLE marcas_vehiculo (
    id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,

    CONSTRAINT uq_marcas_vehiculo_nombre UNIQUE (nombre)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- modelos_vehiculo — Spark GT, Logan, Mazda 3…
-- ----------------------------------------------------------------------------
CREATE TABLE modelos_vehiculo (
    id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    marca_id INT UNSIGNED NOT NULL,
    nombre   VARCHAR(60)  NOT NULL,

    CONSTRAINT uq_modelos_marca_nombre UNIQUE (marca_id, nombre),
    CONSTRAINT fk_modelos_marca FOREIGN KEY (marca_id)
        REFERENCES marcas_vehiculo (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- vehiculos — una generación concreta: modelo + rango de años + motorización.
--             Es contra esta tabla que se resuelve la búsqueda por año.
-- ----------------------------------------------------------------------------
CREATE TABLE vehiculos (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    modelo_id   INT UNSIGNED NOT NULL,
    anio_inicio SMALLINT UNSIGNED NOT NULL,
    anio_fin    SMALLINT UNSIGNED NOT NULL  COMMENT 'Año final de producción de la generación',
    motor       VARCHAR(30)  NOT NULL       COMMENT 'Cilindraje, p. ej. 1.4L',
    combustible ENUM('gasolina', 'diesel', 'hibrido', 'electrico') NOT NULL DEFAULT 'gasolina',

    CONSTRAINT uq_vehiculos UNIQUE (modelo_id, anio_inicio, anio_fin, motor),
    CONSTRAINT fk_vehiculos_modelo FOREIGN KEY (modelo_id)
        REFERENCES modelos_vehiculo (id) ON DELETE CASCADE,
    CONSTRAINT ck_vehiculos_anios CHECK (anio_fin >= anio_inicio),

    INDEX idx_vehiculos_anios (anio_inicio, anio_fin)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- productos — el repuesto en sí
-- ----------------------------------------------------------------------------
CREATE TABLE productos (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sku              VARCHAR(30)  NOT NULL  COMMENT 'Código interno de referencia',
    nombre           VARCHAR(140) NOT NULL,
    descripcion      TEXT             NULL,
    categoria_id     INT UNSIGNED NOT NULL,
    fabricante_id    INT UNSIGNED     NULL,
    precio           DECIMAL(12,2) NOT NULL COMMENT 'Precio de lista en COP',
    precio_oferta    DECIMAL(12,2)    NULL  COMMENT 'NULL si no está en promoción',
    stock            INT          NOT NULL DEFAULT 0,
    stock_minimo     INT          NOT NULL DEFAULT 5  COMMENT 'Umbral que dispara la alerta',
    ubicacion_bodega VARCHAR(30)      NULL  COMMENT 'Pasillo-estante, p. ej. A-03',
    imagen           VARCHAR(120)     NULL  COMMENT 'Nombre del archivo en /publico/imagenes',
    activo           TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_productos_sku UNIQUE (sku),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id)
        REFERENCES categorias (id) ON DELETE RESTRICT,
    CONSTRAINT fk_productos_fabricante FOREIGN KEY (fabricante_id)
        REFERENCES fabricantes (id) ON DELETE SET NULL,
    CONSTRAINT ck_productos_precio CHECK (precio >= 0),
    CONSTRAINT ck_productos_stock  CHECK (stock >= 0),

    INDEX idx_productos_categoria (categoria_id),
    INDEX idx_productos_activo_stock (activo, stock),
    FULLTEXT INDEX ft_productos_busqueda (nombre, descripcion)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- compatibilidades — tabla puente N:M entre repuestos y generaciones de vehículo
-- ----------------------------------------------------------------------------
CREATE TABLE compatibilidades (
    producto_id INT UNSIGNED NOT NULL,
    vehiculo_id INT UNSIGNED NOT NULL,
    nota        VARCHAR(140)     NULL COMMENT 'Salvedad de montaje, si aplica',

    PRIMARY KEY (producto_id, vehiculo_id),
    CONSTRAINT fk_compat_producto FOREIGN KEY (producto_id)
        REFERENCES productos (id) ON DELETE CASCADE,
    CONSTRAINT fk_compat_vehiculo FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos (id) ON DELETE CASCADE,

    INDEX idx_compat_vehiculo (vehiculo_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- pedidos — cabecera de la venta
-- ----------------------------------------------------------------------------
CREATE TABLE pedidos (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero           VARCHAR(24)  NOT NULL  COMMENT 'Consecutivo visible, p. ej. APP-2026-00014',
    usuario_id       INT UNSIGNED NOT NULL,
    estado           ENUM('pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado')
                     NOT NULL DEFAULT 'pendiente',
    subtotal         DECIMAL(12,2) NOT NULL,
    iva              DECIMAL(12,2) NOT NULL DEFAULT 0  COMMENT 'IVA del 19% en Colombia',
    envio            DECIMAL(12,2) NOT NULL DEFAULT 0,
    total            DECIMAL(12,2) NOT NULL,
    direccion_envio  VARCHAR(160) NOT NULL,
    ciudad           VARCHAR(60)  NOT NULL,
    telefono         VARCHAR(20)  NOT NULL,
    metodo_pago      VARCHAR(30)      NULL  COMMENT 'PSE, tarjeta, Nequi…',
    referencia_pago  VARCHAR(80)      NULL  COMMENT 'Referencia única enviada a la pasarela',
    transaccion_id   VARCHAR(80)      NULL  COMMENT 'ID que devuelve la pasarela',
    creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_pedidos_numero UNIQUE (numero),
    CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT,

    INDEX idx_pedidos_usuario (usuario_id),
    INDEX idx_pedidos_estado (estado),
    INDEX idx_pedidos_referencia (referencia_pago)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- pedido_detalles — líneas del pedido.
--   El precio se copia al momento de la compra: si mañana sube, el pedido
--   histórico debe seguir mostrando lo que el cliente realmente pagó.
-- ----------------------------------------------------------------------------
CREATE TABLE pedido_detalles (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pedido_id       INT UNSIGNED NOT NULL,
    producto_id     INT UNSIGNED NOT NULL,
    nombre_producto VARCHAR(140) NOT NULL  COMMENT 'Copia histórica del nombre',
    sku_producto    VARCHAR(30)  NOT NULL,
    cantidad        INT          NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_detalle_pedido FOREIGN KEY (pedido_id)
        REFERENCES pedidos (id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id)
        REFERENCES productos (id) ON DELETE RESTRICT,
    CONSTRAINT ck_detalle_cantidad CHECK (cantidad > 0),

    INDEX idx_detalle_pedido (pedido_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- movimientos_inventario — bitácora de existencias (kardex)
-- ----------------------------------------------------------------------------
CREATE TABLE movimientos_inventario (
    id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    producto_id       INT UNSIGNED NOT NULL,
    tipo              ENUM('entrada', 'salida', 'ajuste') NOT NULL,
    cantidad          INT          NOT NULL COMMENT 'Siempre positiva; el signo lo da `tipo`',
    stock_resultante  INT          NOT NULL COMMENT 'Existencia después del movimiento',
    motivo            VARCHAR(140)     NULL,
    usuario_id        INT UNSIGNED     NULL COMMENT 'Quién lo registró; NULL si fue automático',
    pedido_id         INT UNSIGNED     NULL COMMENT 'Pedido que originó la salida',
    creado_en         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_movimiento_producto FOREIGN KEY (producto_id)
        REFERENCES productos (id) ON DELETE CASCADE,
    CONSTRAINT fk_movimiento_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT fk_movimiento_pedido FOREIGN KEY (pedido_id)
        REFERENCES pedidos (id) ON DELETE SET NULL,
    CONSTRAINT ck_movimiento_cantidad CHECK (cantidad > 0),

    INDEX idx_movimiento_producto (producto_id, creado_en)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Vista de alertas: productos activos en o por debajo de su stock mínimo.
-- Se expone tal cual en el panel administrativo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vista_alertas_stock AS
SELECT
    p.id,
    p.sku,
    p.nombre,
    c.nombre AS categoria,
    p.stock,
    p.stock_minimo,
    (p.stock_minimo - p.stock) AS faltante,
    CASE
        WHEN p.stock = 0                  THEN 'agotado'
        WHEN p.stock <= p.stock_minimo / 2 THEN 'critico'
        ELSE                                   'bajo'
    END AS severidad,
    p.ubicacion_bodega
FROM productos p
JOIN categorias c ON c.id = p.categoria_id
WHERE p.activo = 1
  AND p.stock <= p.stock_minimo;
