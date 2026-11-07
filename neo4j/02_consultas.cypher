// ===========================================================================
//  AutoPart Pro — Consultas Cypher sobre el grafo de conocimiento
//  Ejecutar después de 01_carga.cypher
//
//  Las tres primeras responden las preguntas de competencia de la ontología.
//  La cuarta y la quinta producen conocimiento que no está guardado en
//  ninguna tabla: se deduce recorriendo el grafo.
// ===========================================================================


// ---------------------------------------------------------------------------
// CONSULTA 1 — Pregunta de competencia 1
// ¿Qué repuestos sirven para un Chevrolet Spark GT del año 2013?
//
// El año no se guarda repuesto por repuesto. El recorrido llega a la
// generación cuyo rango contiene 2013 y de ahí a los repuestos compatibles.
// ---------------------------------------------------------------------------
MATCH (m:Marca {nombre: 'Chevrolet'})<-[:DE_MARCA]-(mo:Modelo {nombre: 'Spark GT'})
MATCH (v:Vehiculo)-[:ES_MODELO]->(mo)
WHERE 2013 >= v.anioInicio AND 2013 <= v.anioFin
MATCH (r:Repuesto)-[:COMPATIBLE_CON]->(v)
MATCH (r)-[:DE_CATEGORIA]->(c:Categoria)
RETURN r.sku        AS referencia,
       r.nombre     AS repuesto,
       c.nombre     AS categoria,
       r.precio     AS precio,
       r.stock      AS existencias
ORDER BY c.nombre, r.precio DESC;


// ---------------------------------------------------------------------------
// CONSULTA 2 — Pregunta de competencia 2
// ¿Qué repuestos están por debajo de su stock mínimo y hay que reponer?
//
// Es la misma alerta que muestra el panel de inventario, pero aquí además
// se trae el fabricante al que habría que hacerle el pedido.
// ---------------------------------------------------------------------------
MATCH (r:Repuesto)-[:DE_CATEGORIA]->(c:Categoria)
MATCH (r)-[:FABRICADO_POR]->(f:Fabricante)
WHERE r.stock <= r.stockMinimo
RETURN r.sku                      AS referencia,
       r.nombre                   AS repuesto,
       c.nombre                   AS categoria,
       r.stock                    AS existencias,
       r.stockMinimo              AS minimo,
       r.stockMinimo - r.stock    AS faltante,
       f.nombre                   AS proveedor,
       CASE
           WHEN r.stock = 0                     THEN 'agotado'
           WHEN r.stock <= r.stockMinimo / 2    THEN 'crítico'
           ELSE                                      'bajo'
       END                        AS severidad
ORDER BY faltante DESC;


// ---------------------------------------------------------------------------
// CONSULTA 3 — Pregunta de competencia 3
// Si un repuesto está agotado o escaso, ¿qué equivalente puede ofrecer el
// asesor que además sirva para el mismo carro y sí tenga existencias?
//
// La relación EQUIVALE_A se consulta sin dirección: da lo mismo cuál de los
// dos repuestos se haya registrado primero.
// ---------------------------------------------------------------------------
MATCH (escaso:Repuesto)
WHERE escaso.stock <= escaso.stockMinimo
MATCH (escaso)-[:EQUIVALE_A]-(alterno:Repuesto)
WHERE alterno.stock > alterno.stockMinimo
MATCH (escaso)-[:COMPATIBLE_CON]->(v:Vehiculo)<-[:COMPATIBLE_CON]-(alterno)
MATCH (v)-[:ES_MODELO]->(mo:Modelo)-[:DE_MARCA]->(ma:Marca)
RETURN escaso.sku                           AS sin_existencias,
       alterno.sku                          AS alternativa,
       alterno.nombre                       AS nombre_alternativa,
       alterno.stock                        AS disponibles,
       alterno.precio - escaso.precio       AS diferencia_precio,
       collect(DISTINCT ma.nombre + ' ' + mo.nombre) AS sirve_para;


// ---------------------------------------------------------------------------
// CONSULTA 4 — CONOCIMIENTO NUEVO (recomendación por asociación)
// ¿Qué repuestos se compran juntos con las pastillas de freno?
//
// Esta relación no existe en ninguna tabla de la base relacional. Se deduce
// recorriendo los pedidos: si dos repuestos aparecen en los mismos pedidos
// más de una vez, es que se cambian en la misma intervención.
// ---------------------------------------------------------------------------
MATCH (base:Repuesto {sku: 'FRE-PAS-001'})<-[:CONTIENE]-(p:Pedido)-[:CONTIENE]->(otro:Repuesto)
WHERE base <> otro
WITH otro, count(DISTINCT p) AS vecesJuntos
WHERE vecesJuntos >= 2
RETURN otro.sku      AS referencia,
       otro.nombre   AS se_compra_tambien,
       vecesJuntos   AS soporte
ORDER BY soporte DESC;


// ---------------------------------------------------------------------------
// CONSULTA 5 — CONOCIMIENTO NUEVO (se escribe en el grafo)
// Materializa la asociación anterior como una relación SE_INSTALA_CON.
//
// Después de ejecutarla el grafo contiene aristas que nadie cargó a mano:
// las dedujo el propio grafo a partir del historial de ventas. Es lo que
// alimenta el bloque "se instala junto con" de la ficha del repuesto.
// ---------------------------------------------------------------------------
MATCH (a:Repuesto)<-[:CONTIENE]-(p:Pedido)-[:CONTIENE]->(b:Repuesto)
WHERE elementId(a) < elementId(b)
WITH a, b, count(DISTINCT p) AS soporte
WHERE soporte >= 2
MERGE (a)-[rel:SE_INSTALA_CON]->(b)
SET rel.soporte = soporte,
    rel.origen  = 'deducida del historial de pedidos'
RETURN a.sku AS repuesto_a, b.sku AS repuesto_b, soporte
ORDER BY soporte DESC;


// ---------------------------------------------------------------------------
// CONSULTA 6 — Recomendación personalizada para un cliente
// Repuestos que sirven para el carro del cliente y que todavía no ha comprado.
// ---------------------------------------------------------------------------
MATCH (c:Cliente {email: 'dylan@ejemplo.co'})-[:POSEE]->(v:Vehiculo)
MATCH (r:Repuesto)-[:COMPATIBLE_CON]->(v)
WHERE NOT EXISTS { (c)-[:REALIZO]->(:Pedido)-[:CONTIENE]->(r) }
MATCH (v)-[:ES_MODELO]->(mo:Modelo)-[:DE_MARCA]->(ma:Marca)
RETURN ma.nombre + ' ' + mo.nombre AS vehiculo_del_cliente,
       r.sku                       AS referencia,
       r.nombre                    AS sugerencia,
       r.precio                    AS precio;


// ---------------------------------------------------------------------------
// COMPROBACIÓN — tamaño final del grafo, ya con las relaciones deducidas
// ---------------------------------------------------------------------------
MATCH ()-[rel]->()
RETURN type(rel) AS relacion, count(*) AS cantidad
ORDER BY cantidad DESC;
