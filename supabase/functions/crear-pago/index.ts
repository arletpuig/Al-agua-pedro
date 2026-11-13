// AL AGUA PEDRO · función «crear-pago» (Supabase Edge Function).
// El juego la llama al pulsar un pack: comprueba quién es el jugador y crea una página de pago de Stripe (Checkout).
// Las pesetas NO se entregan aquí: las entrega «stripe-webhook» cuando Stripe confirma el pago.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   STRIPE_API_KEY            clave restringida de Stripe (rk_...) con permiso «Checkout Sessions: Write»
//   STRIPE_PRICE_CALDERILLA   id del precio de 1,99 € (price_...)
//   STRIPE_PRICE_MALETIN      id del precio de 3,99 €
//   STRIPE_PRICE_CAMARA       id del precio de 9,95 €
//   STRIPE_AUTOMATIC_TAX      «true» solo cuando tengas un registro de impuestos activo en Stripe Tax
// SUPABASE_URL y SUPABASE_ANON_KEY los pone Supabase solo.
import Stripe from 'npm:stripe@23.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') ?? '', { apiVersion: '2026-10-28.endive', httpClient: Stripe.createFetchHttpClient() });
const PRICES: Record<string, string | undefined> = {
  calderilla: Deno.env.get('STRIPE_PRICE_CALDERILLA'),
  maletin: Deno.env.get('STRIPE_PRICE_MALETIN'),
  camara: Deno.env.get('STRIPE_PRICE_CAMARA'),
};
// Páginas desde las que se puede comprar (y a las que se vuelve tras pagar)
const ORIGINS = ['https://alaguapedro.es', 'https://www.alaguapedro.es', 'https://arletpuig.github.io', 'http://localhost:8080'];
const HOME = 'https://alaguapedro.es/';

function cors(req: Request) {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { message: 'Método no permitido' });
  try {
    // 1. ¿Quién compra? (sesión del juego)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json(req, 401, { message: 'Necesitas iniciar sesión para comprar' });

    // 2. ¿Qué pack? El precio lo decide el servidor, nunca el navegador
    const { pack, returnUrl } = await req.json().catch(() => ({}));
    const price = PRICES[String(pack)];
    if (!price) return json(req, 400, { message: 'Ese pack no existe' });
    const back = typeof returnUrl === 'string' && ORIGINS.some((o) => returnUrl.startsWith(o + '/')) ? returnUrl.split(/[?#]/)[0] : HOME;

    // 3. Página de pago de Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id, pack: String(pack) },
      payment_intent_data: { metadata: { user_id: user.id, pack: String(pack) } },
      automatic_tax: { enabled: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true' },
      invoice_creation: { enabled: true },                       // factura para cada compra (Stripe Invoicing)
      locale: 'es',
      custom_text: {
        submit: { message: 'Contenido digital: las pesetas se entregan al momento en tu cuenta del juego. Al pagar aceptas las condiciones de compra y la pérdida del derecho de desistimiento una vez entregadas.' },
      },
      success_url: `${back}?pago=ok&sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?pago=cancelado`,
      integration_identifier: 'alaguapedro-packs-qhzmtrvk',
    });
    return json(req, 200, { url: session.url });
  } catch (e) {
    console.error('crear-pago', e);
    return json(req, 500, { message: 'No se ha podido iniciar el pago. Inténtalo de nuevo.' });
  }
});
