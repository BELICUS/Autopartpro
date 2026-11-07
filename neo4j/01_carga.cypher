// ===========================================================================
//  AutoPart Pro — Carga del grafo de conocimiento en Neo4j
//  Proyecto final de Ingeniería Web
//  Dylan Nuñez · Jose Gomez · Ivan Orozco
//
//  Ejecutar este archivo completo antes que 02_consultas.cypher.
//  Los datos son los mismos del catálogo de la aplicación, pero reducidos
//  a la porción que hace falta para responder las preguntas de competencia.
// ===========================================================================

// Limpieza previa, para poder volver a cargar sin duplicar nada.
MATCH (n) DETACH DELETE n;

// --------------------------------------------------------------- restricciones
CREATE CONSTRAINT repuesto_sku IF NOT EXISTS
FOR (r:Repuesto) REQUIRE r.sku IS UNIQUE;

CREATE CONSTRAINT pedido_numero IF NOT EXISTS
FOR (p:Pedido) REQUIRE p.numero IS UNIQUE;

CREATE CONSTRAINT cliente_email IF NOT EXISTS
FOR (c:Cliente) REQUIRE c.email IS UNIQUE;

// ------------------------------------------------------------------- marcas
CREATE (chevrolet:Marca {nombre: 'Chevrolet'})
CREATE (renault:Marca   {nombre: 'Renault'})

// ------------------------------------------------------------------ modelos
CREATE (sparkgt:Modelo {nombre: 'Spark GT'})
CREATE (sail:Modelo    {nombre: 'Sail'})
CREATE (logan:Modelo   {nombre: 'Logan'})
CREATE (sandero:Modelo {nombre: 'Sandero'})

CREATE (sparkgt)-[:DE_MARCA]->(chevrolet)
CREATE (sail)-[:DE_MARCA]->(chevrolet)
CREATE (logan)-[:DE_MARCA]->(renault)
CREATE (sandero)-[:DE_MARCA]->(renault)

// --------------------------------------------------------------- vehículos
// Un vehículo no es un carro individual: es una generación, con su rango de
// años y su motorización. La búsqueda por año se resuelve contra ese rango.
CREATE (v_spark:Vehiculo   {anioInicio: 2011, anioFin: 2017, motor: '1.2L', combustible: 'gasolina'})
CREATE (v_sail:Vehiculo    {anioInicio: 2013, anioFin: 2019, motor: '1.4L', combustible: 'gasolina'})
CREATE (v_logan:Vehiculo   {anioInicio: 2010, anioFin: 2016, motor: '1.6L', combustible: 'gasolina'})
CREATE (v_sandero:Vehiculo {anioInicio: 2012, anioFin: 2019, motor: '1.6L', combustible: 'gasolina'})

CREATE (v_spark)-[:ES_MODELO]->(sparkgt)
CREATE (v_sail)-[:ES_MODELO]->(sail)
CREATE (v_logan)-[:ES_MODELO]->(logan)
CREATE (v_sandero)-[:ES_MODELO]->(sandero)

// -------------------------------------------------------------- categorías
CREATE (frenos:Categoria     {nombre: 'Frenos'})
CREATE (filtros:Categoria    {nombre: 'Filtros'})
CREATE (suspension:Categoria {nombre: 'Suspensión'})

// ------------------------------------------------------------- fabricantes
CREATE (bosch:Fabricante {nombre: 'Bosch', pais: 'Alemania'})
CREATE (trw:Fabricante   {nombre: 'TRW',   pais: 'Estados Unidos'})
CREATE (mahle:Fabricante {nombre: 'Mahle', pais: 'Alemania'})

// ---------------------------------------------------------------- repuestos
CREATE (pastillas:Repuesto {sku: 'FRE-PAS-001', nombre: 'Pastillas de freno delanteras cerámicas',
                            precio: 159000, stock: 42, stockMinimo: 10})
CREATE (disco:Repuesto     {sku: 'FRE-DIS-002', nombre: 'Disco de freno ventilado 256 mm',
                            precio: 142000, stock: 8,  stockMinimo: 10})
CREATE (pastillasTrw:Repuesto {sku: 'TRW-PAS-010', nombre: 'Pastillas de freno cerámicas TRW',
                            precio: 148000, stock: 17, stockMinimo: 6})
CREATE (filtroAceite:Repuesto {sku: 'FIL-ACE-001', nombre: 'Filtro de aceite roscado',
                            precio: 24000,  stock: 85, stockMinimo: 20})
CREATE (filtroAire:Repuesto   {sku: 'FIL-AIR-002', nombre: 'Filtro de aire del motor',
                            precio: 45000,  stock: 52, stockMinimo: 15})
CREATE (amortiguador:Repuesto {sku: 'SUS-AMO-001', nombre: 'Amortiguador delantero a gas',
                            precio: 210000, stock: 2,  stockMinimo: 6})
CREATE (discoBosch:Repuesto   {sku: 'FRE-DIS-015', nombre: 'Disco de freno ventilado 256 mm Bosch',
                            precio: 135000, stock: 23, stockMinimo: 8})

CREATE (pastillas)-[:DE_CATEGORIA]->(frenos)
CREATE (disco)-[:DE_CATEGORIA]->(frenos)
CREATE (pastillasTrw)-[:DE_CATEGORIA]->(frenos)
CREATE (filtroAceite)-[:DE_CATEGORIA]->(filtros)
CREATE (filtroAire)-[:DE_CATEGORIA]->(filtros)
CREATE (amortiguador)-[:DE_CATEGORIA]->(suspension)
CREATE (discoBosch)-[:DE_CATEGORIA]->(frenos)

CREATE (pastillas)-[:FABRICADO_POR]->(bosch)
CREATE (disco)-[:FABRICADO_POR]->(trw)
CREATE (pastillasTrw)-[:FABRICADO_POR]->(trw)
CREATE (filtroAceite)-[:FABRICADO_POR]->(bosch)
CREATE (filtroAire)-[:FABRICADO_POR]->(mahle)
CREATE (amortiguador)-[:FABRICADO_POR]->(bosch)
CREATE (discoBosch)-[:FABRICADO_POR]->(bosch)

// ----------------------------------------------------------- compatibilidad
CREATE (pastillas)-[:COMPATIBLE_CON]->(v_spark)
CREATE (pastillas)-[:COMPATIBLE_CON]->(v_sail)
CREATE (pastillas)-[:COMPATIBLE_CON]->(v_logan)
CREATE (pastillas)-[:COMPATIBLE_CON]->(v_sandero)
CREATE (disco)-[:COMPATIBLE_CON]->(v_spark)
CREATE (disco)-[:COMPATIBLE_CON]->(v_sail)
CREATE (pastillasTrw)-[:COMPATIBLE_CON]->(v_spark)
CREATE (pastillasTrw)-[:COMPATIBLE_CON]->(v_sail)
CREATE (filtroAceite)-[:COMPATIBLE_CON]->(v_spark)
CREATE (filtroAceite)-[:COMPATIBLE_CON]->(v_sail)
CREATE (filtroAceite)-[:COMPATIBLE_CON]->(v_logan)
CREATE (filtroAire)-[:COMPATIBLE_CON]->(v_spark)
CREATE (filtroAire)-[:COMPATIBLE_CON]->(v_logan)
CREATE (amortiguador)-[:COMPATIBLE_CON]->(v_logan)
CREATE (amortiguador)-[:COMPATIBLE_CON]->(v_sandero)
CREATE (discoBosch)-[:COMPATIBLE_CON]->(v_spark)
CREATE (discoBosch)-[:COMPATIBLE_CON]->(v_sail)

// Equivalencias declaradas por el fabricante: mismo ajuste, distinta marca.
CREATE (pastillas)-[:EQUIVALE_A]->(pastillasTrw)
CREATE (disco)-[:EQUIVALE_A]->(discoBosch)

// ----------------------------------------------------------------- clientes
CREATE (dylan:Cliente    {nombre: 'Dylan Nuñez',  email: 'dylan@ejemplo.co',   ciudad: 'Montería'})
CREATE (marcela:Cliente  {nombre: 'Marcela Ruiz', email: 'marcela@ejemplo.co', ciudad: 'Montería'})
CREATE (andres:Cliente   {nombre: 'Andrés Pérez', email: 'andres@ejemplo.co',  ciudad: 'Cereté'})

CREATE (dylan)-[:POSEE]->(v_spark)
CREATE (marcela)-[:POSEE]->(v_sail)
CREATE (andres)-[:POSEE]->(v_logan)

// ------------------------------------------------------------------ pedidos
CREATE (p1:Pedido {numero: 'APP-2026-00011', estado: 'entregado', total: 358190})
CREATE (p2:Pedido {numero: 'APP-2026-00012', estado: 'entregado', total: 358190})
CREATE (p3:Pedido {numero: 'APP-2026-00013', estado: 'entregado', total: 217770})
CREATE (p4:Pedido {numero: 'APP-2026-00014', estado: 'pagado',    total: 82110})
CREATE (p5:Pedido {numero: 'APP-2026-00015', estado: 'entregado', total: 386750})

CREATE (dylan)-[:REALIZO]->(p1)
CREATE (marcela)-[:REALIZO]->(p2)
CREATE (andres)-[:REALIZO]->(p3)
CREATE (dylan)-[:REALIZO]->(p4)
CREATE (marcela)-[:REALIZO]->(p5)

CREATE (p1)-[:CONTIENE {cantidad: 1}]->(pastillas)
CREATE (p1)-[:CONTIENE {cantidad: 1}]->(disco)
CREATE (p2)-[:CONTIENE {cantidad: 1}]->(pastillas)
CREATE (p2)-[:CONTIENE {cantidad: 1}]->(disco)
CREATE (p3)-[:CONTIENE {cantidad: 1}]->(pastillas)
CREATE (p3)-[:CONTIENE {cantidad: 2}]->(filtroAceite)
CREATE (p4)-[:CONTIENE {cantidad: 1}]->(filtroAceite)
CREATE (p4)-[:CONTIENE {cantidad: 1}]->(filtroAire)
CREATE (p5)-[:CONTIENE {cantidad: 1}]->(pastillas)
CREATE (p5)-[:CONTIENE {cantidad: 1}]->(disco)
CREATE (p5)-[:CONTIENE {cantidad: 1}]->(filtroAceite);

// --------------------------------------------------------------- comprobación
// 31 nodos y 60 relaciones.
MATCH (n) RETURN labels(n)[0] AS etiqueta, count(*) AS nodos ORDER BY nodos DESC;
