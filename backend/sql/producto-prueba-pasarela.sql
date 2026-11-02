-- ---------------------------------------------------------------------------
-- Producto único de bajo valor para validar la pasarela de pagos con dinero
-- real. Ejecutar solo cuando WOMPI_MODO=produccion y se quiera hacer la
-- prueba. Después de usarlo, desactivarlo con el UPDATE al final.
-- ---------------------------------------------------------------------------

INSERT INTO productos
  (sku, nombre, descripcion, categoria_id, precio, stock, stock_minimo, activo)
VALUES
  ('TEST-PAGO-001', 'Prueba de pasarela — no es un repuesto real',
   'Artículo creado únicamente para validar el cobro real con Wompi. '
   'No corresponde a ningún producto físico.',
   1, 3000, 1, 0, 1)
ON DUPLICATE KEY UPDATE
  precio = VALUES(precio), stock = 1, activo = 1;

-- Para dar de baja después de la prueba:
-- UPDATE productos SET activo = 0 WHERE sku = 'TEST-PAGO-001';
