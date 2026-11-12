// Configuración del juego. Cambia aquí los valores sin tocar el resto del código.
export const CONFIG = {
  CLICKS_PER_TOMATO: 100,      // clics necesarios para conseguir un tomate (también en supabase/schema_v2.sql)
  // Lanzamiento: el tomate va de lado a lado en horizontal por delante de la diana (coordenadas del escenario, 1080 de ancho)
  AIM_SPEED: 230,              // velocidad del tomate al apuntar (píxeles del escenario por segundo)
  SPEED_PER_FALL: 0.015,       // aumento de velocidad por cada caída provocada (dificultad progresiva, muy suave)
  MAX_SPEED_MULT: 1.3,
  AIM_MIN: 730, AIM_MAX: 1078, // recorrido horizontal del tomate (la diana está en x = 905)
  PERFECT_RADIUS: 52,          // distancia al centro para "acierto perfecto" (los dos anillos centrales): Pedro cae
  NEAR_RADIUS: 118,            // radio de la diana: impacto válido ("¡casi!")
  THROW_OPTIONS: [1, 3, 5, 10],
  AUTOSAVE_MS: 4000,
  SUPABASE_URL: 'https://xfsvruccotcymcvxzymy.supabase.co',
  SUPABASE_KEY: 'sb_publishable_pjACLB15yr95O19i3NC8mQ_IOv0bQpP', // clave pública (anon), segura en el navegador
};
