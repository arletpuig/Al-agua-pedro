# Configurar las cuentas (Supabase)

Hazlo una sola vez, tarda 5 minutos:

1. Entra en https://supabase.com/dashboard y abre tu proyecto.
2. Menú izquierdo → **SQL Editor** → **New query**. Pega TODO el contenido de `schema.sql` y pulsa **Run**. Debe terminar sin errores.
3. Menú izquierdo → **Authentication** → **URL Configuration**:
   - **Site URL**: la dirección donde está publicado el juego (por ejemplo `https://arletpuig.github.io/Al-agua-pedro/`).
   - **Redirect URLs**: añade la misma dirección.
   Esto hace que el enlace de "recuperar contraseña" lleve de vuelta al juego.
4. (Opcional) **Authentication → Providers → Email**: si desactivas "Confirm email", los jugadores entran sin confirmar el correo.

Las claves que usa el juego están en `js/config.js`. Son la URL del proyecto y la clave **pública** (anon/publishable): están pensadas para ir en el navegador. Nunca pongas ahí la clave `service_role`.

## Seguridad aplicada
- Cada usuario solo puede leer su propia fila (RLS).
- Nadie puede escribir directamente en la tabla: todo pasa por la función `save_progress`, que comprueba que los totales no bajan, que no se lanzan más tomates de los conseguidos y limita los clics a 25 por segundo.
- El ranking solo expone nombre de jugador y estadísticas.
