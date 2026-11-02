/**
 * Integración con la pasarela de pagos Wompi (Bancolombia).
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  MODO DE OPERACIÓN
 * ──────────────────────────────────────────────────────────────────────────
 *  El modo lo decide `WOMPI_MODO` en el archivo .env:
 *
 *    pruebas    → sandbox. Llaves pub_test_/prv_test_. Ningún cobro es real,
 *                 el dinero es ficticio y no llega a ninguna cuenta.
 *    produccion → cobros reales. Llaves pub_prod_/prv_prod_ de un comercio
 *                 aprobado por Wompi. El dinero se abona a la cuenta bancaria
 *                 que el comercio haya registrado EN EL PANEL DE WOMPI.
 *
 *  La cuenta bancaria de destino NO se configura aquí ni en ninguna parte de
 *  este código: se registra una sola vez en https://comercios.wompi.co, y
 *  Wompi la valida contra la documentación del comercio. Este backend solo
 *  conoce las llaves de API.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Flujo de un pago (Checkout Web):
 *   1. El backend crea el pedido en estado `pendiente` y genera una
 *      referencia única.
 *   2. Calcula la firma de integridad con el secreto del comercio.
 *   3. El frontend redirige al checkout de Wompi con esos datos.
 *   4. El comprador paga; Wompi lo devuelve a `urlRedireccion`.
 *   5. En paralelo Wompi envía un webhook al backend con el resultado.
 *      El webhook es la fuente de verdad: la redirección puede perderse si
 *      el usuario cierra el navegador.
 */
import crypto from 'node:crypto';
import { entorno, pasarelaConfigurada } from '../config/entorno.js';

const URLS = {
  pruebas: {
    api: 'https://sandbox.wompi.co/v1',
    checkout: 'https://checkout.wompi.co/p/',
  },
  produccion: {
    api: 'https://production.wompi.co/v1',
    checkout: 'https://checkout.wompi.co/p/',
  },
};

/** Datos no sensibles de la pasarela, para que el frontend sepa qué mostrar. */
export function estadoPasarela() {
  return {
    configurada: pasarelaConfigurada,
    modo: entorno.wompi.modo,
    esReal: entorno.wompi.modo === 'produccion',
    llavePublica: pasarelaConfigurada ? entorno.wompi.llavePublica : null,
    urlCheckout: URLS[entorno.wompi.modo].checkout,
    moneda: 'COP',
  };
}

/**
 * Wompi recibe los importes en centavos y como entero.
 * $ 100 COP → 10000. El peso colombiano no usa centavos en la práctica,
 * pero la API los exige igual.
 */
export function aCentavos(pesos) {
  return Math.round(Number(pesos) * 100);
}

/**
 * Referencia única del pago. Debe ser irrepetible: Wompi rechaza una
 * referencia ya usada, y eso es justamente lo que evita cobros duplicados.
 */
export function generarReferencia(numeroPedido) {
  const aleatorio = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${numeroPedido}-${aleatorio}`;
}

/**
 * Firma de integridad que exige el Checkout Web.
 *
 * Wompi la define como el SHA-256 de la concatenación, en este orden exacto:
 *   referencia + monto_en_centavos + moneda + secreto_de_integridad
 *
 * Sirve para que nadie pueda alterar el monto manipulando la URL del
 * checkout: si cambia un solo peso, la firma deja de coincidir y Wompi
 * rechaza la transacción.
 */
export function firmarIntegridad(referencia, montoCentavos, moneda = 'COP') {
  if (!entorno.wompi.secretoIntegridad) {
    throw new Error('Falta WOMPI_SECRETO_INTEGRIDAD en el archivo .env');
  }
  const cadena = `${referencia}${montoCentavos}${moneda}${entorno.wompi.secretoIntegridad}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

/**
 * Arma el paquete de datos que el frontend necesita para abrir el checkout.
 * No hace ninguna llamada a Wompi: el Checkout Web es una redirección.
 */
export function prepararPago({ pedido, cliente }) {
  if (!pasarelaConfigurada) {
    const error = new Error(
      'La pasarela no tiene llaves cargadas. Copia las llaves de Wompi en backend/.env.',
    );
    error.codigoHttp = 503;
    throw error;
  }

  const montoCentavos = aCentavos(pedido.total);
  const referencia = pedido.referencia_pago ?? generarReferencia(pedido.numero);

  return {
    publicKey: entorno.wompi.llavePublica,
    currency: 'COP',
    amountInCents: montoCentavos,
    reference: referencia,
    signature: firmarIntegridad(referencia, montoCentavos),
    redirectUrl: entorno.wompi.urlRedireccion,
    customerData: {
      email: cliente.email,
      fullName: `${cliente.nombre} ${cliente.apellido}`.trim(),
      phoneNumber: cliente.telefono ?? '',
      phoneNumberPrefix: '+57',
      legalId: cliente.documento ?? '',
      legalIdType: 'CC',
    },
    // Con esto el checkout muestra el aviso de entorno de pruebas.
    modo: entorno.wompi.modo,
  };
}

/**
 * Verifica la firma de un webhook de Wompi.
 *
 * Wompi firma el evento con el "secreto de eventos": concatena los valores
 * de las propiedades listadas en `signature.properties`, les pega el
 * timestamp y el secreto, y manda el SHA-256. Si no coincide, el evento no
 * viene de Wompi y hay que descartarlo: de lo contrario cualquiera podría
 * marcar pedidos como pagados con un simple POST.
 */
export function verificarFirmaEvento(cuerpo) {
  if (!entorno.wompi.secretoEventos) {
    throw new Error('Falta WOMPI_SECRETO_EVENTOS en el archivo .env');
  }

  const propiedades = cuerpo?.signature?.properties;
  const checksumRecibido = cuerpo?.signature?.checksum;
  const timestamp = cuerpo?.timestamp;

  if (!Array.isArray(propiedades) || !checksumRecibido || timestamp == null) {
    return false;
  }

  // Cada propiedad viene como ruta separada por puntos: "transaction.amount_in_cents"
  const concatenado = propiedades
    .map((ruta) => ruta.split('.').reduce((obj, clave) => obj?.[clave], cuerpo.data))
    .join('');

  const cadena = `${concatenado}${timestamp}${entorno.wompi.secretoEventos}`;
  const calculado = crypto.createHash('sha256').update(cadena).digest('hex');

  // Comparación en tiempo constante: evita filtrar información por el
  // tiempo que tarda en fallar la comparación.
  const a = Buffer.from(calculado, 'utf8');
  const b = Buffer.from(String(checksumRecibido).toLowerCase(), 'utf8');

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Consulta el estado real de una transacción contra la API de Wompi.
 * Se usa cuando el comprador vuelve por la URL de redirección, antes de
 * que llegue el webhook.
 */
export async function consultarTransaccion(idTransaccion) {
  const respuesta = await fetch(`${URLS[entorno.wompi.modo].api}/transactions/${idTransaccion}`, {
    headers: { Authorization: `Bearer ${entorno.wompi.llavePrivada}` },
  });

  if (!respuesta.ok) {
    throw new Error(`Wompi respondió ${respuesta.status} al consultar la transacción`);
  }

  const { data } = await respuesta.json();
  return data;
}

/** Traduce el estado de Wompi al estado interno del pedido. */
export function estadoPedidoSegunTransaccion(estadoWompi) {
  switch (estadoWompi) {
    case 'APPROVED':
      return 'pagado';
    case 'DECLINED':
    case 'ERROR':
    case 'VOIDED':
      return 'cancelado';
    default:
      return 'pendiente'; // PENDING
  }
}
