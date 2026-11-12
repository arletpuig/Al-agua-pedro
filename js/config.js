// Configuración del juego. Cambia aquí los valores sin tocar el resto del código.
export const CONFIG = {
  CLICKS_PER_TOMATO: 100,      // clics necesarios para conseguir un tomate (también en supabase/schema_v2.sql)
  // Lanzamiento: el tomate va de lado a lado en horizontal por delante de la diana (coordenadas del escenario, 1080 de ancho)
  AIM_SPEED: 340,              // velocidad del tomate al apuntar (píxeles del escenario por segundo)
  BEGINNER_THROWS: 6,          // los primeros lanzamientos de un jugador nuevo van más despacio...
  BEGINNER_SPEED: 0.65,        // ...a esta fracción de la velocidad normal
  SPEED_PER_FALL: 0.01,        // aumento de velocidad por cada caída provocada (dificultad progresiva, suave)
  MAX_SPEED_MULT: 1.3,
  AIM_MIN: 600, AIM_MAX: 1075, // recorrido horizontal del tomate (la diana está en x = 880; a la izquierda queda Pedro)
  PERFECT_RADIUS: 64,          // distancia al centro para "acierto perfecto" (los tres anillos centrales): Pedro cae
  NEAR_RADIUS: 153,            // radio de la diana: impacto válido ("¡casi!")
  // Multiplicador de pulsaciones: aparece si pulsas seguido y baja si paras
  COMBO: { perTap: 1, decayPerSec: 9, graceSec: 0.5, levels: [{ heat: 0, mult: 1 }, { heat: 18, mult: 2 }, { heat: 45, mult: 3 }], max: 70 },
  // Regalo de bienvenida para jugadores nuevos (también en supabase/schema_v3.sql)
  WELCOME: { tomatoes: 5, pesetas: 10 },
  THROW_OPTIONS: [1, 3, 5, 10],
  AUTOSAVE_MS: 4000,
  SUPABASE_URL: 'https://xfsvruccotcymcvxzymy.supabase.co',
  SUPABASE_KEY: 'sb_publishable_pjACLB15yr95O19i3NC8mQ_IOv0bQpP', // clave pública (anon), segura en el navegador
};
