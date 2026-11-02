# Diagrama de clases — AutoPart Pro

Los diagramas están escritos en **Mermaid**. Se visualizan en GitHub, en
VS Code con la extensión *Markdown Preview Mermaid*, o pegándolos en
`https://mermaid.live`.

---

## 1. Modelo del dominio (entidad-relación)

Las entidades del negocio y cómo se relacionan.

```mermaid
erDiagram
    USUARIOS ||--o{ PEDIDOS : realiza
    USUARIOS ||--o{ MOVIMIENTOS_INVENTARIO : registra

    CATEGORIAS   ||--o{ PRODUCTOS : agrupa
    FABRICANTES  ||--o{ PRODUCTOS : fabrica

    MARCAS_VEHICULO  ||--o{ MODELOS_VEHICULO : tiene
    MODELOS_VEHICULO ||--o{ VEHICULOS : "se produce como"

    PRODUCTOS ||--o{ COMPATIBILIDADES : "aplica a"
    VEHICULOS ||--o{ COMPATIBILIDADES : "admite"

    PEDIDOS   ||--|{ PEDIDO_DETALLES : contiene
    PRODUCTOS ||--o{ PEDIDO_DETALLES : "se vende en"

    PRODUCTOS ||--o{ MOVIMIENTOS_INVENTARIO : "registra en kardex"
    PEDIDOS   ||--o{ MOVIMIENTOS_INVENTARIO : origina

    USUARIOS {
        int id PK
        string email UK
        string contrasena "hash bcrypt"
        enum rol "cliente | administrador"
        bool activo
    }

    CATEGORIAS {
        int id PK
        string nombre
        string slug UK
    }

    FABRICANTES {
        int id PK
        string nombre UK
        string pais
    }

    MARCAS_VEHICULO {
        int id PK
        string nombre UK
    }

    MODELOS_VEHICULO {
        int id PK
        int marca_id FK
        string nombre
    }

    VEHICULOS {
        int id PK
        int modelo_id FK
        smallint anio_inicio
        smallint anio_fin
        string motor
        enum combustible
    }

    PRODUCTOS {
        int id PK
        string sku UK
        string nombre
        int categoria_id FK
        int fabricante_id FK
        decimal precio
        decimal precio_oferta
        int stock
        int stock_minimo
        bool activo
    }

    COMPATIBILIDADES {
        int producto_id PK_FK
        int vehiculo_id PK_FK
        string nota
    }

    PEDIDOS {
        int id PK
        string numero UK
        int usuario_id FK
        enum estado
        decimal subtotal
        decimal iva
        decimal envio
        decimal total
        string referencia_pago
    }

    PEDIDO_DETALLES {
        int id PK
        int pedido_id FK
        int producto_id FK
        string nombre_producto "copia histórica"
        int cantidad
        decimal precio_unitario
    }

    MOVIMIENTOS_INVENTARIO {
        int id PK
        int producto_id FK
        enum tipo "entrada | salida | ajuste"
        int cantidad
        int stock_resultante
        int usuario_id FK
        int pedido_id FK
    }
```

**Lectura de la relación clave.** `PRODUCTOS` y `VEHICULOS` están en
muchos-a-muchos: un filtro de aceite sirve para veinte generaciones, y una
generación admite veinte repuestos distintos. `COMPATIBILIDADES` materializa
esa relación y es la tabla que recorre el buscador avanzado.

---

## 2. Arquitectura por capas (backend MVC)

```mermaid
classDiagram
    direction TB

    class Rutas {
        <<Capa de enrutamiento>>
        +GET /api/productos
        +POST /api/pedidos
        +GET /api/inventario/alertas
        +POST /api/pagos/webhook
        -aplicarValidadores()
    }

    class Middlewares {
        <<Capa transversal>>
        +requiereSesion(req, res, next)
        +requiereAdministrador(req, res, next)
        +validar(req, res, next)
        +manejadorErrores(err, req, res, next)
        +firmarToken(usuario) string
    }

    class Controladores {
        <<Capa de control>>
        +buscar(req, res)
        +crear(req, res)
        +iniciarPago(req, res)
        +webhookWompi(req, res)
        -normalizarEntrada()
        -armarRespuesta()
    }

    class Modelos {
        <<Capa de datos>>
        +buscar(filtros) Resultado
        +obtenerPorId(id) Entidad
        +crear(datos) int
        +registrarMovimiento(datos) Resultado
        -ejecutarSQL()
    }

    class Servicios {
        <<Capa de integración>>
        +prepararPago(pedido, cliente)
        +firmarIntegridad(ref, monto)
        +verificarFirmaEvento(cuerpo) bool
        +consultarTransaccion(id)
    }

    class BaseDatos {
        <<Infraestructura>>
        -pool : Pool
        +consultar(sql, params)
        +consultarUna(sql, params)
        +enTransaccion(callback)
    }

    Rutas --> Middlewares : aplica
    Rutas --> Controladores : despacha
    Controladores --> Modelos : consulta
    Controladores --> Servicios : delega pagos
    Modelos --> BaseDatos : usa
    Servicios ..> APIWompi : HTTPS

    class APIWompi {
        <<Externo>>
        +POST /transactions
        +GET /transactions/:id
    }
```

**Regla que sostiene la arquitectura:** solo la capa de modelos escribe SQL.
Un controlador que construyera una consulta estaría saltándose la capa que
garantiza las transacciones y las consultas preparadas.

---

## 3. Clases del modelo de datos

```mermaid
classDiagram
    direction LR

    class ProductoModelo {
        +buscar(filtros) ResultadoPaginado
        +obtenerPorId(id) Producto
        +obtenerPorSku(sku) Producto
        +crear(datos) int
        +actualizar(id, datos) bool
        +desactivar(id) bool
        -ORDENES_PERMITIDOS : Object
        -SELECCION : string
    }

    class InventarioModelo {
        +registrarMovimiento(datos, conexion) Resultado
        +alertasStock(filtro) Alerta[]
        +kardex(productoId, limite) Movimiento[]
        +resumen() ResumenInventario
    }

    class PedidoModelo {
        +crear(datos) Pedido
        +obtenerPorId(id) Pedido
        +obtenerPorReferencia(ref) Pedido
        +listarPorUsuario(usuarioId) Pedido[]
        +listarTodos(filtro) Pedido[]
        +asignarReferenciaPago(id, ref, metodo) bool
        +cambiarEstado(id, estado) bool
        -siguienteNumero(conexion) string
        -TASA_IVA : 0.19
        -UMBRAL_ENVIO_GRATIS : 200000
    }

    class UsuarioModelo {
        +crear(datos) int
        +obtenerPorId(id) Usuario
        +obtenerPorEmailConHash(email) Usuario
        +emailExiste(email) bool
        +contrasenaCoincide(plana, hash) bool
        +actualizarPerfil(id, datos) bool
        -RONDAS : 10
    }

    class CatalogoModelo {
        +categorias() Categoria[]
        +fabricantes() Fabricante[]
        +marcasVehiculo() Marca[]
        +modelosDeMarca(marcaId) Modelo[]
        +aniosDeModelo(modeloId) int[]
        +vehiculos(filtro) Vehiculo[]
    }

    PedidoModelo ..> InventarioModelo : reserva y devuelve stock
    ProductoModelo ..> CatalogoModelo : comparte taxonomías
```

**Dependencia destacada.** `PedidoModelo` llama a
`InventarioModelo.registrarMovimiento()` pasándole su propia conexión de
transacción. Así crear el pedido y descontar el stock ocurren dentro de la
misma transacción: si falla el tercer artículo, se revierten también los dos
primeros.

---

## 4. Componentes del frontend

```mermaid
classDiagram
    direction TB

    class App {
        +BrowserRouter
        +rutas : Route[]
    }

    class ProveedorSesion {
        <<Contexto>>
        -usuario : Usuario
        -cargando : bool
        +acceder(email, contrasena)
        +registrar(datos)
        +salir()
        +esAdministrador : bool
    }

    class ProveedorCarrito {
        <<Contexto>>
        -items : ItemCarrito[]
        +agregar(producto, cantidad)
        +cambiarCantidad(id, cantidad)
        +quitar(id)
        +vaciar()
        +resumen : Resumen
    }

    class Catalogo {
        <<Página>>
        -filtros : Filtros
        -resultado : ResultadoPaginado
        +aplicar()
        +limpiar()
        +irAPagina(n)
    }

    class BuscadorVehiculo {
        <<Componente>>
        -marcas : Marca[]
        -modelos : Modelo[]
        -anios : int[]
        +cambiarMarca(marca)
        +cambiarModelo(modelo)
    }

    class PanelAdmin {
        <<Página>>
        +Inventario
        +Pedidos
        +DialogoMovimiento
    }

    class Checkout {
        <<Página>>
        +confirmar()
        -redirigirAWompi(pago)
    }

    class ClienteApi {
        <<Servicio>>
        +get(ruta)
        +post(ruta, cuerpo)
        +put(ruta, cuerpo)
        +patch(ruta, cuerpo)
        +delete(ruta)
        -peticion(ruta, opciones)
    }

    App --> ProveedorSesion
    App --> ProveedorCarrito
    ProveedorSesion --> ClienteApi
    Catalogo --> BuscadorVehiculo
    Catalogo --> ClienteApi
    PanelAdmin --> ClienteApi
    Checkout --> ProveedorCarrito
    Checkout --> ClienteApi
```

---

## 5. Secuencia: búsqueda por vehículo

```mermaid
sequenceDiagram
    actor C as Cliente
    participant B as BuscadorVehiculo
    participant A as API
    participant M as ProductoModelo
    participant BD as MySQL

    C->>B: selecciona marca "Chevrolet"
    B->>A: GET /api/marcas/1/modelos
    A->>BD: SELECT modelos WHERE marca_id = 1
    BD-->>B: Onix, Sail, Spark GT, Tracker

    C->>B: selecciona modelo "Spark GT"
    B->>A: GET /api/modelos/1/anios
    A->>BD: SELECT anio_inicio, anio_fin FROM vehiculos
    Note over A: expande los rangos a años sueltos
    BD-->>B: 2011 … 2024

    C->>B: selecciona año 2015 y pulsa Buscar
    B->>A: GET /api/productos?marca=1&modelo=1&anio=2015
    A->>M: buscar(filtros)
    M->>BD: JOIN compatibilidades + vehiculos<br/>WHERE 2015 BETWEEN anio_inicio AND anio_fin
    BD-->>M: 23 productos compatibles
    M-->>A: resultado paginado
    A-->>C: rejilla de resultados
```

---

## 6. Secuencia: compra y pago

```mermaid
sequenceDiagram
    actor C as Cliente
    participant F as Frontend
    participant A as API
    participant P as PedidoModelo
    participant I as InventarioModelo
    participant W as Wompi

    C->>F: confirma el checkout
    F->>A: POST /api/pedidos

    rect rgb(235, 242, 250)
        Note over A,I: Una sola transacción
        A->>P: crear(items, envio)
        P->>P: relee precios desde la BD
        loop por cada artículo
            P->>I: registrarMovimiento(salida)
            I->>I: SELECT ... FOR UPDATE
            I->>I: valida stock suficiente
        end
        P-->>A: pedido pendiente
    end

    A-->>F: pedido creado
    F->>A: POST /api/pagos/iniciar/:id
    A->>A: genera referencia y firma de integridad
    A-->>F: datos firmados
    F->>W: redirige al checkout

    C->>W: paga
    W-->>C: redirige a /pago/resultado

    par Verificación inmediata
        F->>A: GET /api/pagos/verificar?id=...
        A->>W: GET /transactions/:id
        W-->>A: estado APPROVED
        A->>P: cambiarEstado(pagado)
    and Webhook (fuente de verdad)
        W->>A: POST /api/pagos/webhook
        A->>A: verifica la firma del evento
        A->>P: cambiarEstado(pagado)
    end
```

**Por qué dos caminos de confirmación.** La redirección es inmediata pero
frágil: si el cliente cierra el navegador, nunca llega. El webhook sale de
los servidores de Wompi y es independiente del navegador, pero puede tardar.
Atender ambos hace que el pedido se confirme por la vía que llegue primero;
`cambiarEstado` no hace nada si el estado ya es el correcto, así que el doble
aviso no causa efectos duplicados.

---

## 7. Máquina de estados del pedido

```mermaid
stateDiagram-v2
    [*] --> pendiente : se crea el pedido<br/>(stock reservado)

    pendiente --> pagado : pasarela aprueba
    pendiente --> cancelado : rechazo o abandono

    pagado --> preparando : alistamiento en bodega
    preparando --> enviado : entregado a la transportadora
    enviado --> entregado : recibido por el cliente

    pagado --> cancelado : reembolso
    preparando --> cancelado : reembolso

    entregado --> [*]
    cancelado --> [*]

    note right of cancelado
        Al cancelar, las unidades
        reservadas vuelven al
        inventario como movimiento
        de entrada.
    end note
```
