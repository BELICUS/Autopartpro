/** Raíz de la aplicación: proveedores de estado y tabla de rutas. */
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ProveedorSesion } from './contexto/SesionContexto.jsx';
import { ProveedorCarrito } from './contexto/CarritoContexto.jsx';
import BarraSuperior from './componentes/BarraSuperior.jsx';
import RutaProtegida from './componentes/RutaProtegida.jsx';

import Catalogo from './paginas/Catalogo.jsx';
import DetalleProducto from './paginas/DetalleProducto.jsx';
import Carrito from './paginas/Carrito.jsx';
import Checkout from './paginas/Checkout.jsx';
import Acceso from './paginas/Acceso.jsx';
import MisPedidos from './paginas/MisPedidos.jsx';
import DetallePedido from './paginas/DetallePedido.jsx';
import ResultadoPago from './paginas/ResultadoPago.jsx';
import PanelAdmin from './paginas/PanelAdmin.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorCarrito>
          <BarraSuperior />

          <main className="principal">
            <Routes>
              <Route path="/" element={<Catalogo />} />
              <Route path="/producto/:id" element={<DetalleProducto />} />
              <Route path="/carrito" element={<Carrito />} />
              <Route path="/acceso" element={<Acceso />} />
              <Route path="/pago/resultado" element={<ResultadoPago />} />

              <Route
                path="/checkout"
                element={<RutaProtegida><Checkout /></RutaProtegida>}
              />
              <Route
                path="/mis-pedidos"
                element={<RutaProtegida><MisPedidos /></RutaProtegida>}
              />
              <Route
                path="/pedido/:id"
                element={<RutaProtegida><DetallePedido /></RutaProtegida>}
              />
              <Route
                path="/admin"
                element={
                  <RutaProtegida soloAdministrador>
                    <PanelAdmin />
                  </RutaProtegida>
                }
              />

              <Route
                path="*"
                element={
                  <div className="contenedor" style={{ padding: '3rem 1.25rem' }}>
                    <h1>Página no encontrada</h1>
                    <a href="/">Volver al catálogo</a>
                  </div>
                }
              />
            </Routes>
          </main>

          <footer className="pie">
            <div className="contenedor">
              <p>
                <strong>AutoPart Pro</strong> — Sistema de inventario inteligente y ventas
              </p>
              <p>
                Proyecto académico · Programación Orientada a la Web · Entorno de desarrollo
                local
              </p>
            </div>
          </footer>
        </ProveedorCarrito>
      </ProveedorSesion>
    </BrowserRouter>
  );
}
