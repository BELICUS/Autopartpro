-- ---------------------------------------------------------------------------
-- Producto único de bajo valor para probar un pago real de extremo a
-- extremo: carrito → pedido → transferencia bancaria → confirmación manual.
-- No corresponde a ningún repuesto real. Ejecutar y luego dar de baja con
-- el UPDATE al final cuando termines la prueba.
-- ---------------------------------------------------------------------------

INSERT INTO productos
  (sku, nombre, descripcion, categoria_id, precio, stock, stock_minimo, activo)
VALUES
  ('TEST-PAGO-001', 'Prueba de pago — no es un repuesto real',
   'Artículo creado únicamente para probar el pago por transferencia '
   'bancaria con dinero real. No corresponde a ningún producto físico.',
   1, 3000, 1, 0, 1)
ON DUPLICATE KEY UPDATE
  precio = VALUES(precio), stock = 1, activo = 1;

-- Para dar de baja después de la prueba:
-- UPDATE productos SET activo = 0 WHERE sku = 'TEST-PAGO-001';
