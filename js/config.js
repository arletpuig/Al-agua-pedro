// Configuración del juego. Cambia aquí los valores sin tocar el resto del código.
export const CONFIG = {
  CLICKS_PER_TOMATO: 200,      // clics necesarios para conseguir un tomate (también en supabase/schema_v4.sql; antes eran 100)
  // Lanzamiento: el tomate va de lado a lado en horizontal por delante de la diana (coordenadas del escenario, 1080 de ancho)
  AIM_SPEED: 440,              // velocidad del tomate al apuntar (píxeles del escenario por segundo)
  BEGINNER_THROWS: 6,          // los primeros lanzamientos de un jugador nuevo van más despacio...
  BEGINNER_SPEED: 0.65,        // ...a esta fracción de la velocidad normal
  SPEED_PER_FALL: 0.01,        // aumento de velocidad por cada caída provocada (dificultad progresiva, suave)
  MAX_SPEED_MULT: 1.3,
  AIM_MIN: 600, AIM_MAX: 1075, // recorrido horizontal del tomate (la diana está en x = 880; a la izquierda queda Pedro)
  PERFECT_RADIUS: 32,          // distancia al centro para "acierto perfecto" (el centro de la diana): Pedro cae
  NEAR_RADIUS: 153,            // radio de la diana: impacto válido ("¡casi!")
  // Multiplicador de pulsaciones: aparece si pulsas seguido y baja si paras
  // tarda en llegar (70 toques seguidos para ×2, 220 para ×3) y se va enseguida si paras (0,5 s de gracia y cae rápido)
  COMBO: { perTap: 1, decayPerSec: 45, graceSec: 0.5, levels: [{ heat: 0, mult: 1 }, { heat: 70, mult: 2 }, { heat: 220, mult: 3 }], max: 260 },
  // Regalo de bienvenida para jugadores nuevos (también en supabase/schema_v3.sql)
  WELCOME: { tomatoes: 5, pesetas: 10 },
  THROW_OPTIONS: [1, 3, 5, 10],   // con 10-19 tomates; con menos o con más se adaptan (ver throwOptions en ui.js)
  AUTOSAVE_MS: 4000,
  // Anuncios fijos de AdSense en los paneles (Perfil, Cartas, Tienda; nunca en la pantalla de juego).
  // Pon aquí el «data-ad-slot» de cada bloque que crees en AdSense (Anuncios → Por bloque de anuncios → Display).
  // Vídeos recompensados: APAGADOS hasta que Google apruebe los anuncios (AdSense / H5 Games Ads).
  // Apagados: el regalo de bienvenida se abre sin vídeo, cambiar de bandera es gratis y El Falcón y el Sobre muestran «PRONTO».
  REWARDED_ADS: false,
  // Pagos con Stripe: encender cuando estén desplegadas las funciones crear-pago y stripe-webhook (ver supabase/STRIPE.md)
  PAYMENTS: true,
  ADSENSE: { client: 'ca-pub-7829705078320776', slots: { profile: '', cards: '', shop: '' } },
  SUPABASE_URL: 'https://xfsvruccotcymcvxzymy.supabase.co',
  SUPABASE_KEY: 'sb_publishable_pjACLB15yr95O19i3NC8mQ_IOv0bQpP', // clave pública (anon), segura en el navegador
};
