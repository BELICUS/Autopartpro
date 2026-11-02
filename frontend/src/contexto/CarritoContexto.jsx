/**
 * Contexto del carrito.
 *
 * El carrito vive en localStorage y no en la base: así sobrevive a una
 * recarga sin obligar al visitante a crear cuenta para mirar precios. Los
 * importes se recalculan siempre contra el servidor al crear el pedido.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarritoContexto = createContext(null);
const CLAVE = 'autopart_carrito';

function leerAlmacenado() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const datos = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function ProveedorCarrito({ children }) {
  const [items, setItems] = useState(leerAlmacenado);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(items));
    } catch {
      // Almacenamiento lleno o bloqueado: el carrito sigue en memoria.
    }
  }, [items]);

  function agregar(producto, cantidad = 1) {
    setItems((actuales) => {
      const existente = actuales.find((i) => i.id === producto.id);

      if (existente) {
        // No se puede superar el stock disponible.
        const nuevaCantidad = Math.min(existente.cantidad + cantidad, producto.stock);
        return actuales.map((i) => (i.id === producto.id ? { ...i, cantidad: nuevaCantidad } : i));
      }

      return [
        ...actuales,
        {
          id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre,
          precio: Number(producto.precio_final ?? producto.precio),
          imagen: producto.imagen,
          stock: producto.stock,
          cantidad: Math.min(cantidad, producto.stock),
        },
      ];
    });
  }

  function cambiarCantidad(id, cantidad) {
    setItems((actuales) =>
      actuales.map((i) =>
        i.id === id ? { ...i, cantidad: Math.max(1, Math.min(cantidad, i.stock)) } : i,
      ),
    );
  }

  function quitar(id) {
    setItems((actuales) => actuales.filter((i) => i.id !== id));
  }

  function vaciar() {
    setItems([]);
  }

  const resumen = useMemo(() => {
    const subtotal = items.reduce((suma, i) => suma + i.precio * i.cantidad, 0);
    const unidades = items.reduce((suma, i) => suma + i.cantidad, 0);
    // Estos valores son solo informativos: el total real lo calcula el
    // backend al crear el pedido.
    const iva = Math.round(subtotal * 0.19);
    const envio = subtotal >= 200000 || subtotal === 0 ? 0 : 15000;

    return { subtotal, iva, envio, total: subtotal + iva + envio, unidades };
  }, [items]);

  const valor = useMemo(
    () => ({ items, agregar, cambiarCantidad, quitar, vaciar, resumen }),
    [items, resumen],
  );

  return <CarritoContexto.Provider value={valor}>{children}</CarritoContexto.Provider>;
}

export function useCarrito() {
  const contexto = useContext(CarritoContexto);
  if (!contexto) {
    throw new Error('useCarrito debe usarse dentro de <ProveedorCarrito>');
  }
  return contexto;
}
