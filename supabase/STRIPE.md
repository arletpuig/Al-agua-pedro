# Pagos con Stripe (packs de pesetas)

## Cómo funciona
1. El jugador elige un pack en la Tienda y acepta las condiciones de compra.
2. El juego llama a la función **crear-pago** (Supabase), que crea la página de pago de **Stripe Checkout** con el precio del pack. El precio lo decide el servidor, nunca el navegador.
3. El jugador paga en la página de Stripe (tarjeta, Apple Pay, Google Pay, Bizum… según lo que actives en Stripe).
4. Stripe avisa a la función **stripe-webhook**, que comprueba la firma de Stripe y entrega las pesetas con `grant_pack` (una sola vez por pago, aunque Stripe repita el aviso).
5. El jugador vuelve al juego (`?pago=ok`) y ve «¡YA ES TUYO!» cuando las pesetas han llegado.

| Pack | Precio (IVA incluido) | Entrega |
|---|---|---|
| Calderilla | 0,99 € | 150 pesetas + 60 tomates |
| Maletín | 2,99 € | 550 pesetas + 220 tomates |
| Cámara acorazada | 9,95 € | 2.200 pesetas + 900 tomates (más valor) |

Lo que entrega cada pack está en `fn_pack` (`schema_v11.sql`) y en `PACKS` (`js/economy.js`); el precio, en Stripe.

## Puesta en marcha (primero en un sandbox de pruebas, luego en real)

### 1. Stripe: cuenta y sandbox
- Crea o activa tu cuenta en https://dashboard.stripe.com con tus datos y tu IBAN.
- Crea un **sandbox** (menú de cuentas → *Sandboxes* → *Crear*). Haz todo lo de abajo primero en el sandbox, con tarjetas de prueba (`4242 4242 4242 4242`); cuando funcione, repítelo en modo real.

### 2. Stripe: los tres productos
*Catálogo de productos → Añadir producto*, tres veces:
- Nombre: «Calderilla», «Maletín», «Cámara acorazada».
- Precio: **pago único** en EUR: 0,99 / 2,99 / 9,95.
- **Incluir impuestos en el precio: sí** (el precio final es el que ve el jugador).
- **Código fiscal del producto**: elige uno para contenido digital / objetos virtuales de videojuego en la lista de Stripe (https://docs.stripe.com/tax/tax-codes) y confírmalo con tu gestor.
- Copia el **ID del precio** de cada uno (`price_…`).

### 3. Stripe: impuestos (Stripe Tax) y facturas (Invoicing)
- *Impuestos → Ajustes*: pon tu dirección (sede) y «impuestos incluidos en el precio» por defecto.
- *Impuestos → Registros*: añade **España** con tu alta de IVA. Para clientes de otros países de la UE, consulta con tu gestor (régimen OSS y umbral de 10.000 €).
- **Mientras no haya un registro activo, Stripe no calcula ni cobra IVA**: deja `STRIPE_AUTOMATIC_TAX` en `false` hasta tenerlo y luego ponlo en `true`.
- *Ajustes → Facturación / Facturas*: datos del negocio y numeración. Cada compra genera su factura (la función usa `invoice_creation`) y Stripe la envía por correo si lo activas en *Ajustes → Correos electrónicos de clientes*.

### 4. Stripe: clave restringida (nunca la pegues en el chat)
*Desarrolladores → Claves de API → Crear clave restringida* («alaguapedro-supabase»), con **Checkout Sessions: Escritura**. Si al probar sale un error 403, añade el permiso que indique. Se guarda solo en los secretos de Supabase (paso 6).

### 5. Supabase: base de datos y funciones
- Ejecuta `schema_todo.sql` (incluye `schema_v11.sql`: tabla de compras y `grant_pack`).
- *Edge Functions → Deploy a new function → Via editor*:
  - **crear-pago**: pega `functions/crear-pago/index.ts` → *Deploy*.
  - **stripe-webhook**: pega `functions/stripe-webhook/index.ts` → *Deploy*. En sus ajustes, **desactiva «Enforce JWT verification»** (Stripe no tiene sesión de Supabase; la seguridad la da la firma de Stripe).

### 6. Supabase: secretos
*Edge Functions → Secrets*:
| Nombre | Valor |
|---|---|
| `STRIPE_API_KEY` | la clave restringida (`rk_…`) |
| `STRIPE_PRICE_CALDERILLA` | `price_…` de 0,99 € |
| `STRIPE_PRICE_MALETIN` | `price_…` de 2,99 € |
| `STRIPE_PRICE_CAMARA` | `price_…` de 9,95 € |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (paso 7) |
| `STRIPE_AUTOMATIC_TAX` | `false` (o `true` con registro de IVA activo) |

### 7. Stripe: webhook
*Desarrolladores → Webhooks → Añadir destino*:
- URL: `https://xfsvruccotcymcvxzymy.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
- Copia el **secreto de firma** (`whsec_…`) al secreto `STRIPE_WEBHOOK_SECRET`.

### 8. Encender los pagos en el juego
En `js/config.js`, `PAYMENTS: true` (lo hace Claude cuando se le pida). Prueba una compra en el sandbox; cuando funcione, repite los pasos 2, 4, 6 y 7 en modo real (los IDs, la clave y el secreto del webhook son distintos en real).

## Seguridad
- La clave de Stripe y el secreto del webhook solo están en los secretos de Supabase; el juego (navegador) no tiene ninguna clave.
- Las pesetas solo las entrega el webhook, tras comprobar la firma de Stripe; `grant_pack` solo la puede usar la clave de servicio.
- Cada pago se entrega una vez (la sesión de Stripe es la clave de la tabla `purchases`).
- Devoluciones: si devuelves un pago desde Stripe, quita las pesetas a mano (o pide añadir el evento `charge.refunded`).
