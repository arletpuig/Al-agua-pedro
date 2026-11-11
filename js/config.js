// Configuración del juego. Cambia aquí los valores sin tocar el resto del código.
export const CONFIG = {
  CLICKS_PER_TOMATO: 100,      // clics necesarios para conseguir un tomate (también en supabase/schema.sql)
  TOMATO_SPEED: 0.72,          // píxeles (del viewBox) por milisegundo del tomate en movimiento
  SPEED_PER_FALL: 0.04,        // aumento de velocidad por cada caída provocada (dificultad progresiva)
  MAX_SPEED_MULT: 1.8,
  TRACK_Y: 58,                 // altura del recorrido del tomate
  TRACK_MIN: 70,
  TRACK_MAX: 730,
  TARGET_X: 430,               // centro de la diana
  TARGET_Y: 58,
  PERFECT_RADIUS: 15,          // distancia al centro para "acierto perfecto"
  NEAR_RADIUS: 44,             // distancia al centro para "acierto cercano" (radio de la diana)
  AUTOSAVE_MS: 4000,
  SUPABASE_URL: 'https://xfsvruccotcymcvxzymy.supabase.co',
  SUPABASE_KEY: 'sb_publishable_pjACLB15yr95O19i3NC8mQ_IOv0bQpP', // clave pública (anon), segura en el navegador
};
