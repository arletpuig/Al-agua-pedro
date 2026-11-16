// AL AGUA PEDRO · función «stripe-webhook» (Supabase Edge Function).
// Stripe la avisa cuando un pago se completa. Solo aquí se entregan las pesetas (una vez por pago).
// IMPORTANTE: en Supabase, desactiva «Enforce JWT verification» para esta función (Stripe no envía sesión de Supabase);
// la seguridad la da la firma de Stripe, que se comprueba siempre.
// Sirve para los dos sistemas: pagos creados por «crear-pago» (pack en metadata) y enlaces de pago de Stripe (pack según el importe).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   STRIPE_API_KEY          (opcional) la clave de Stripe; para comprobar la firma no hace falta
//   STRIPE_WEBHOOK_SECRET   secreto de firma del webhook (whsec_...), en Stripe → Webhooks → tu destino
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
import Stripe from 'npm:stripe@23.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') || 'sin_clave', { apiVersion: '2026-10-28.endive', httpClient: Stripe.createFetchHttpClient() });
const crypto = Stripe.createSubtleCryptoProvider();
const PAID_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
// Enlaces de pago de Stripe: el pack se deduce de lo que se ha cobrado de verdad (nunca de lo que diga el navegador)
const BY_AMOUNT: Record<string, string> = { 'eur:199': 'calderilla', 'eur:399': 'maletin', 'eur:995': 'camara' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, req.headers.get('Stripe-Signature') ?? '', Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, crypto);
  } catch (e) {
    console.warn('firma no válida', (e as Error).message);
    return new Response('Firma no válida', { status: 400 });
  }

  if (PAID_EVENTS.includes(event.type)) {
    const s = event.data.object as Stripe.Checkout.Session;
    // con métodos de pago diferidos «completed» llega sin pagar: se entrega cuando llegue async_payment_succeeded
    if (s.mode === 'payment' && s.payment_status !== 'unpaid') {
      const user = s.client_reference_id ?? s.metadata?.user_id;
      const pack = s.payment_link ? BY_AMOUNT[`${s.currency}:${s.amount_total}`] : s.metadata?.pack;
      if (!user || !UUID.test(user) || !pack) { console.error('pago sin jugador o sin pack', s.id); return new Response('ok', { status: 200 }); }
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
      const { data, error } = await admin.rpc('grant_pack', { p_session: s.id, p_user: user, p_pack: pack, p_amount: s.amount_total ?? 0, p_currency: s.currency ?? 'eur' });
      if (error) { console.error('grant_pack', s.id, error.message); return new Response('Error al entregar', { status: 500 }); }   // Stripe reintentará
      console.log(data ? 'entregado' : 'ya estaba entregado', s.id, pack);
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    console.warn('pago diferido fallido', (event.data.object as Stripe.Checkout.Session).id);
  }
  return new Response('ok', { status: 200 });
});
