// Configuración del juego. Cambia aquí los valores sin tocar el resto del código.
export const CONFIG = {
  CLICKS_PER_TOMATO: 100,      // clics necesarios para conseguir un tomate (también en supabase/schema_v2.sql)
  TOMATO_SPEED: 0.62,          // píxeles por milisegundo del tomate al apuntar
  SPEED_PER_FALL: 0.03,        // aumento de velocidad por cada caída provocada (dificultad progresiva)
  MAX_SPEED_MULT: 1.7,
  AIM_MIN: 230, AIM_MAX: 770,  // recorrido horizontal del tomate
  AIM_WOBBLE: 26,              // oscilación vertical al apuntar
  PERFECT_RADIUS: 16,          // distancia al centro para "acierto perfecto" (anillo amarillo)
  NEAR_RADIUS: 74,             // radio de la diana: impacto válido
  THROW_OPTIONS: [1, 3, 5, 10],
  AUTOSAVE_MS: 4000,
  SUPABASE_URL: 'https://xfsvruccotcymcvxzymy.supabase.co',
  SUPABASE_KEY: 'sb_publishable_pjACLB15yr95O19i3NC8mQ_IOv0bQpP', // clave pública (anon), segura en el navegador
};
