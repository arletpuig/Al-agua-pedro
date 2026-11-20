// AL AGUA PEDRO · función «avisos»: manda las notificaciones push (cofre diario a las 10 y recordatorio a las 19, hora de España).
// La llama cada hora la tarea programada de la base de datos (pg_cron + pg_net) con la clave x-cron-key de public.push_config.
// La primera vez crea las claves VAPID y las guarda en public.push_config (la privada no sale nunca del servidor).
// Despliegue: supabase functions deploy avisos --no-verify-jwt   (la función comprueba su propia clave)
import webpush from 'npm:web-push@3.6.7';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const db = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t}`); return t ? JSON.parse(t) : null;
};

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function message(s: { kind: string; name?: string; streak?: number }) {
  if (s.kind === 'chest') return { title: '🎁 ¡Tu cofre diario está listo!', body: pick(['Tomates, pesetas y cartas te esperan. ¡Ábrelo antes de medianoche!', 'Hay un cofre a tu nombre en la tienda. Pedro ya está temblando…', 'Cofre gratis del día: entra y ábrelo antes de que se pierda.']), tag: 'cofre', url: './?from=aviso-cofre' };
  if ((s.streak || 0) > 0) return { title: `🔥 ¡No pierdas tu racha de ${s.streak} día${s.streak === 1 ? '' : 's'}!`, body: 'Entra hoy para seguir en el calendario de logros: el día 7 trae cofre de diamante.', tag: 'jugar', url: './?from=aviso-jugar' };
  return { title: pick(['🍅 Pedro sigue seco…', '🎯 La diana te echa de menos', '💦 ¿Hoy no hay chapuzón?']), body: pick(['Tus misiones de hoy te esperan. ¡Al agua, Pedro!', 'Unos tomates y a la pecera: tus retos diarios siguen ahí.', 'Entra un momento: misiones nuevas, premios y Pedro sin mojarse.']), tag: 'jugar', url: './?from=aviso-jugar' };
}

Deno.serve(async req => {
  try {
    const [cfg] = await db('push_config?id=eq.1&select=*');
    if (!cfg) return json({ error: 'Falta public.push_config (ejecuta schema_v30.sql)' }, 500);
    // primera vez: claves para firmar los avisos (sin clave: solo se pueden crear si aún no existen)
    if (!cfg.vapid_public || !cfg.vapid_private) {
      const v = webpush.generateVAPIDKeys();
      await db('push_config?id=eq.1&vapid_public=is.null', { method: 'PATCH', body: JSON.stringify({ vapid_public: v.publicKey, vapid_private: v.privateKey }) });
      const [c2] = await db('push_config?id=eq.1&select=vapid_public'); return json({ ok: true, created: c2.vapid_public === v.publicKey, public: c2.vapid_public });
    }
    if (req.headers.get('x-cron-key') !== cfg.cron_key) return json({ error: 'no autorizado' }, 401);
    const body = await req.json().catch(() => ({}));
    const subs: any[] = await db('rpc/push_due', { method: 'POST', body: JSON.stringify(Number.isInteger(body?.hour) ? { p_hour: body.hour } : {}) });
    webpush.setVapidDetails('mailto:avisos@alaguapedro.es', cfg.vapid_public, cfg.vapid_private);
    let sent = 0, gone = 0, failed = 0;
    await Promise.all(subs.map(async s => {
      try {
        const d = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message(s)), { TTL: 6 * 3600, urgency: 'normal' });
        const r = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body });
        await r.body?.cancel();
        if (r.status === 404 || r.status === 410) { gone++; await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }); }
        else if (r.ok) sent++; else failed++;
      } catch (_) { failed++; }
    }));
    return json({ ok: true, due: subs.length, sent, gone, failed });
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
