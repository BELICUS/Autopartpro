-- ============================================================================
--  AutoPart Pro — Datos de prueba
--
--  Los vehículos corresponden a modelos de alta circulación en Colombia, que
--  es lo que hace creíble la demostración del buscador por marca/modelo/año.
--  Los precios están en pesos colombianos.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE movimientos_inventario;
TRUNCATE TABLE pedido_detalles;
TRUNCATE TABLE pedidos;
TRUNCATE TABLE compatibilidades;
TRUNCATE TABLE productos;
TRUNCATE TABLE vehiculos;
TRUNCATE TABLE modelos_vehiculo;
TRUNCATE TABLE marcas_vehiculo;
TRUNCATE TABLE fabricantes;
TRUNCATE TABLE categorias;
TRUNCATE TABLE usuarios;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- usuarios --
-- Las contraseñas son hashes bcrypt. En claro:
--   admin@autopartpro.co    → Admin2026*
--   cliente@ejemplo.co      → Cliente2026*
-- Solo válidas en este entorno de desarrollo.
INSERT INTO usuarios (nombre, apellido, email, contrasena, telefono, documento, direccion, ciudad, rol) VALUES
('Dylan',  'Administrador', 'admin@autopartpro.co', '$2a$10$2B9zmtSXjtAgtrXhHbD0yOWVHe2fuzi3KeZRLqpdk0EpRTw7xiVRy', '3001234567', '1098765432', 'Carrera 30 # 45-12', 'Bogotá', 'administrador'),
('Camila', 'Rodríguez',     'cliente@ejemplo.co',   '$2a$10$ASLlDF2DLtXHzbEhNebo5ORMu2EF.heQUX8K.jWp7IBOPRIQCBO4G', '3109876543', '52987654',   'Calle 72 # 10-34',   'Bogotá', 'cliente');

-- -------------------------------------------------------------- categorías --
INSERT INTO categorias (nombre, slug, descripcion) VALUES
('Frenos',       'frenos',       'Pastillas, discos, bandas y líquido de frenos'),
('Filtros',      'filtros',      'Filtros de aceite, aire, combustible y cabina'),
('Motor',        'motor',        'Correas, bujías, bombas y empaquetaduras'),
('Suspensión',   'suspension',   'Amortiguadores, espirales, rótulas y bujes'),
('Eléctrico',    'electrico',    'Baterías, alternadores, motores de arranque y bombillos'),
('Transmisión',  'transmision',  'Embragues, aceites de caja y homocinéticas'),
('Refrigeración','refrigeracion','Radiadores, termostatos, bombas de agua y mangueras');

-- ------------------------------------------------------------ fabricantes --
INSERT INTO fabricantes (nombre, pais) VALUES
('Bosch',    'Alemania'),
('NGK',      'Japón'),
('Mahle',    'Alemania'),
('Monroe',   'Estados Unidos'),
('Valeo',    'Francia'),
('Gates',    'Estados Unidos'),
('Fram',     'Estados Unidos'),
('MK',       'Colombia'),
('Willard',  'Colombia');

-- -------------------------------------------------------- marcas y modelos --
INSERT INTO marcas_vehiculo (nombre) VALUES
('Chevrolet'), ('Renault'), ('Mazda'), ('Nissan'), ('Kia'), ('Toyota');

INSERT INTO modelos_vehiculo (marca_id, nombre) VALUES
-- Chevrolet
(1, 'Spark GT'), (1, 'Sail'), (1, 'Onix'), (1, 'Tracker'),
-- Renault
(2, 'Logan'), (2, 'Sandero'), (2, 'Duster'), (2, 'Kwid'),
-- Mazda
(3, 'Mazda 2'), (3, 'Mazda 3'), (3, 'CX-30'),
-- Nissan
(4, 'March'), (4, 'Versa'),
-- Kia
(5, 'Picanto'), (5, 'Rio'),
-- Toyota
(6, 'Hilux'), (6, 'Corolla');

-- --------------------------------------------------- generaciones y motores --
INSERT INTO vehiculos (modelo_id, anio_inicio, anio_fin, motor, combustible) VALUES
(1,  2011, 2017, '1.2L', 'gasolina'),   -- 1  Spark GT
(1,  2018, 2024, '1.2L', 'gasolina'),   -- 2
(2,  2013, 2019, '1.4L', 'gasolina'),   -- 3  Sail
(2,  2020, 2026, '1.5L', 'gasolina'),   -- 4
(3,  2017, 2026, '1.0L', 'gasolina'),   -- 5  Onix
(4,  2014, 2026, '1.8L', 'gasolina'),   -- 6  Tracker
(5,  2010, 2016, '1.6L', 'gasolina'),   -- 7  Logan
(6,  2012, 2019, '1.6L', 'gasolina'),   -- 8  Sandero
(7,  2013, 2026, '2.0L', 'gasolina'),   -- 9  Duster
(8,  2018, 2026, '1.0L', 'gasolina'),   -- 10 Kwid
(9,  2015, 2026, '1.5L', 'gasolina'),   -- 11 Mazda 2
(10, 2014, 2018, '2.0L', 'gasolina'),   -- 12 Mazda 3
(10, 2019, 2026, '2.0L', 'gasolina'),   -- 13
(11, 2020, 2026, '2.0L', 'gasolina'),   -- 14 CX-30
(12, 2013, 2023, '1.6L', 'gasolina'),   -- 15 March
(13, 2015, 2026, '1.6L', 'gasolina'),   -- 16 Versa
(14, 2012, 2017, '1.2L', 'gasolina'),   -- 17 Picanto
(15, 2018, 2026, '1.4L', 'gasolina'),   -- 18 Rio
(16, 2016, 2026, '2.4L', 'diesel'),     -- 19 Hilux
(17, 2014, 2026, '1.8L', 'gasolina');   -- 20 Corolla

-- ------------------------------------------------------------- productos ----
INSERT INTO productos
  (sku, nombre, descripcion, categoria_id, fabricante_id, precio, precio_oferta, stock, stock_minimo, ubicacion_bodega, imagen) VALUES

-- Frenos
('FRE-PAS-001', 'Pastillas de freno delanteras cerámicas',
 'Juego de 4 pastillas cerámicas de baja emisión de polvo. Menor ruido y mejor mordida en frío que las semimetálicas. Incluye láminas antichirrido.',
 1, 1, 185000, 159000, 42, 10, 'A-01', 'FRE-PAS-001.png'),

('FRE-DIS-002', 'Disco de freno ventilado 256 mm',
 'Disco ventilado de hierro fundido G3000 con tratamiento anticorrosivo. Balanceado para evitar vibración en el pedal.',
 1, 8, 142000, NULL, 8, 10, 'A-02', 'FRE-DIS-002.png'),

('FRE-BAN-003', 'Bandas de freno traseras',
 'Juego de bandas para freno de tambor con material libre de asbesto. Incluye resortes de retorno.',
 1, 8, 98000, NULL, 25, 8, 'A-03', 'FRE-BAN-003.png'),

('FRE-LIQ-004', 'Líquido de frenos DOT 4 — 500 ml',
 'Punto de ebullición en seco de 230 °C. Compatible con sistemas ABS. Reemplazar cada dos años.',
 1, 1, 32000, NULL, 60, 15, 'A-04', 'FRE-LIQ-004.png'),

-- Filtros
('FIL-ACE-001', 'Filtro de aceite roscado',
 'Medio filtrante sintético con válvula antirretorno que mantiene el aceite en el filtro y acorta el tiempo de presurización al arrancar.',
 2, 3, 28000, 24000, 85, 20, 'B-01', 'FIL-ACE-001.png'),

('FIL-AIR-002', 'Filtro de aire del motor',
 'Elemento plisado de alta superficie. Retiene partículas desde 5 micras sin restringir el flujo de admisión.',
 2, 7, 45000, NULL, 52, 15, 'B-02', 'FIL-AIR-002.png'),

('FIL-CAB-003', 'Filtro de cabina con carbón activado',
 'Retiene polvo, polen y olores. Recomendado cada 15.000 km, o antes en ciudades con tráfico denso.',
 2, 3, 52000, 44000, 38, 12, 'B-03', 'FIL-CAB-003.png'),

('FIL-COM-004', 'Filtro de combustible en línea',
 'Carcasa metálica con medio de 10 micras. Protege los inyectores de impurezas del tanque.',
 2, 1, 67000, NULL, 4, 10, 'B-04', 'FIL-COM-004.png'),

-- Motor
('MOT-BUJ-001', 'Bujías de iridio — juego x4',
 'Electrodo central de iridio de 0,6 mm. Vida útil estimada de 100.000 km y encendido más estable que el níquel.',
 3, 2, 128000, 112000, 46, 12, 'C-01', 'MOT-BUJ-001.png'),

('MOT-COR-002', 'Correa de repartición dentada',
 'Correa de caucho HNBR con refuerzo de fibra de vidrio. Cambio recomendado cada 60.000 km. Su falla causa daño grave al motor.',
 3, 6, 95000, NULL, 18, 8, 'C-02', 'MOT-COR-002.png'),

('MOT-BOM-003', 'Bomba de aceite',
 'Bomba de engranajes con válvula reguladora de presión. Caudal verificado en banco de pruebas.',
 3, 3, 285000, NULL, 6, 5, 'C-03', 'MOT-BOM-003.png'),

('MOT-EMP-004', 'Empaque de culata multicapa',
 'Empaque MLS de tres láminas de acero. Soporta mayor presión de compresión que los de grafito.',
 3, 3, 135000, NULL, 11, 6, 'C-04', 'MOT-EMP-004.png'),

-- Suspensión
('SUS-AMO-001', 'Amortiguador delantero a gas',
 'Amortiguador bitubo presurizado con nitrógeno. Reduce la aireación del aceite y mantiene la respuesta en recorridos largos.',
 4, 4, 215000, 189000, 24, 8, 'D-01', 'SUS-AMO-001.png'),

('SUS-ESP-002', 'Espiral de suspensión delantera',
 'Resorte de acero al silicio con recubrimiento epóxico. Altura y constante elástica según especificación de fábrica.',
 4, 4, 168000, NULL, 14, 6, 'D-02', 'SUS-ESP-002.png'),

('SUS-ROT-003', 'Rótula de suspensión inferior',
 'Rótula sellada con grasa de litio y guardapolvo de neopreno. Incluye tornillería.',
 4, 8, 76000, NULL, 3, 8, 'D-03', 'SUS-ROT-003.png'),

('SUS-BUJ-004', 'Juego de bujes de tijera',
 'Bujes de caucho-metal. Absorben vibración y eliminan el juego en la tijera.',
 4, 8, 58000, 49000, 32, 10, 'D-04', 'SUS-BUJ-004.png'),

-- Eléctrico
('ELE-BAT-001', 'Batería 12 V — 60 Ah',
 'Batería de plomo-ácido libre de mantenimiento, 500 A de arranque en frío. Garantía de 18 meses.',
 5, 9, 385000, 349000, 16, 5, 'E-01', 'ELE-BAT-001.png'),

('ELE-ALT-002', 'Alternador 90 A',
 'Alternador remanufacturado con regulador y rectificador nuevos. Probado en banco antes del despacho.',
 5, 1, 520000, NULL, 2, 4, 'E-02', 'ELE-ALT-002.png'),

('ELE-ARR-003', 'Motor de arranque',
 'Motor de arranque con reductora. Piñón y bendix nuevos.',
 5, 5, 445000, NULL, 5, 4, 'E-03', 'ELE-ARR-003.png'),

('ELE-BOM-004', 'Bombillos H4 halógenos — par',
 'Par de bombillos H4 de 60/55 W con mayor temperatura de color que el estándar. Homologados para vía pública.',
 5, 1, 48000, NULL, 70, 20, 'E-04', 'ELE-BOM-004.png'),

-- Transmisión
('TRA-EMB-001', 'Kit de embrague completo',
 'Incluye disco, prensa y balinera. Reemplazar las tres piezas juntas evita vibración y desgaste prematuro.',
 6, 5, 680000, 599000, 7, 4, 'F-01', 'TRA-EMB-001.png'),

('TRA-HOM-002', 'Homocinética lado rueda',
 'Junta homocinética con kit de guardapolvo y grasa de molibdeno incluidos.',
 6, 8, 245000, NULL, 9, 5, 'F-02', 'TRA-HOM-002.png'),

-- Refrigeración
('REF-RAD-001', 'Radiador de aluminio',
 'Núcleo de aluminio con tanques de poliamida reforzada. Probado a presión contra fugas.',
 7, 8, 420000, NULL, 6, 4, 'G-01', 'REF-RAD-001.png'),

('REF-TER-002', 'Termostato con empaque',
 'Apertura a 87 °C. Un termostato pegado causa sobrecalentamiento o exceso de consumo por motor frío.',
 7, 1, 42000, NULL, 28, 10, 'G-02', 'REF-TER-002.png'),

('REF-BOM-003', 'Bomba de agua',
 'Bomba con rodamiento sellado y sello mecánico de carburo. Se recomienda cambiarla junto con la correa de repartición.',
 7, 6, 178000, 155000, 12, 6, 'G-03', 'REF-BOM-003.png');

-- -------------------------------------------------------- compatibilidades --
-- Universales o de amplio rango: filtros de aceite, líquidos y bombillos.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('FIL-ACE-001', 'FRE-LIQ-004', 'ELE-BOM-004');

-- Frenos y suspensión: vehículos de segmento pequeño y mediano.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('FRE-PAS-001', 'FRE-DIS-002', 'SUS-AMO-001', 'SUS-BUJ-004')
  AND v.id IN (1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 15, 16, 17, 18);

-- Bandas y rótulas: solo los más livianos.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('FRE-BAN-003', 'SUS-ROT-003', 'SUS-ESP-002')
  AND v.id IN (1, 2, 3, 5, 10, 15, 17);

-- Filtros de aire, cabina y combustible.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('FIL-AIR-002', 'FIL-CAB-003')
  AND v.id BETWEEN 1 AND 18;

INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku = 'FIL-COM-004'
  AND v.id IN (3, 4, 6, 9, 12, 13, 14, 16, 19, 20);

-- Motor: bujías para gasolina únicamente.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku = 'MOT-BUJ-001'
  AND v.combustible = 'gasolina';

INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('MOT-COR-002', 'MOT-BOM-003', 'MOT-EMP-004', 'REF-BOM-003', 'REF-TER-002')
  AND v.id IN (1, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 20);

-- Eléctrico.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('ELE-BAT-001', 'ELE-ALT-002', 'ELE-ARR-003')
  AND v.id BETWEEN 1 AND 20;

-- Transmisión y radiador: modelos concretos.
INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku IN ('TRA-EMB-001', 'TRA-HOM-002')
  AND v.id IN (1, 2, 3, 4, 7, 8, 9, 11, 12, 13, 16, 18);

INSERT INTO compatibilidades (producto_id, vehiculo_id)
SELECT p.id, v.id
FROM productos p
CROSS JOIN vehiculos v
WHERE p.sku = 'REF-RAD-001'
  AND v.id IN (3, 4, 6, 9, 12, 13, 14, 19, 20);

-- ------------------------------------------------- kardex de carga inicial --
-- Cada existencia inicial queda justificada con su movimiento de entrada.
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_resultante, motivo, usuario_id)
SELECT id, 'entrada', stock, stock, 'Carga inicial de inventario', 1
FROM productos
WHERE stock > 0;
